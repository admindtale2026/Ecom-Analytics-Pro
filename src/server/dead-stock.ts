import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, products } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount } from "./base";
import { olSkuKey, olNameKey, isNewDate } from "./catalog";

/**
 * "Dead Stock": catalog products that aren't moving, grouped by category.
 *
 * Every other query in this app reads FROM order_lines (things that sold); this
 * one runs the join the other way — FROM the `products` catalog (the universe of
 * sellable products, and the only place a never-sold product exists) LEFT JOIN
 * order_lines — so a product with zero matching sales survives the join with
 * units = 0. The sales side is matched by the *same* normalized SKU→name keys as
 * src/server/catalog.ts (`olSkuKey`/`olNameKey`), and narrowed by the global
 * filters (store / date range / salesperson) via `orderLineWhere`, placed in the
 * JOIN's ON clause so the window doesn't drop unsold rows.
 *
 * A product is `dead` (0 units sold in the window), `slow` (sold, but at or below
 * SLOW_MAX_UNITS), or `moving` (above it). Moving products are counted in the
 * per-category summary but omitted from the detail lists.
 */

export type DeadStockTier = "dead" | "slow" | "moving";

/** Sold 1..2 units in the window counts as "slow"; 0 is "dead". Tunable. */
export const SLOW_MAX_UNITS = 2;

/** Grouping dimension: the Magento attribute set, blank folded to "Uncategorized". */
const categoryExpr = sql<string>`coalesce(nullif(trim(${products.attributeSetCode}), ''), 'Uncategorized')`;

/** Product display name from the catalog row. */
const nameExpr = sql<string>`coalesce(nullif(${products.name}, ''), 'Unnamed product')`;

/**
 * The sales ↔ catalog match for the LEFT JOIN: SKU key wins, product-name slug
 * is the fallback only when the line carries no SKU. Mirrors catalog.ts exactly.
 */
const matchOn = sql`(
  ${olSkuKey} = ${products.skuKey}
  or (${olSkuKey} = '' and ${olNameKey} = ${products.nameKey})
)`;

function tierOf(units: number): DeadStockTier {
  if (units <= 0) return "dead";
  if (units <= SLOW_MAX_UNITS) return "slow";
  return "moving";
}

export type ProductSalesRow = {
  name: string;
  sku: string;
  category: string;
  createdAt: Date | null;
  units: number;
  revenue: number;
  orders: number;
  tier: DeadStockTier;
};

/**
 * One row per catalog product with its sales in the current filter window
 * (units/revenue = 0 when it never sold). The shared base for both the summary
 * and the detail list. `category`, when given, narrows to one attribute set.
 */
async function fetchProductSales(f: Filters, category?: string): Promise<ProductSalesRow[]> {
  const where: SQL[] = [eq(products.storeId, f.storeId)];
  if (category) where.push(eq(categoryExpr, category));

  const rows = await db
    .select({
      id: products.id,
      name: nameExpr,
      sku: products.sku,
      category: categoryExpr,
      createdAt: products.createdAt,
      units: unitsSum,
      revenue: revenueSum,
      orders: orderCount,
    })
    .from(products)
    // Window conditions live in ON (not WHERE) so unsold products survive.
    .leftJoin(orderLines, and(orderLineWhere(f), matchOn) as SQL)
    .where(and(...where) as SQL)
    .groupBy(products.id);

  return rows.map((r) => {
    const units = Number(r.units);
    return {
      name: r.name,
      sku: r.sku,
      category: r.category,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
      units,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
      tier: tierOf(units),
    };
  });
}

export type CategorySummaryRow = {
  category: string;
  catalog: number; // total catalog products in the category
  dead: number;
  slow: number;
  moving: number;
  unitsWindow: number;
  revenueWindow: number;
};

/**
 * Per-category rollup — the headline "category-wise list". Ordered by the size
 * of the problem (dead + slow desc), so the worst-stocked categories lead.
 */
export async function getDeadStockSummary(f: Filters): Promise<CategorySummaryRow[]> {
  const rows = await fetchProductSales(f);

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
      };
      byCategory.set(r.category, c);
    }
    c.catalog += 1;
    c[r.tier] += 1;
    c.unitsWindow += r.units;
    c.revenueWindow += r.revenue;
  }

  return [...byCategory.values()].sort(
    (a, b) => b.dead + b.slow - (a.dead + a.slow) || a.category.localeCompare(b.category),
  );
}

export type DeadStockProductRow = ProductSalesRow & { isNew: boolean };

/**
 * The non-moving products (dead + slow only), optionally narrowed to one
 * category and/or tier. Ordered category → tier (dead first) → name.
 */
export async function getDeadStockProducts(
  f: Filters,
  opts: { category?: string; tier?: "dead" | "slow" } = {},
): Promise<DeadStockProductRow[]> {
  const rows = await fetchProductSales(f, opts.category);

  const tierRank: Record<DeadStockTier, number> = { dead: 0, slow: 1, moving: 2 };
  return rows
    .filter((r) => (opts.tier ? r.tier === opts.tier : r.tier !== "moving"))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        tierRank[a.tier] - tierRank[b.tier] ||
        a.name.localeCompare(b.name),
    )
    .map((r) => ({ ...r, isNew: isNewDate(r.createdAt) }));
}
