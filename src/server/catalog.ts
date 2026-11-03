import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, products } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import type { StoreId } from "@/lib/constants";
import { safeDivide } from "@/lib/utils";
import { orderLineWhere, revenueSum, unitsSum, orderCount } from "./base";

/**
 * The sales ↔ catalog join and the "new vs old" classification, in one place.
 *
 * A sold line is matched to its `products` row by SKU first (normalized the same
 * way `normalizeSku` does at ingest — upper-cased, whitespace stripped), falling
 * back to product name (slugified, mirroring `slugify` in lib/utils) whenever the
 * line's SKU matches no catalog row. A matched product carries a launch-month
 * tag when its catalog `new_month` is set — i.e. its Categories cell carried a
 * tag like "Jan 26" (parsed at ingest into "2026-01"). Nothing about "new" is
 * stored on order lines; it's resolved here.
 *
 * "New" is defined relative to the **global date filter**: a product counts as
 * new only when its launch month falls inside the months being viewed (see
 * {@link monthWindow}). There is no separate launch-month control — the date
 * range the user already picked is the single source of truth. Filter October
 * 2026 and only October-2026 launches read as new; a July-2025 launch reads as
 * established, even though it still carries a tag.
 *
 * Note: this module must not import from ./analytics (which imports from here) —
 * the product-type expression is duplicated below to keep the dependency
 * one-directional.
 */

export type Segment = "new" | "old" | "all";

/**
 * Normalized SKU key of an order line. `[[:space:]]` (not `\s`) is used so the
 * regex survives drizzle's tagged-template concatenation unambiguously.
 */
export const olSkuKey = sql`upper(regexp_replace(coalesce(${orderLines.sku}, ''), '[[:space:]]+', '', 'g'))`;

/** Slugified product name of an order line — must match `slugify()` exactly. */
export const olNameKey = sql`trim(both '-' from regexp_replace(lower(coalesce(${orderLines.productName}, '')), '[^a-z0-9]+', '-', 'g'))`;

/** Product type bucket (duplicated from analytics.ts to avoid a cyclic import). */
const productTypeExpr = sql<string>`coalesce(nullif(${orderLines.productType}, ''), 'Unknown')`;

/**
 * A sold line's launch-month "segment key", resolved against the catalog:
 *   null        → the line matches no catalog product (unmatched)
 *   ''          → matched, but the product carries no month tag (established/old)
 *   'YYYY-MM'   → matched to a month-tagged product (new, that month)
 *
 * `coalesce(new_month, '')` folds the matched-but-untagged case to `''` so a
 * single scalar distinguishes all three states. Matching is SKU-first with a
 * name fallback that fires whenever the SKU misses (orders carry child-variant
 * SKUs while the catalog often lists only the parent); `order by` keeps a SKU
 * match ahead of a name match and `limit 1` collapses same-name variants.
 */
const rowNewMonthKey = sql<string | null>`(
  select coalesce(pc.new_month, '')
  from ${products} pc
  where pc.store_id = ${orderLines.storeId}
    and ( pc.sku_key = ${olSkuKey} or (${olNameKey} <> '' and pc.name_key = ${olNameKey}) )
  order by case when pc.sku_key = ${olSkuKey} then 0 else 1 end
  limit 1
)`;

/**
 * The launch-month window implied by the active date filter, as comparable
 * YYYY-MM strings. A null bound means that side is unbounded ("All Time", or a
 * custom range with one end open) — no constraint on that end.
 *
 * This is what ties "new" to the date filter: a product only counts as new when
 * its launch month falls inside the period being viewed. Filter October 2026 and
 * only October-2026 launches read as new; a July-2025 launch reads as
 * established, even though it still carries a month tag.
 */
