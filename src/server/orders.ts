import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere } from "./base";

export type OrderRow = {
  orderId: string;
  orderDate: string | null;
  userName: string | null;
  billCity: string | null;
  billState: string | null;
  totalItems: number;
  orderQuantity: number;
  paymentAmount: number;
  salesPerson: string | null;
  status: string | null;
};

export type OrdersQuery = {
  q?: string;
  state?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

function buildWhere(f: Filters, q: OrdersQuery): SQL {
  const conds: SQL[] = [orderLineWhere(f)];
  if (q.state) conds.push(eq(orderLines.shipState, q.state));
  if (q.status) conds.push(eq(orderLines.status, q.status));
  if (q.q) {
    const term = `%${q.q}%`;
    conds.push(
      or(
        ilike(orderLines.orderId, term),
        ilike(orderLines.invoiceNo, term),
        ilike(orderLines.shipCustomerName, term),
        ilike(orderLines.shipMobile, term),
      ) as SQL,
    );
  }
  return and(...conds) as SQL;
}

export async function getOrders(
  f: Filters,
  q: OrdersQuery,
): Promise<{ rows: OrderRow[]; total: number }> {
  const where = buildWhere(f, q);
  const page = Math.max(1, q.page ?? 1);
  const pageSize = q.pageSize ?? 25;

  const grouped = db
    .select({
      orderId: orderLines.orderId,
      orderDate: sql<string>`to_char(max(${orderLines.orderDate}), 'YYYY-MM-DD')`,
      userName: sql<string>`max(${orderLines.shipCustomerName})`,
      billCity: sql<string>`max(coalesce(nullif(${orderLines.billCity}, ''), ${orderLines.shipCity}))`,
      billState: sql<string>`max(coalesce(nullif(${orderLines.billState}, ''), ${orderLines.shipState}))`,
      totalItems: sql<number>`count(*)`,
      orderQuantity: sql<number>`coalesce(sum(${orderLines.quantity}),0)`,
      paymentAmount: sql<number>`coalesce(sum(${orderLines.paymentAmount}),0)`,
      salesPerson: sql<string>`max(${orderLines.salesPerson})`,
      status: sql<string>`max(${orderLines.status})`,
      sortDate: sql<Date>`max(${orderLines.orderDate})`,
    })
    .from(orderLines)
    .where(where)
    .groupBy(orderLines.orderId)
    .orderBy(sql`max(${orderLines.orderDate}) desc nulls last`)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRes = db
    .select({ n: sql<number>`count(distinct ${orderLines.orderId})` })
    .from(orderLines)
    .where(where);

  const [rows, [{ n }]] = await Promise.all([grouped, countRes]);
  return { rows: rows as OrderRow[], total: Number(n) };
}

export type OrderLineDetail = {
  productName: string | null;
  sku: string | null;
  productType: string | null;
  quantity: number;
  paymentAmount: number;
  status: string | null;
  imageUrl: string | null;
};

export type OrderDetail = {
  orderId: string;
  invoiceNo: string | null;
  orderDate: string | null;
  status: string | null;
  salesPerson: string | null;
  paymentType: string | null;
  customerName: string | null;
  email: string | null;
  mobile: string | null;
  shipAddress: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipZip: string | null;
  totalQuantity: number;
  totalPayment: number;
  lines: OrderLineDetail[];
};

/** One order with its line items, for the Orders table drill-down. */
export async function getOrderDetail(
  storeId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const rows = await db
    .select({
      invoiceNo: orderLines.invoiceNo,
      orderDate: sql<string | null>`to_char(${orderLines.orderDate}, 'YYYY-MM-DD')`,
      status: orderLines.status,
      salesPerson: orderLines.salesPerson,
      paymentType: orderLines.paymentType,
      customerName: orderLines.shipCustomerName,
      email: orderLines.shipEmail,
      mobile: orderLines.shipMobile,
      shipAddress: orderLines.shipAddress,
      shipCity: orderLines.shipCity,
      shipState: orderLines.shipState,
      shipZip: orderLines.shipZip,
      productName: orderLines.productName,
      sku: orderLines.sku,
      productType: orderLines.productType,
      quantity: orderLines.quantity,
      paymentAmount: orderLines.paymentAmount,
      imageUrl: orderLines.imageUrl,
    })
    .from(orderLines)
    .where(and(eq(orderLines.storeId, storeId), eq(orderLines.orderId, orderId)));

  if (!rows.length) return null;
  const head = rows[0];

  return {
    orderId,
    invoiceNo: head.invoiceNo,
    orderDate: head.orderDate,
    status: head.status,
    salesPerson: head.salesPerson,
    paymentType: head.paymentType,
    customerName: head.customerName,
    email: head.email,
    mobile: head.mobile,
    shipAddress: head.shipAddress,
    shipCity: head.shipCity,
    shipState: head.shipState,
    shipZip: head.shipZip,
    totalQuantity: rows.reduce((s, r) => s + Number(r.quantity), 0),
    totalPayment: rows.reduce((s, r) => s + Number(r.paymentAmount), 0),
    lines: rows.map((r) => ({
      productName: r.productName,
      sku: r.sku,
      productType: r.productType,
      quantity: Number(r.quantity),
      paymentAmount: Number(r.paymentAmount),
      status: r.status,
      imageUrl: r.imageUrl,
    })),
  };
}

/** Distinct ship-states in the current store, for the State filter. */
export async function getOrderStates(f: Filters): Promise<string[]> {
  const rows = await db
    .selectDistinct({ s: orderLines.shipState })
    .from(orderLines)
    .where(eq(orderLines.storeId, f.storeId))
    .orderBy(orderLines.shipState);
  return rows.map((r) => r.s!).filter(Boolean);
}
