import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, products } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere } from "./base";
import { olSkuKey, olNameKey, isNewDate } from "./catalog";

/**
 * "Dead Stock": catalog products that aren't moving, grouped by category.
 *
 * Every other query in this app reads FROM order_lines (things that sold); this
 * one starts FROM the `products` catalog (the only place a never-sold product
 * exists) and attaches sales, so a product with zero matching sales survives
 * with units = 0.
 *
 * Two things the raw Magento export gets wrong on its own, fixed here:
 *
 *  1. Duplicates. A configurable product and its simple colour/size variants are
 *     separate catalog rows with different SKUs but the *same name*, so one real
 *     product would list 2–4 times and its sales would split across the rows. We
 *     collapse variants into a single **logical product** keyed by name slug
 *     (`name_key`), falling back to the SKU key only when the name is blank, and
 *     sum sales across every member SKU — "sold" if *any* variant sold. The
 *     sales side resolves each order line to exactly one logical product via a
 *     `limit 1` match (SKU first, name fallback — mirroring src/server/catalog.ts),
 *     so a name-matched line is never counted once per variant.
 *
 *  2. Disabled products. Rows whose Magento `status` is Disabled are discontinued
 *     and excluded. A blank/unknown status is treated as enabled (so catalogs
 *     uploaded before the `status` column existed still show).
 *
 * Tiering stays window-relative: `dead` = 0 units sold within the active date
 * filter, `slow` = 1..SLOW_MAX_UNITS, `moving` = above it. Aging (`daysIdle`,
 * `lastSold`) and `daysToFirstSale` are *lifetime* facts (store-scoped, ignoring
 * the date/salesperson filter) so a quiet month never resets them.
 */

export type DeadStockTier = "dead" | "slow" | "moving";

/** Sold 1..2 units in the window counts as "slow"; 0 is "dead". Tunable. */
export const SLOW_MAX_UNITS = 2;

/** Idle-days thresholds (lifetime days since last sale) that drive risk + action. */
const IDLE_WARN = 90;
const IDLE_HIGH = 180;
const IDLE_CRIT = 365;

/** List price (₹) at or above which dead stock ties up notable capital. Tunable. */
const HIGH_VALUE = 20000;

const MS_PER_DAY = 86_400_000;

/** Grouping dimension: the Magento attribute set, blank folded to "Uncategorized". */
const categoryExpr = sql<string>`coalesce(nullif(trim(${products.attributeSetCode}), ''), 'Uncategorized')`;

/** The catalog-side logical-product key: name slug, SKU key when the name is blank. */
const catalogLogicalKey = sql<string>`coalesce(nullif(${products.nameKey}, ''), ${products.skuKey})`;

/** Keep a product unless its Magento status is Disabled; blank/unknown = enabled. */
const notDisabled = sql`coalesce(lower(nullif(trim(${products.status}), '')), 'enabled') not in ('disabled', '2')`;

/**
 * The logical-product key of a single order line: find its catalog row (SKU key
 * first, name slug fallback only when the line carries no SKU; Disabled rows
 * ignored) and return that row's logical key. `limit 1` so a line matching
 * several same-name variants resolves to one product — the dedup that keeps
 * summed sales honest. Null when the line matches no (enabled) catalog product.
 */
const lineLogicalKey = sql<string | null>`(
  select coalesce(nullif(pc.name_key, ''), pc.sku_key)
  from ${products} pc
  where pc.store_id = ${orderLines.storeId}
    and ( pc.sku_key = ${olSkuKey} or (${olSkuKey} = '' and pc.name_key = ${olNameKey}) )
    and coalesce(lower(nullif(trim(pc.status), '')), 'enabled') not in ('disabled', '2')
  order by case when pc.sku_key = ${olSkuKey} then 0 else 1 end
  limit 1
)`;

function tierOf(units: number): DeadStockTier {
  if (units <= 0) return "dead";
  if (units <= SLOW_MAX_UNITS) return "slow";
  return "moving";
}

export type DeadAction = "Liquidate" | "Discount" | "Bundle" | "Watch";

/** Whole days between two dates (a after b), floored. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/** Days since the product was listed, or null when it has no catalog date. */
function ageSinceListed(createdAt: Date | null): number | null {
  return createdAt ? daysBetween(new Date(), createdAt) : null;
}

/**
 * A transparent 0–100 risk score: how urgently this product needs action.
 * Tier does most of the work; long idle time and high tied-up value add to it.
 * `idleBasis` is lifetime days-idle, or age-since-listed when it never sold.
 */
