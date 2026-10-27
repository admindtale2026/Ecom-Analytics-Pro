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
 * back to product name (slugified, mirroring `slugify` in lib/utils) when the
 * line carries no SKU. A matched product is "new" when its catalog `created_at`
 * is within 3 months of *now* — so the split is always relative to today and is
 * never stored.
 *
 * Note: this module must not import from ./analytics (which imports from here) —
 * the product-type expression is duplicated below to keep the dependency
 * one-directional.
 */

export type Segment = "new" | "old" | "all";

/** 3-month "new" window, DB side. */
const NEW_CUTOFF = sql`now() - interval '3 months'`;

/**
 * Normalized SKU key of an order line. `[[:space:]]` (not `\s`) is used so the
 * regex survives drizzle's tagged-template concatenation unambiguously.
 */
const olSkuKey = sql`upper(regexp_replace(coalesce(${orderLines.sku}, ''), '[[:space:]]+', '', 'g'))`;

/** Slugified product name of an order line — must match `slugify()` exactly. */
const olNameKey = sql`trim(both '-' from regexp_replace(lower(coalesce(${orderLines.productName}, '')), '[^a-z0-9]+', '-', 'g'))`;

/** Product type bucket (duplicated from analytics.ts to avoid a cyclic import). */
const productTypeExpr = sql<string>`coalesce(nullif(${orderLines.productType}, ''), 'Unknown')`;

/**
 * Catalog `created_at` for a single order line (row-level, for WHERE/CASE).
 * SKU match wins; name fallback only when the line has no usable SKU.
 */
const rowCreatedAt = sql<Date | null>`(
  select pc.created_at
  from ${products} pc
  where pc.store_id = ${orderLines.storeId}
    and ( pc.sku_key = ${olSkuKey}
          or (${olSkuKey} = '' and pc.name_key = ${olNameKey}) )
  order by case when pc.sku_key = ${olSkuKey} then 0 else 1 end
  limit 1
)`;

/** new | old | unmatched for one line, as a groupable label. */
const segmentExpr = sql<string>`case
  when ${rowCreatedAt} is null then 'unmatched'
  when ${rowCreatedAt} >= ${NEW_CUTOFF} then 'new'
  else 'old' end`;

/**
 * Global filters narrowed to one catalog segment.
 * `old` deliberately excludes unmatched lines (a null created_at is neither new
 * nor old); `all` is just the plain filter.
 */
export function segmentWhere(f: Filters, segment: Segment): SQL {
  const base = orderLineWhere(f);
  if (segment === "new") return and(base, sql`${rowCreatedAt} >= ${NEW_CUTOFF}`) as SQL;
  if (segment === "old") {
    return and(base, sql`${rowCreatedAt} is not null and ${rowCreatedAt} < ${NEW_CUTOFF}`) as SQL;
  }
  return base;
}

/**
 * Catalog `created_at` for a product-NAME group (grouped display). Resolves on
 * the group's representative SKU (`max(sku)`), name fallback otherwise.
 * `storeId` is bound as a literal so no ungrouped column is referenced.
 */
export function groupedCreatedAt(storeId: StoreId): SQL<Date | null> {
  // Both keys are aggregates (max) over the group: the outer query groups by the
  // coalesced-name *expression*, so a bare product_name column would be rejected
  // as "ungrouped". max() picks a stable representative within the group.
  const skuKey = sql`upper(regexp_replace(coalesce(max(${orderLines.sku}), ''), '[[:space:]]+', '', 'g'))`;
  const nameKey = sql`trim(both '-' from regexp_replace(lower(coalesce(max(${orderLines.productName}), '')), '[^a-z0-9]+', '-', 'g'))`;
  return sql<Date | null>`(
    select pc.created_at
    from ${products} pc
    where pc.store_id = ${storeId}
      and ( pc.sku_key = ${skuKey}
            or (${skuKey} = '' and pc.name_key = ${nameKey}) )
    order by case when pc.sku_key = ${skuKey} then 0 else 1 end
    limit 1
  )`;
}

const NEW_WINDOW_MONTHS = 3;

/** JS-side "is this date within the new window" — for annotating fetched rows. */
export function isNewDate(createdAt: Date | null): boolean {
  if (!createdAt) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - NEW_WINDOW_MONTHS);
  return createdAt.getTime() >= cutoff.getTime();
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
  isNew: boolean;
};

/**
 * Products (grouped by name, across all types) within a segment, ranked by
 * revenue — the lists on the dedicated /catalog page.
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
      isNew: isNewDate(createdAt),
    };
  });
}

/** Summary of a store's uploaded catalog, for the admin confirmation panel. */
export type CatalogStats = {
  total: number;
  withDate: number;
  newest: Date | null;
  oldest: Date | null;
};

export async function getCatalogStats(storeId: StoreId): Promise<CatalogStats> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      withDate: sql<number>`count(${products.createdAt})`,
      newest: sql<Date | null>`max(${products.createdAt})`,
      oldest: sql<Date | null>`min(${products.createdAt})`,
    })
    .from(products)
    .where(eq(products.storeId, storeId));

  return {
    total: Number(row?.total ?? 0),
    withDate: Number(row?.withDate ?? 0),
    newest: row?.newest ? new Date(row.newest) : null,
    oldest: row?.oldest ? new Date(row.oldest) : null,
  };
}
