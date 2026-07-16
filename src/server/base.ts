import { and, eq, gt, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { orderLines, orderSummary } from "@/db/schema";
import type { Filters } from "@/lib/filters";

/** WHERE conditions for order_lines from the global filters. */
export function orderLineWhere(f: Filters): SQL {
  const conds: SQL[] = [eq(orderLines.storeId, f.storeId)];
  if (f.salespeople.length) conds.push(inArray(orderLines.salesPerson, f.salespeople));
  if (f.from) conds.push(gte(orderLines.orderDate, f.from));
  if (f.to) conds.push(lte(orderLines.orderDate, f.to));
  return and(...conds) as SQL;
}

/** WHERE conditions for order_summary from the global filters. */
export function orderSummaryWhere(f: Filters): SQL {
  const conds: SQL[] = [eq(orderSummary.storeId, f.storeId)];
  if (f.salespeople.length) conds.push(inArray(orderSummary.salesPerson, f.salespeople));
  if (f.from) conds.push(gte(orderSummary.orderDate, f.from));
  if (f.to) conds.push(lte(orderSummary.orderDate, f.to));
  return and(...conds) as SQL;
}

/**
 * Revenue is read from the Order Summary tab (one authoritative row per order),
 * counting only rows that actually carry a Payment Amount — blank cells are
 * prior-month / incomplete entries and are ignored.
 */
export function orderSummaryRevenueWhere(f: Filters): SQL {
  return and(orderSummaryWhere(f), gt(orderSummary.paymentAmount, 0)) as SQL;
}

/** Sum/avg helpers used across metric queries. */
export const revenueSum = sql<number>`coalesce(sum(${orderLines.paymentAmount}),0)`;
export const unitsSum = sql<number>`coalesce(sum(${orderLines.quantity}),0)`;
export const orderCount = sql<number>`count(distinct ${orderLines.orderId})`;
export const lineCount = sql<number>`count(*)`;

/**
 * Summary-side aggregates. Revenue, orders, AOV, the daily chart and salesperson
 * revenue all read from order_summary so the biggest orders — which live only on
 * that tab — are counted. One summary row = one order.
 */
export const summaryRevenueSum = sql<number>`coalesce(sum(${orderSummary.paymentAmount}),0)`;
export const summaryOrderCount = sql<number>`count(*)`;

/**
 * Orders whose sheet row carries no salesperson. The reference app labelled the
 * bucket "Unknown", which reads like a person and duly topped the leaderboard
 * on some city pages. Naming it for what it is keeps it from being mistaken for
 * a rep.
 */
export const UNATTRIBUTED = "Unattributed";

/**
 * Display name for a rep, with the blank bucket named rather than invented.
 *
 * Both tables go through one factory because getReps groups each tab separately
 * and merges the results on this name: the merge is only correct while the two
 * expressions are character-for-character identical.
 */
const repName = (col: PgColumn): SQL<string> =>
  sql<string>`coalesce(nullif(trim(${col}), ''), ${UNATTRIBUTED})`;

export const repNameCol = repName(orderLines.salesPerson);

/** Same, over order_summary — the source of truth for salesperson revenue. */
export const summaryRepNameCol = repName(orderSummary.salesPerson);

/** Place labels. Ingest normalises case/aliases, so these only fill in blanks. */
export const stateNameCol = sql<string>`coalesce(nullif(trim(${orderLines.shipState}), ''), 'Unknown')`;
export const cityNameCol = sql<string>`coalesce(nullif(trim(${orderLines.shipCity}), ''), 'Unknown')`;
