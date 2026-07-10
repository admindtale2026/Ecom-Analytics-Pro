import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount, repNameCol } from "./base";
import { safeDivide } from "@/lib/utils";

const productType = sql<string>`coalesce(nullif(${orderLines.productType}, ''), 'Unknown')`;

/** Global filters narrowed to a single product type. */
function typeWhere(f: Filters, type: string): SQL {
  return and(orderLineWhere(f), eq(productType, type)) as SQL;
}

export type ProductTypeRow = {
  productType: string;
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  share: number;
};

/** Headline stats for the Analytics page: peak day, velocity, leading type. */
export async function getAnalyticsHeadline(f: Filters): Promise<{
  peakDay: string | null;
  velocity: number;
  leadingType: string | null;
}> {
  const peaks = await db
    .select({
      date: sql<string>`to_char(${orderLines.orderDate}, 'YYYY-MM-DD')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(5);
  const peak = peaks.find((p) => p.date);

  const [span] = await db
    .select({
      orders: orderCount,
      days: sql<number>`greatest(1, count(distinct date_trunc('day', ${orderLines.orderDate})))`,
    })
    .from(orderLines)
    .where(orderLineWhere(f));

  const [lead] = await db
    .select({ productType, revenue: revenueSum })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(1);

  return {
    peakDay: peak?.date ?? null,
    velocity: safeDivide(Number(span?.orders ?? 0), Number(span?.days ?? 1)),
    leadingType: lead?.productType ?? null,
  };
}

/** Daily revenue + order volume, for the dual-axis Sales Trajectory chart. */
export async function getTrajectory(
  f: Filters,
): Promise<{ date: string; revenue: number; orders: number }[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${orderLines.orderDate}, 'YYYY-MM-DD')`,
      revenue: revenueSum,
      orders: orderCount,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.filter((r) => r.date).map((r) => ({ ...r, orders: Number(r.orders) }));
}

/** Full product-type matrix, ranked by revenue, with share of total. */
export async function getProductTypeMatrix(f: Filters): Promise<ProductTypeRow[]> {
  const rows = await db
    .select({
      productType,
      revenue: revenueSum,
      orders: orderCount,
      units: unitsSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`);

  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
  return rows.map((r) => ({
    productType: r.productType,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
    units: Number(r.units),
    aov: safeDivide(Number(r.revenue), Number(r.orders)),
    share: safeDivide(Number(r.revenue), total) * 100,
  }));
}

/** Top cities for a given product type ("Regional Dominance"). */
export async function getCitiesForType(
  f: Filters,
  type: string,
  limit = 5,
): Promise<{ city: string; revenue: number }[]> {
  return db
    .select({
      city: sql<string>`coalesce(nullif(${orderLines.shipCity}, ''), 'Unknown')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(typeWhere(f, type))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(limit);
}

export type TypeDetail = {
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  share: number;
  bestSalesperson: { name: string; revenue: number } | null;
  topState: { name: string; revenue: number } | null;
  topCity: { name: string; revenue: number } | null;
};

/** Everything the product-type drill-down header needs. */
export async function getTypeDetail(f: Filters, type: string): Promise<TypeDetail> {
  const where = typeWhere(f, type);

  const [[agg], [totalRow], [person], [state], [city]] = await Promise.all([
    db
      .select({ revenue: revenueSum, orders: orderCount, units: unitsSum })
      .from(orderLines)
      .where(where),
    db.select({ revenue: revenueSum }).from(orderLines).where(orderLineWhere(f)),
    db
      .select({
        name: repNameCol,
        revenue: revenueSum,
      })
      .from(orderLines)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(1),
    db
      .select({
        name: sql<string>`coalesce(nullif(${orderLines.shipState}, ''), 'Unknown')`,
        revenue: revenueSum,
      })
      .from(orderLines)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(1),
    db
      .select({
        name: sql<string>`coalesce(nullif(${orderLines.shipCity}, ''), 'Unknown')`,
        revenue: revenueSum,
      })
      .from(orderLines)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(1),
  ]);

  const revenue = Number(agg?.revenue ?? 0);
  const orders = Number(agg?.orders ?? 0);
  return {
    revenue,
    orders,
    units: Number(agg?.units ?? 0),
    aov: safeDivide(revenue, orders),
    share: safeDivide(revenue, Number(totalRow?.revenue ?? 0)) * 100,
    bestSalesperson: person ? { name: person.name, revenue: Number(person.revenue) } : null,
    topState: state ? { name: state.name, revenue: Number(state.revenue) } : null,
    topCity: city ? { name: city.name, revenue: Number(city.revenue) } : null,
  };
}

export type ProductRow = {
  name: string;
  imageUrl: string | null;
  units: number;
  revenue: number;
  aov: number;
};

/** Top-selling products within a product type. */
export async function getTopProductsForType(
  f: Filters,
  type: string,
  limit = 20,
): Promise<ProductRow[]> {
  const rows = await db
    .select({
      name: sql<string>`coalesce(nullif(${orderLines.productName}, ''), 'Unnamed product')`,
      imageUrl: sql<string | null>`max(${orderLines.imageUrl})`,
      units: unitsSum,
      revenue: revenueSum,
      orders: orderCount,
    })
    .from(orderLines)
    .where(typeWhere(f, type))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`)
    .limit(limit);

  return rows.map((r) => ({
    name: r.name,
    imageUrl: r.imageUrl,
    units: Number(r.units),
    revenue: Number(r.revenue),
    aov: safeDivide(Number(r.revenue), Number(r.orders)),
  }));
}
