import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount, repNameCol } from "./base";
import { safeDivide } from "@/lib/utils";

export type RepRow = {
  name: string;
  orders: number;
  units: number;
  revenue: number;
  aov: number;
  contribution: number;
};

/** Every rep in the filtered window, ranked by revenue, with contribution %. */
export async function getReps(f: Filters): Promise<RepRow[]> {
  const rows = await db
    .select({
      name: repNameCol,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`);

  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
  return rows.map((r) => ({
    name: r.name,
    orders: Number(r.orders),
    units: Number(r.units),
    revenue: Number(r.revenue),
    aov: safeDivide(Number(r.revenue), Number(r.orders)),
    contribution: safeDivide(Number(r.revenue), total) * 100,
  }));
}
