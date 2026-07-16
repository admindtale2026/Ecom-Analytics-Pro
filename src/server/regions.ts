import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount, repNameCol } from "./base";
import { safeDivide } from "@/lib/utils";

const stateCol = sql<string>`coalesce(nullif(trim(${orderLines.shipState}), ''), 'Unknown')`;
const cityCol = sql<string>`coalesce(nullif(trim(${orderLines.shipCity}), ''), 'Unknown')`;

function stateWhere(f: Filters, state: string): SQL {
  return and(orderLineWhere(f), eq(stateCol, state)) as SQL;
}
function cityWhere(f: Filters, city: string): SQL {
  return and(orderLineWhere(f), eq(cityCol, city)) as SQL;
}

export type PlaceRow = {
  name: string;
  orders: number;
  units: number;
  revenue: number;
  aov: number;
};

function toPlace(r: { name: string; orders: number; units: number; revenue: number }): PlaceRow {
  const revenue = Number(r.revenue);
  const orders = Number(r.orders);
  return { name: r.name, orders, units: Number(r.units), revenue, aov: safeDivide(revenue, orders) };
}

export async function getStates(f: Filters): Promise<PlaceRow[]> {
  const rows = await db
    .select({ name: stateCol, orders: orderCount, units: unitsSum, revenue: revenueSum })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`);
  return rows.map(toPlace);
}

export async function getCities(f: Filters): Promise<(PlaceRow & { state: string })[]> {
  const rows = await db
    .select({
      name: cityCol,
      state: sql<string>`max(coalesce(nullif(trim(${orderLines.shipState}), ''), 'Unknown'))`,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`5 desc`);
  return rows.map((r) => ({ ...toPlace(r), state: r.state }));
}

/** Headline tiles for the Regions overview. */
export async function getRegionHeadline(f: Filters) {
  const [states, cities] = await Promise.all([getStates(f), getCities(f)]);
  const totalRevenue = states.reduce((s, r) => s + r.revenue, 0);
  const markets = cities.length;
  return {
    dominantState: states[0] ?? null,
    topCity: cities[0] ?? null,
    activeMarkets: markets,
    avgMarketValue: safeDivide(totalRevenue, markets),
  };
}

export type PlaceDetail = {
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  uniqueCustomers: number;
};

async function placeDetail(where: SQL): Promise<PlaceDetail> {
  const [row] = await db
    .select({
      revenue: revenueSum,
      orders: orderCount,
      units: unitsSum,
      uniqueCustomers: sql<number>`count(distinct coalesce(nullif(lower(trim(${orderLines.shipEmail})), ''), nullif(trim(${orderLines.shipMobile}), ''), nullif(lower(trim(${orderLines.shipCustomerName})), '')))`,
    })
    .from(orderLines)
    .where(where);
  const revenue = Number(row?.revenue ?? 0);
  const orders = Number(row?.orders ?? 0);
  return {
    revenue,
    orders,
    units: Number(row?.units ?? 0),
    aov: safeDivide(revenue, orders),
    uniqueCustomers: Number(row?.uniqueCustomers ?? 0),
  };
}

export const getStateDetail = (f: Filters, state: string) => placeDetail(stateWhere(f, state));
export const getCityDetail = (f: Filters, city: string) => placeDetail(cityWhere(f, city));

/** Top cities inside one state. */
export async function getCitiesInState(f: Filters, state: string, limit = 6) {
  const rows = await db
    .select({ name: cityCol, orders: orderCount, units: unitsSum, revenue: revenueSum })
    .from(orderLines)
    .where(stateWhere(f, state))
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`)
    .limit(limit);
  return rows.map(toPlace);
}

/**
 * Rep leaderboard scoped to a state or a city.
 *
 * Line-side on purpose, unlike the store-wide board in sales-team.ts: geography
 * exists only on order_lines, so a per-place rep total can only be built here.
 * It will not reconcile with the Dashboard — orders still absent from
 * OrderDetails have no place to be counted in — and that is correct, not a bug
 * to be "fixed" by pointing it at order_summary.
 */
async function repsIn(where: SQL, limit: number) {
  const rows = await db
    .select({
      name: repNameCol,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(where)
    .groupBy(sql`1`)
    .orderBy(sql`4 desc`)
    .limit(limit);
  return rows.map(toPlace);
}

export const getRepsInState = (f: Filters, state: string, limit = 6) =>
  repsIn(stateWhere(f, state), limit);
export const getRepsInCity = (f: Filters, city: string, limit = 6) =>
  repsIn(cityWhere(f, city), limit);

/** Product-type mix (donut) for a state or city. */
async function typeMixIn(where: SQL, limit: number) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(nullif(${orderLines.productType}, ''), 'Unknown')`,
      value: revenueSum,
    })
    .from(orderLines)
    .where(where)
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(limit);
  return rows.map((r) => ({ label: r.label, value: Number(r.value) }));
}

export const getTypeMixInState = (f: Filters, state: string, limit = 6) =>
  typeMixIn(stateWhere(f, state), limit);
export const getTypeMixInCity = (f: Filters, city: string, limit = 6) =>
  typeMixIn(cityWhere(f, city), limit);

export type PlaceProduct = {
  name: string;
  productType: string | null;
  orders: number;
  units: number;
  revenue: number;
};

async function productsIn(where: SQL, limit: number): Promise<PlaceProduct[]> {
  const rows = await db
    .select({
      name: sql<string>`coalesce(nullif(${orderLines.productName}, ''), 'Unnamed product')`,
      productType: sql<string | null>`max(${orderLines.productType})`,
      orders: orderCount,
      units: unitsSum,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(where)
    .groupBy(sql`1`)
    .orderBy(sql`5 desc`)
    .limit(limit);
  return rows.map((r) => ({
    name: r.name,
    productType: r.productType,
    orders: Number(r.orders),
    units: Number(r.units),
    revenue: Number(r.revenue),
  }));
}

export const getProductsInState = (f: Filters, state: string, limit = 40) =>
  productsIn(stateWhere(f, state), limit);
export const getProductsInCity = (f: Filters, city: string, limit = 10) =>
  productsIn(cityWhere(f, city), limit);

/** Daily revenue inside a city, for its sales-trend sparkline. */
export async function getCityTrend(f: Filters, city: string) {
  const rows = await db
    .select({
      date: sql<string>`to_char(${orderLines.orderDate}, 'YYYY-MM-DD')`,
      revenue: revenueSum,
    })
    .from(orderLines)
    .where(cityWhere(f, city))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.filter((r) => r.date).map((r) => ({ date: r.date, revenue: Number(r.revenue) }));
}

/** Repeat-buyer insight for a city. */
export async function getCityCustomerInsight(f: Filters, city: string) {
  const rows = await db
    .select({
      key: sql<string>`coalesce(nullif(lower(trim(${orderLines.shipEmail})), ''), nullif(trim(${orderLines.shipMobile}), ''), nullif(lower(trim(${orderLines.shipCustomerName})), ''))`,
      orders: orderCount,
    })
    .from(orderLines)
    .where(cityWhere(f, city))
    .groupBy(sql`1`);
  const known = rows.filter((r) => r.key);
  const repeat = known.filter((r) => Number(r.orders) > 1).length;
  return {
    totalCustomers: known.length,
    repeatCustomers: repeat,
    repeatRate: safeDivide(repeat, known.length) * 100,
  };
}