function riskOf(tier: DeadStockTier, daysIdle: number | null, createdAt: Date | null, price: number | null): number {
  let s = tier === "dead" ? 50 : tier === "slow" ? 25 : 0;
  const idle = daysIdle ?? ageSinceListed(createdAt) ?? 0;
  if (idle > IDLE_CRIT) s += 30;
  else if (idle > IDLE_HIGH) s += 20;
  else if (idle > IDLE_WARN) s += 10;
  if ((price ?? 0) >= HIGH_VALUE) s += 20;
  return Math.min(100, s);
}

/** The recommended merchandising move, from age, idle time and tied-up value. */
function actionOf(
  tier: DeadStockTier,
  neverSold: boolean,
  daysIdle: number | null,
  createdAt: Date | null,
  price: number | null,
): DeadAction {
  const listed = ageSinceListed(createdAt) ?? 0;
  const idle = daysIdle ?? listed;
  const highValue = (price ?? 0) >= HIGH_VALUE;
  if (neverSold && listed > IDLE_HIGH) return "Liquidate"; // never sold, long on the shelf
  if (idle > IDLE_CRIT) return "Liquidate"; // sold once, then cold for a year+
  if (highValue && tier === "dead") return "Bundle"; // move pricey dead stock with a seller
  if (idle > IDLE_WARN) return "Discount";
  return "Watch"; // recently listed or only mildly slow — give it time
}

export type ProductRow = {
  name: string;
  sku: string;
  skuCount: number; // how many catalog SKUs (variants) this logical product folds in
  category: string;
  status: string | null;
  createdAt: Date | null;
  price: number | null;
  units: number; // window units
  revenue: number; // window revenue
  orders: number; // window orders
  tier: DeadStockTier; // window-relative
  isNew: boolean;
  lastSold: Date | null; // lifetime
  daysIdle: number | null; // lifetime days since last sale; null = never sold
  daysToFirstSale: number | null; // lifetime: shelf days before first order
  riskScore: number;
  action: DeadAction;
};

type WindowAgg = { units: number; revenue: number; orders: number };
type LifeAgg = { firstSold: Date | null; lastSold: Date | null };

/**
 * One enriched row per logical product (all tiers). Shared base for the summary
 * and the detail list. `category`, when given, narrows to one attribute set.
 */
