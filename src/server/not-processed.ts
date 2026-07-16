import { and, eq, gt, notExists, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, orderSummary } from "@/db/schema";
import { SYNTHETIC_ID_PREFIX } from "@/lib/ingest/pipeline";
import type { Filters } from "@/lib/filters";
import { orderSummaryWhere, UNATTRIBUTED } from "./base";

/**
 * A summary row whose OrderId cell was blank. `starts_with` rather than `like`:
 * `_` is a single-character wildcard to `like`, which would match other ids.
 */
const isIdentified = sql`not starts_with(${orderSummary.orderId}, ${SYNTHETIC_ID_PREFIX})`;

/**
 * "Not processed" = a paid, identified order exists in the lightweight Order
 * Summary sheet but no line items were ever written to the warehouse
 * repository, so we know the revenue but nothing about what was actually
 * bought. The sheet is edited live, so summary rows routinely arrive before
 * their detail rows and a later sync clears them from this list.
 *
 * Two kinds of summary row are excluded, neither being something an operator
 * can action: unpaid rows, which aren't sales yet; and blank-OrderId rows,
 * whose synthetic id can never match a line item — they would sit here forever
 * and inflate the trapped revenue.
 */
function backlogWhere(f: Filters): SQL {
  return and(
    orderSummaryWhere(f),
    gt(orderSummary.paymentAmount, 0),
    isIdentified,
    notExists(
      db
        .select({ one: sql`1` })
        .from(orderLines)
        .where(
          and(
            eq(orderLines.orderId, orderSummary.orderId),
            eq(orderLines.storeId, orderSummary.storeId),
          ),
        ),
    ),
  ) as SQL;
}

export type BacklogRow = {
  orderId: string;
  orderDate: string | null;
  customerName: string | null;
  salesPerson: string | null;
  paymentAmount: number;
};

export async function getBacklogTotals(
  f: Filters,
): Promise<{ orders: number; trappedRevenue: number }> {
  const [row] = await db
    .select({
      orders: sql<number>`count(*)`,
      trappedRevenue: sql<number>`coalesce(sum(${orderSummary.paymentAmount}),0)`,
    })
    .from(orderSummary)
    .where(backlogWhere(f));
  return { orders: Number(row?.orders ?? 0), trappedRevenue: Number(row?.trappedRevenue ?? 0) };
}

/** Pending count + trapped revenue per rep, ranked by revenue at risk. */
export async function getBacklogByRep(
  f: Filters,
): Promise<{ name: string; pending: number; revenue: number }[]> {
  const rows = await db
    .select({
      name: sql<string>`coalesce(nullif(trim(${orderSummary.salesPerson}), ''), ${UNATTRIBUTED})`,
      pending: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${orderSummary.paymentAmount}),0)`,
    })
    .from(orderSummary)
    .where(backlogWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`3 desc`);
  return rows.map((r) => ({ ...r, pending: Number(r.pending), revenue: Number(r.revenue) }));
}

export async function getBacklogOrders(f: Filters, rep?: string): Promise<BacklogRow[]> {
  const conds: SQL[] = [backlogWhere(f)];
  if (rep) conds.push(eq(orderSummary.salesPerson, rep));
  const rows = await db
    .select({
      orderId: orderSummary.orderId,
      orderDate: sql<string | null>`to_char(${orderSummary.orderDate}, 'YYYY-MM-DD')`,
      customerName: orderSummary.customerName,
      salesPerson: orderSummary.salesPerson,
      paymentAmount: orderSummary.paymentAmount,
    })
    .from(orderSummary)
    .where(and(...conds) as SQL)
    .orderBy(sql`${orderSummary.orderDate} desc nulls last`)
    .limit(200);
  return rows.map((r) => ({ ...r, paymentAmount: Number(r.paymentAmount) }));
}

/** Single backlog order, for the drill-down warning page. */
export async function getBacklogOrder(
  storeId: string,
  orderId: string,
): Promise<BacklogRow | null> {
  const [row] = await db
    .select({
      orderId: orderSummary.orderId,
      orderDate: sql<string | null>`to_char(${orderSummary.orderDate}, 'YYYY-MM-DD')`,
      customerName: orderSummary.customerName,
      salesPerson: orderSummary.salesPerson,
      paymentAmount: orderSummary.paymentAmount,
    })
    .from(orderSummary)
    .where(
      and(
        eq(orderSummary.storeId, storeId),
        eq(orderSummary.orderId, orderId),
        gt(orderSummary.paymentAmount, 0),
        isIdentified,
      ),
    );
  return row ? { ...row, paymentAmount: Number(row.paymentAmount) } : null;
}
