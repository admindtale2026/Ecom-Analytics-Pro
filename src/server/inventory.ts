import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount, repNameCol, cityNameCol, stateNameCol } from "./base";
import { safeDivide } from "@/lib/utils";

const nameCol = sql<string>`coalesce(nullif(${orderLines.productName}, ''), 'Unnamed product')`;

function productWhere(f: Filters, name: string): SQL {
  return and(orderLineWhere(f), eq(nameCol, name)) as SQL;
}

export type ProductListRow = {
  name: string;
  imageUrl: string | null;
  category: string | null;
  sku: string | null;
  orders: number;
  units: number;
  revenue: number;
  avgPrice: number;
};

/** The Products table: one row per product name, ranked by revenue. */
export async function getProducts(
  f: Filters,
  opts: { q?: string; category?: string; limit?: number } = {},
): Promise<ProductListRow[]> {
  const conds: SQL[] = [orderLineWhere(f)];
  if (opts.category) conds.push(eq(orderLines.productCategory, opts.category));
  if (opts.q) {
    const term = `%${opts.q}%`;
    conds.push(or(ilike(orderLines.productName, term), ilike(orderLines.sku, term)) as SQL);
  }

  const rows = await db
    .select({
      name: nameCol,
      imageUrl: sql<string | null>`max(${orderLines.imageUrl})`,
      category: sql<string | null>`max(${orderLines.productCategory})`,
      sku: sql<string | null>`max(${orderLines.sku})`,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(and(...conds) as SQL)
    .groupBy(sql`1`)
    .orderBy(sql`7 desc`)
    .limit(opts.limit ?? 100);

  return rows.map((r) => ({
    name: r.name,
    imageUrl: r.imageUrl,
    category: r.category,
    sku: r.sku,
    orders: Number(r.orders),
    units: Number(r.units),
    revenue: Number(r.revenue),
    avgPrice: safeDivide(Number(r.revenue), Number(r.units)),
  }));
}

/** Distinct product categories in the current store, for the Filter-by select. */
export async function getProductCategories(f: Filters): Promise<string[]> {
  const rows = await db
    .selectDistinct({ c: orderLines.productCategory })
    .from(orderLines)
    .where(eq(orderLines.storeId, f.storeId))
    .orderBy(orderLines.productCategory);
  return rows.map((r) => r.c!).filter(Boolean);
}

export type ProductDetail = {
  name: string;
  imageUrl: string | null;
  category: string | null;
  sku: string | null;
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  revenueShare: number;
};

export async function getProductDetail(f: Filters, name: string): Promise<ProductDetail | null> {
  const where = productWhere(f, name);
  const [[row], [totalRow]] = await Promise.all([
    db
      .select({
        imageUrl: sql<string | null>`max(${orderLines.imageUrl})`,
        category: sql<string | null>`max(${orderLines.productCategory})`,
        sku: sql<string | null>`max(${orderLines.sku})`,
        revenue: revenueSum,
        orders: orderCount,
        units: unitsSum,
      })
      .from(orderLines)
      .where(where),
    db.select({ revenue: revenueSum }).from(orderLines).where(orderLineWhere(f)),
  ]);

  if (!row || !Number(row.orders)) return null;
  const revenue = Number(row.revenue);
  const orders = Number(row.orders);
  return {
    name,
    imageUrl: row.imageUrl,
    category: row.category,
    sku: row.sku,
    revenue,
    orders,
    units: Number(row.units),
    aov: safeDivide(revenue, orders),
    revenueShare: safeDivide(revenue, Number(totalRow?.revenue ?? 0)) * 100,
  };
}

export async function getProductTrend(f: Filters, name: string) {
  const rows = await db
    .select({
      date: sql<string>`to_char(${orderLines.orderDate}, 'YYYY-MM-DD')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(productWhere(f, name))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.filter((r) => r.date).map((r) => ({ date: r.date, revenue: Number(r.revenue) }));
}

/** Top cities / states for a single product. */
async function placesForProduct(f: Filters, name: string, col: SQL, limit: number) {
  const rows = await db
    .select({ label: sql<string>`${col}`, value: revenueSum })
    .from(orderLines)
    .where(productWhere(f, name))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(limit);
  return rows.filter((r) => r.label).map((r) => ({ label: r.label, value: Number(r.value) }));
}

export const getProductCities = (f: Filters, name: string, limit = 5) =>
  placesForProduct(f, name, cityNameCol, limit);
export const getProductStates = (f: Filters, name: string, limit = 5) =>
  placesForProduct(f, name, stateNameCol, limit);

/** Which reps moved this product. */
export async function getProductReps(f: Filters, name: string) {
  const rows = await db
    .select({
      name: repNameCol,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(productWhere(f, name))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`);
  return rows.map((r) => ({
    name: r.name,
    orders: Number(r.orders),
    units: Number(r.units),
    revenue: Number(r.revenue),
  }));
}

export type MonthlyRow = {
  month: string; // YYYY-MM
  orders: number;
  units: number;
  revenue: number;
  aov: number;
};

/**
 * Month-by-month performance for a product. The window is chosen by the tabs on
 * the product page and is independent of the global date filter, so a rep can
 * compare a product's last-6-months run against a full calendar year.
 */
export async function getProductMonthly(
  f: Filters,
  name: string,
  window: "last6" | "thisYear" | "lastYear",
): Promise<MonthlyRow[]> {
  const now = new Date();
  let from: Date;
  let to: Date;
  if (window === "thisYear") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else if (window === "lastYear") {
    from = new Date(now.getFullYear() - 1, 0, 1);
    to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const rows = await db
    .select({
      month: sql<string>`to_char(${orderLines.orderDate}, 'YYYY-MM')`,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(
      and(
        eq(orderLines.storeId, f.storeId),
        eq(nameCol, name),
        sql`${orderLines.orderDate} between ${from} and ${to}`,
      ) as SQL,
    )
    .groupBy(sql`1`);

  const found = new Map(rows.map((r) => [r.month, r]));
  const out: MonthlyRow[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const r = found.get(key);
    const revenue = Number(r?.revenue ?? 0);
    const orders = Number(r?.orders ?? 0);
    out.push({
      month: key,
      orders,
      units: Number(r?.units ?? 0),
      revenue,
      aov: safeDivide(revenue, orders),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}
