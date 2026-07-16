import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, orderSummary } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import {
  orderLineWhere,
  unitsSum,
  repNameCol,
  orderSummaryRevenueWhere,
  summaryRevenueSum,
  summaryOrderCount,
  summaryRepNameCol,
} from "./base";
import { safeDivide } from "@/lib/utils";

export type RepRow = {
  name: string;
  orders: number;
  units: number;
  revenue: number;
  aov: number;
  contribution: number;
};

/**
 * Every rep in the filtered window, ranked by revenue, with contribution %.
 *
 * Revenue/orders come from the Order Summary tab so orders that never reached
 * OrderDetails still count; units stay on order_lines, the only place per-line
 * quantities exist — the same split as getKpis. A rep can therefore show orders
 * but no units, or units but no orders, and both are honest.
 *
 * The rep set is the union of both tabs: someone with lines but no paid summary
 * row still appears at zero revenue rather than vanishing from the leaderboard.
 */
export async function getReps(f: Filters): Promise<RepRow[]> {
  // Neither query can rank the merged list — the summary side can't see
  // line-only reps and the line side has no revenue — so both come back
  // unordered and sorting happens once, below.
  const [money, units] = await Promise.all([
    db
      .select({ name: summaryRepNameCol, orders: summaryOrderCount, revenue: summaryRevenueSum })
      .from(orderSummary)
      .where(orderSummaryRevenueWhere(f))
      .groupBy(sql`1`),
    db
      .select({ name: repNameCol, units: unitsSum })
      .from(orderLines)
      .where(orderLineWhere(f))
      .groupBy(sql`1`),
  ]);

  // Both sides group by the same coalesce/trim expression, so a rep's name is
  // already identical across the two result sets — the raw column is never the
  // key, which is what keeps NULL and '' from splitting into two reps.
  const byName = new Map<string, RepRow>();
  const rowFor = (name: string): RepRow => {
    let r = byName.get(name);
    if (!r) {
      r = { name, orders: 0, units: 0, revenue: 0, aov: 0, contribution: 0 };
      byName.set(name, r);
    }
    return r;
  };

  for (const m of money) {
    const r = rowFor(m.name);
    r.orders = Number(m.orders);
    r.revenue = Number(m.revenue);
  }
  for (const u of units) rowFor(u.name).units = Number(u.units);

  const total = money.reduce((s, m) => s + Number(m.revenue), 0);
  return [...byName.values()]
    .map((r) => ({
      ...r,
      aov: safeDivide(r.revenue, r.orders),
      contribution: safeDivide(r.revenue, total) * 100,
    }))
    // Revenue ranks the board; units then name break ties so the zero-revenue
    // tail holds a stable order — a rep's page derives "Rank #N" from this
    // list's index, which must not jitter between renders.
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.name.localeCompare(b.name));
}
