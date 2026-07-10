import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, orderCount } from "./base";
import { safeDivide } from "@/lib/utils";
import type { OpportunityCity, Quadrant } from "@/lib/opportunity";

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Split cities into spend quadrants against the *median* city, not the mean —
 * a couple of runaway metros would otherwise drag the average up and push every
 * other city into "nurture".
 */
export async function getOpportunityCities(f: Filters): Promise<{
  cities: OpportunityCity[];
  medianOrders: number;
  medianAov: number;
}> {
  const rows = await db
    .select({
      city: sql<string>`coalesce(nullif(trim(${orderLines.shipCity}), ''), 'Unknown')`,
      state: sql<string>`max(coalesce(nullif(trim(${orderLines.shipState}), ''), 'Unknown'))`,
      orders: orderCount,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`);

  const base = rows.map((r) => {
    const orders = Number(r.orders);
    const revenue = Number(r.revenue);
    return { city: r.city, state: r.state, orders, revenue, aov: safeDivide(revenue, orders) };
  });

  const medianOrders = median(base.map((c) => c.orders));
  const medianAov = median(base.map((c) => c.aov));

  const cities = base.map((c) => {
    const highVolume = c.orders >= medianOrders;
    const highValue = c.aov >= medianAov;
    const quadrant: Quadrant = highValue
      ? highVolume
        ? "defend"
        : "scale"
      : highVolume
        ? "hold"
        : "nurture";
    return { ...c, quadrant };
  });

  return { cities, medianOrders, medianAov };
}