export function monthWindow(f: Filters): { from: string | null; to: string | null } {
  const key = (d: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : null;
  return { from: key(f.from), to: key(f.to) };
}

/** JS predicate mirroring {@link isNewInWindow} — is a tag inside the window? */
export function monthInWindow(month: string | null, f: Filters): boolean {
  if (!month) return false;
  const { from, to } = monthWindow(f);
  return (!from || month >= from) && (!to || month <= to);
}

/**
 * SQL predicate: a resolved launch-month value (null | '' | 'YYYY-MM') represents
 * an in-window "new" product. Parameterised over any month-valued expression so
 * the same rule serves both a correlated subquery (in a WHERE clause) and a plain
 * derived column (in the breakdown). YYYY-MM strings sort lexicographically, so
 * string comparison is month comparison.
 */
function isNewInWindow(monthValue: SQL, f: Filters): SQL {
  const { from, to } = monthWindow(f);
  const clauses: SQL[] = [sql`${monthValue} is not null`, sql`${monthValue} <> ''`];
  if (from) clauses.push(sql`${monthValue} >= ${from}`);
  if (to) clauses.push(sql`${monthValue} <= ${to}`);
  return and(...clauses) as SQL;
}

/**
 * new | old | unmatched for a resolved launch-month value. "new" is scoped to the
 * filter window; a month-tagged product launched outside the window falls through
 * to "old" (established). Kept as a plain expression over `monthValue` so callers
 * can feed it a *derived column* and group by an ordinal — never a correlated
 * subquery embedded in GROUP BY (Postgres rejects that; see getNewVsOldBreakdown).
 */
function segmentExpr(monthValue: SQL, f: Filters): SQL<string> {
  return sql<string>`case
  when ${monthValue} is null then 'unmatched'
  when ${isNewInWindow(monthValue, f)} then 'new'
  else 'old' end`;
}

/**
 * Global filters narrowed to one catalog segment. `new` is matched-and-in-window;
 * `old` is matched-but-not-new (untagged, or launched outside the window); `all`
 * is just the plain filter. Unmatched lines belong to no segment. The launch-month
 * window comes entirely from the global date filter — there is no per-month knob.
 */
export function segmentWhere(f: Filters, segment: Segment): SQL {
  const base = orderLineWhere(f);
  if (segment === "new") return and(base, isNewInWindow(rowNewMonthKey, f)) as SQL;
  if (segment === "old") {
    return and(
      base,
      sql`${rowNewMonthKey} is not null`,
      sql`not (${isNewInWindow(rowNewMonthKey, f)})`,
    ) as SQL;
  }
  return base;
}

/** Shared SKU/name representative keys for a product-NAME group (grouped display). */
function groupedKeys() {
  // Both keys are aggregates (max) over the group: the outer query groups by the
  // coalesced-name *expression*, so a bare product_name column would be rejected
  // as "ungrouped". max() picks a stable representative within the group.
  const skuKey = sql`upper(regexp_replace(coalesce(max(${orderLines.sku}), ''), '[[:space:]]+', '', 'g'))`;
  const nameKey = sql`trim(both '-' from regexp_replace(lower(coalesce(max(${orderLines.productName}), '')), '[^a-z0-9]+', '-', 'g'))`;
  return { skuKey, nameKey };
}

/**
 * Catalog `created_at` for a product-NAME group — shown as the "added" date on
 * established products. SKU-first with a name fallback when the SKU misses.
 */
export function groupedCreatedAt(storeId: StoreId): SQL<Date | null> {
  const { skuKey, nameKey } = groupedKeys();
  return sql<Date | null>`(
    select pc.created_at
    from ${products} pc
    where pc.store_id = ${storeId}
      and ( pc.sku_key = ${skuKey} or (${nameKey} <> '' and pc.name_key = ${nameKey}) )
    order by case when pc.sku_key = ${skuKey} then 0 else 1 end
    limit 1
  )`;
}

/** Catalog `new_month` for a product-NAME group — the launch-month tag, or null. */
export function groupedNewMonth(storeId: StoreId): SQL<string | null> {
  const { skuKey, nameKey } = groupedKeys();
  return sql<string | null>`(
    select pc.new_month
    from ${products} pc
    where pc.store_id = ${storeId}
      and ( pc.sku_key = ${skuKey} or (${nameKey} <> '' and pc.name_key = ${nameKey}) )
    order by case when pc.sku_key = ${skuKey} then 0 else 1 end
    limit 1
  )`;
}

export type SegmentStats = { products: number; units: number; revenue: number; orders: number };
export type NewVsOld = { new: SegmentStats; old: SegmentStats; unmatched: SegmentStats };

const EMPTY: SegmentStats = { products: 0, units: 0, revenue: 0, orders: 0 };

/**
 * One grouped pass over the sold lines, split into new / old / unmatched.
 * `type`, when given, narrows to a single product type (for the per-type page).
 *
 * Shape matters here. The catalog lookup is a correlated subquery, and Postgres
 * forbids one inside GROUP BY unless the SELECT and GROUP BY copies are identical
 * node-for-node — which breaks the moment the window bounds add bound parameters
 * (they get renumbered per occurrence, so `>= $1` in SELECT vs `>= $6` in GROUP BY
 * stop matching, and Postgres then errors on the "ungrouped" order_lines columns).
 * So we resolve the launch month to a plain column `row_month` in an inner derived
 * table first, then classify and `group by 1` over that column — no subquery in
 * the grouping, and the lookup runs once per line instead of five times.
 */
export async function getNewVsOldBreakdown(f: Filters, type?: string): Promise<NewVsOld> {
  const where = type ? (and(orderLineWhere(f), eq(productTypeExpr, type)) as SQL) : orderLineWhere(f);

  const lines = db
    .select({
      name: sql<string>`coalesce(nullif(${orderLines.productName}, ''), 'Unnamed product')`.as("name"),
      quantity: orderLines.quantity,
      paymentAmount: orderLines.paymentAmount,
      orderId: orderLines.orderId,
      rowMonth: sql<string | null>`${rowNewMonthKey}`.as("row_month"),
    })
    .from(orderLines)
    .where(where)
    .as("lines");

  const rows = await db
    .select({
      segment: segmentExpr(sql`${lines.rowMonth}`, f),
      products: sql<number>`count(distinct ${lines.name})`,
      units: sql<number>`coalesce(sum(${lines.quantity}),0)`,
      revenue: sql<number>`coalesce(sum(${lines.paymentAmount}),0)`,
      orders: sql<number>`count(distinct ${lines.orderId})`,
    })
    .from(lines)
    .groupBy(sql`1`);

  const out: NewVsOld = { new: { ...EMPTY }, old: { ...EMPTY }, unmatched: { ...EMPTY } };
  for (const r of rows) {
    const key = r.segment as keyof NewVsOld;
    if (key in out) {
      out[key] = {
        products: Number(r.products),
        units: Number(r.units),
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      };
    }
  }
  return out;
}

export type SegmentProductRow = {
  name: string;
  imageUrl: string | null;
  units: number;
  revenue: number;
  aov: number;
  createdAt: Date | null;
  /** Launch-month tag ("2026-01") when the product is new, else null. */
  newMonth: string | null;
  isNew: boolean;
};

/**
 * Products (grouped by name, across all types) within a segment, ranked by
 * revenue — the lists on the dedicated /catalog page. The `new` segment is scoped
 * to the global date filter's launch-month window (see {@link segmentWhere}).
 */
export async function getProductsBySegment(
  f: Filters,
  segment: Segment,
  opts: { limit?: number | null } = {},
): Promise<SegmentProductRow[]> {
  const { limit = 50 } = opts;

  const base = db
    .select({
      name: sql<string>`coalesce(nullif(${orderLines.productName}, ''), 'Unnamed product')`,
      imageUrl: sql<string | null>`max(${orderLines.imageUrl})`,
      units: unitsSum,
      revenue: revenueSum,
      orders: orderCount,
      createdAt: groupedCreatedAt(f.storeId),
      newMonth: groupedNewMonth(f.storeId),
    })
    .from(orderLines)
    .where(segmentWhere(f, segment))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`);

  const rows = await (limit == null ? base : base.limit(limit));

  return rows.map((r) => {
    const createdAt = r.createdAt ? new Date(r.createdAt) : null;
    return {
      name: r.name,
      imageUrl: r.imageUrl,
      units: Number(r.units),
      revenue: Number(r.revenue),
      aov: safeDivide(Number(r.revenue), Number(r.orders)),
      createdAt,
      newMonth: r.newMonth ?? null,
      isNew: monthInWindow(r.newMonth ?? null, f),
    };
  });
}

/** Summary of a store's catalog, for the admin confirmation panel. */
export type CatalogStats = {
  total: number;
  withDate: number;
  /** Products carrying a launch-month tag (i.e. classified "new"). */
  withMonth: number;
  newest: Date | null;
  oldest: Date | null;
};

export async function getCatalogStats(storeId: StoreId): Promise<CatalogStats> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      withDate: sql<number>`count(${products.createdAt})`,
      withMonth: sql<number>`count(${products.newMonth})`,
      newest: sql<Date | null>`max(${products.createdAt})`,
      oldest: sql<Date | null>`min(${products.createdAt})`,
    })
    .from(products)
    .where(eq(products.storeId, storeId));

  return {
    total: Number(row?.total ?? 0),
    withDate: Number(row?.withDate ?? 0),
    withMonth: Number(row?.withMonth ?? 0),
    newest: row?.newest ? new Date(row.newest) : null,
    oldest: row?.oldest ? new Date(row.oldest) : null,
  };
}
