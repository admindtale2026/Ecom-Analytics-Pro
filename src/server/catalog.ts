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
 * line's SKU matches no catalog row. A matched product is "new" when its catalog
 * `new_month` is set — i.e. its Categories cell carried a launch-month tag like
 * "Jan 26" (parsed at ingest into "2026-01"). The month doubles as a filter
 * dimension. Nothing about "new" is stored on order lines; it's resolved here.
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

/** new | old | unmatched for one line, as a groupable label. */
const segmentExpr = sql<string>`case
  when ${rowNewMonthKey} is null then 'unmatched'
  when ${rowNewMonthKey} = '' then 'old'
  else 'new' end`;

/**
 * Global filters narrowed to one catalog segment, and optionally one launch month
 * (only meaningful for the `new` segment). `old` is matched-but-untagged; `all`
 * is just the plain filter. Unmatched lines belong to no segment.
 */
export function segmentWhere(f: Filters, segment: Segment, month?: string | null): SQL {
  const base = orderLineWhere(f);
  if (segment === "new") {
    const isNew = sql`${rowNewMonthKey} is not null and ${rowNewMonthKey} <> ''`;
    return (month ? and(base, isNew, sql`${rowNewMonthKey} = ${month}`) : and(base, isNew)) as SQL;
  }
  if (segment === "old") return and(base, sql`${rowNewMonthKey} = ''`) as SQL;
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

/** The launch months present in a store's catalog, newest first — filter options. */
export async function getNewMonths(storeId: StoreId): Promise<string[]> {
  const rows = await db
    .selectDistinct({ month: products.newMonth })
    .from(products)
    .where(and(eq(products.storeId, storeId), sql`${products.newMonth} is not null`))
    .orderBy(sql`${products.newMonth} desc`);
  return rows.map((r) => r.month).filter((m): m is string => Boolean(m));
}

export type SegmentStats = { products: number; units: number; revenue: number; orders: number };
export type NewVsOld = { new: SegmentStats; old: SegmentStats; unmatched: SegmentStats };

const EMPTY: SegmentStats = { products: 0, units: 0, revenue: 0, orders: 0 };

/**
 * One grouped pass over the sold lines, split into new / old / unmatched.
 * `type`, when given, narrows to a single product type (for the per-type page).
 */
export async function getNewVsOldBreakdown(f: Filters, type?: string): Promise<NewVsOld> {
  const where = type ? (and(orderLineWhere(f), eq(productTypeExpr, type)) as SQL) : orderLineWhere(f);

  const rows = await db
    .select({
      segment: segmentExpr,
      products: sql<number>`count(distinct coalesce(nullif(${orderLines.productName}, ''), 'Unnamed product'))`,
      units: unitsSum,
      revenue: revenueSum,
      orders: orderCount,
    })
    .from(orderLines)
    .where(where)
    .groupBy(segmentExpr);

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
 * revenue — the lists on the dedicated /catalog page. `opts.month` narrows the
 * `new` segment to a single launch month.
 */
export async function getProductsBySegment(
  f: Filters,
  segment: Segment,
  opts: { limit?: number | null; month?: string | null } = {},
): Promise<SegmentProductRow[]> {
  const { limit = 50, month } = opts;

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
    .where(segmentWhere(f, segment, month))
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
      isNew: Boolean(r.newMonth),
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
