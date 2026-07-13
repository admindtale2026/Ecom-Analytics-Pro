import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount, repNameCol } from "./base";
import { safeDivide } from "@/lib/utils";

export type Kpis = {
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  revenueDelta: number | null;
  ordersDelta: number | null;
};

function prevWindow(f: Filters): SQL | null {
  if (!f.from || !f.to) return null;
  const span = f.to.getTime() - f.from.getTime();
  const prevTo = new Date(f.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  const conds: SQL[] = [
    eq(orderLines.storeId, f.storeId),
    gte(orderLines.orderDate, prevFrom),
    lte(orderLines.orderDate, prevTo),
  ];
  if (f.salespeople.length) conds.push(inArray(orderLines.salesPerson, f.salespeople));
  return and(...conds) as SQL;
}

export async function getKpis(f: Filters): Promise<Kpis> {
  // Current and previous-period aggregates are independent, so fire them in one
  // round-trip window instead of serially (halves the latency of this call —
  // it matters most when compute and DB are far apart).
  const pw = prevWindow(f);
  const [[cur], prevRows] = await Promise.all([
    db
      .select({ revenue: revenueSum, units: unitsSum, orders: orderCount })
      .from(orderLines)
      .where(orderLineWhere(f)),
    pw
      ? db.select({ revenue: revenueSum, orders: orderCount }).from(orderLines).where(pw)
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
    units: cur.units,
    aov: safeDivide(cur.revenue, cur.orders),
    revenueDelta,
    ordersDelta,
  };
}

export async function getDailyRevenue(f: Filters): Promise<{ date: string; revenue: number }[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${orderLines.orderDate}, 'YYYY-MM-DD')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
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
      name: repNameCol,
      orders: orderCount,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(orderLines.salesPerson)
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
