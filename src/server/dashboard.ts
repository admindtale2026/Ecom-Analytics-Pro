import { and, eq, gt, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, orderSummary } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import {
  orderLineWhere,
  orderSummaryRevenueWhere,
  revenueSum,
  unitsSum,
  summaryRevenueSum,
  summaryOrderCount,
  summaryRepNameCol,
} from "./base";
import { safeDivide } from "@/lib/utils";

export type Kpis = {
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  revenueDelta: number | null;
  ordersDelta: number | null;
};

/** Previous equal-length window, over order_summary revenue rows. */
function prevWindow(f: Filters): SQL | null {
  if (!f.from || !f.to) return null;
  const span = f.to.getTime() - f.from.getTime();
  const prevTo = new Date(f.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  const conds: SQL[] = [
    eq(orderSummary.storeId, f.storeId),
    gt(orderSummary.paymentAmount, 0),
    gte(orderSummary.orderDate, prevFrom),
    lte(orderSummary.orderDate, prevTo),
  ];
  if (f.salespeople.length) conds.push(inArray(orderSummary.salesPerson, f.salespeople));
  return and(...conds) as SQL;
}

export async function getKpis(f: Filters): Promise<Kpis> {
  // Revenue / orders / AOV come from the Order Summary tab (authoritative order
  // totals, incl. orders that never got line items); Units stays on the detail
  // tab, the only place per-line quantities exist. Previous-period revenue is
  // independent, so all three fire in one round-trip.
  const pw = prevWindow(f);
  const [[cur], [unitsRow], prevRows] = await Promise.all([
    db
      .select({ revenue: summaryRevenueSum, orders: summaryOrderCount })
      .from(orderSummary)
      .where(orderSummaryRevenueWhere(f)),
    db.select({ units: unitsSum }).from(orderLines).where(orderLineWhere(f)),
    pw
      ? db.select({ revenue: summaryRevenueSum, orders: summaryOrderCount }).from(orderSummary).where(pw)
      : Promise.resolve([]),
  ]);

  let revenueDelta: number | null = null;
  let ordersDelta: number | null = null;
  const prev = prevRows[0];
  if (prev) {
    revenueDelta = prev.revenue ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : null;
    ordersDelta = prev.orders ? ((cur.orders - prev.orders) / prev.orders) * 100 : null;
  }

  return {
    revenue: cur.revenue,
    orders: cur.orders,
    units: unitsRow.units,
    aov: safeDivide(cur.revenue, cur.orders),
    revenueDelta,
    ordersDelta,
  };
}

export async function getDailyRevenue(f: Filters): Promise<{ date: string; revenue: number }[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${orderSummary.orderDate}, 'YYYY-MM-DD')`,
      revenue: summaryRevenueSum,
    })
    .from(orderSummary)
    .where(orderSummaryRevenueWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.filter((r) => r.date);
}

export async function getSalespersonPerformance(
  f: Filters,
  limit = 8,
): Promise<{ name: string; orders: number; revenue: number }[]> {
  return db
    .select({
      name: summaryRepNameCol,
      orders: summaryOrderCount,
      revenue: summaryRevenueSum,
    })
    .from(orderSummary)
    .where(orderSummaryRevenueWhere(f))
    .groupBy(orderSummary.salesPerson)
    .orderBy(sql`3 desc`)
    .limit(limit);
}

export async function getStateSales(
  f: Filters,
  limit = 5,
): Promise<{ state: string; revenue: number }[]> {
  const rows = await db
    .select({
      state: sql<string>`coalesce(nullif(${orderLines.shipState}, ''), 'Unknown')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(limit);
  return rows;
}

export async function getCitySales(
  f: Filters,
  limit = 6,
): Promise<{ city: string; revenue: number }[]> {
  const rows = await db
    .select({
      city: sql<string>`coalesce(nullif(${orderLines.shipCity}, ''), 'Unknown')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(limit);
  return rows;
}