async function fetchLogicalProducts(f: Filters, category?: string): Promise<ProductRow[]> {
  const catalogWhere: SQL[] = [eq(products.storeId, f.storeId), notDisabled as SQL];
  if (category) catalogWhere.push(eq(categoryExpr, category));

  // Each order line tagged with its resolved logical-product key, in a derived
  // table. Grouping by a correlated subquery directly trips Postgres ("ungrouped
  // column"), so we materialize the key as a plain column and group by that.
  // Window = honours the global date/salesperson filter; lifetime = store only.
  const windowLines = db
    .select({
      key: sql<string | null>`${lineLogicalKey}`.as("key"),
      quantity: orderLines.quantity,
      payment: orderLines.paymentAmount,
      orderId: orderLines.orderId,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .as("window_lines");

  const lifeLines = db
    .select({
      key: sql<string | null>`${lineLogicalKey}`.as("key"),
      orderDate: orderLines.orderDate,
    })
    .from(orderLines)
    .where(eq(orderLines.storeId, f.storeId))
    .as("life_lines");

  const [catalog, windowRows, lifeRows] = await Promise.all([
    db
      .select({
        key: catalogLogicalKey,
        name: sql<string>`coalesce(nullif(max(${products.name}), ''), 'Unnamed product')`,
        sku: sql<string>`max(${products.sku})`,
        category: sql<string>`coalesce(nullif(trim(max(${products.attributeSetCode})), ''), 'Uncategorized')`,
        status: sql<string | null>`max(${products.status})`,
        createdAt: sql<Date | null>`min(${products.createdAt})`,
        price: sql<number | null>`max(${products.price})`,
        skuCount: sql<number>`count(distinct ${products.skuKey})`,
      })
      .from(products)
      .where(and(...catalogWhere) as SQL)
      .groupBy(catalogLogicalKey),
    db
      .select({
        key: windowLines.key,
        units: sql<number>`coalesce(sum(${windowLines.quantity}),0)`,
        revenue: sql<number>`coalesce(sum(${windowLines.payment}),0)`,
        orders: sql<number>`count(distinct ${windowLines.orderId})`,
      })
      .from(windowLines)
      .where(sql`${windowLines.key} is not null`)
      .groupBy(windowLines.key),
    db
      .select({
        key: lifeLines.key,
        firstSold: sql<Date | null>`min(${lifeLines.orderDate})`,
        lastSold: sql<Date | null>`max(${lifeLines.orderDate})`,
      })
      .from(lifeLines)
      .where(sql`${lifeLines.key} is not null`)
      .groupBy(lifeLines.key),
  ]);

  const windowMap = new Map<string, WindowAgg>();
  for (const r of windowRows) {
    if (r.key == null) continue;
    windowMap.set(r.key, { units: Number(r.units), revenue: Number(r.revenue), orders: Number(r.orders) });
  }
  const lifeMap = new Map<string, LifeAgg>();
  for (const r of lifeRows) {
    if (r.key == null) continue;
    lifeMap.set(r.key, {
      firstSold: r.firstSold ? new Date(r.firstSold) : null,
      lastSold: r.lastSold ? new Date(r.lastSold) : null,
    });
  }

  const now = new Date();
  return catalog.map((r) => {
    const w = windowMap.get(r.key) ?? { units: 0, revenue: 0, orders: 0 };
    const life = lifeMap.get(r.key);
    const createdAt = r.createdAt ? new Date(r.createdAt) : null;
    const price = r.price == null ? null : Number(r.price);
    const tier = tierOf(w.units);

    const lastSold = life?.lastSold ?? null;
    const firstSold = life?.firstSold ?? null;
    const daysIdle = lastSold ? daysBetween(now, lastSold) : null;
    const daysToFirstSale =
      createdAt && firstSold && firstSold.getTime() >= createdAt.getTime()
        ? daysBetween(firstSold, createdAt)
        : null;

    return {
      name: r.name,
      sku: r.sku,
      skuCount: Number(r.skuCount),
      category: r.category,
      status: r.status,
      createdAt,
      price,
      units: w.units,
      revenue: w.revenue,
      orders: w.orders,
      tier,
      isNew: isNewDate(createdAt),
      lastSold,
      daysIdle,
      daysToFirstSale,
      riskScore: riskOf(tier, daysIdle, createdAt, price),
      action: actionOf(tier, lastSold == null, daysIdle, createdAt, price),
    };
  });
}

export type CategorySummaryRow = {
  category: string;
  catalog: number; // total logical products in the category
  dead: number;
  slow: number;
  moving: number;
  unitsWindow: number;
  revenueWindow: number;
  valueAtRisk: number; // Σ list price of dead + slow logical products
};

/**
 * Per-category rollup — the headline "category-wise list". Ordered by the size
 * of the problem (dead + slow desc), so the worst-stocked categories lead.
 */
export async function getDeadStockSummary(f: Filters): Promise<CategorySummaryRow[]> {
  const rows = await fetchLogicalProducts(f);

  const byCategory = new Map<string, CategorySummaryRow>();
  for (const r of rows) {
    let c = byCategory.get(r.category);
    if (!c) {
      c = {
        category: r.category,
        catalog: 0,
        dead: 0,
        slow: 0,
        moving: 0,
        unitsWindow: 0,
        revenueWindow: 0,
        valueAtRisk: 0,
      };
      byCategory.set(r.category, c);
    }
    c.catalog += 1;
    c[r.tier] += 1;
    c.unitsWindow += r.units;
    c.revenueWindow += r.revenue;
    if (r.tier !== "moving") c.valueAtRisk += r.price ?? 0;
  }

  return [...byCategory.values()].sort(
    (a, b) => b.dead + b.slow - (a.dead + a.slow) || a.category.localeCompare(b.category),
  );
}

export type DeadStockProductRow = ProductRow;

/**
 * The non-moving logical products (dead + slow only), optionally narrowed to one
 * category and/or tier. Ordered category → risk (highest first) → name.
 */
export async function getDeadStockProducts(
  f: Filters,
  opts: { category?: string; tier?: "dead" | "slow" } = {},
): Promise<DeadStockProductRow[]> {
  const rows = await fetchLogicalProducts(f, opts.category);

  return rows
    .filter((r) => (opts.tier ? r.tier === opts.tier : r.tier !== "moving"))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        b.riskScore - a.riskScore ||
        a.name.localeCompare(b.name),
    );
}
