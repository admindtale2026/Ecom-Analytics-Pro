import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cityGeo, orderLines } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, orderCount, cityNameCol, stateNameCol } from "./base";
import { safeDivide } from "@/lib/utils";

/** One state's revenue, for the choropleth fill. */
export type StateHeat = {
  state: string;
  orders: number;
  revenue: number;
};

/** One city, positioned. Only cities present in `city_geo` get a bubble. */
export type CityBubble = {
  city: string;
  state: string;
  lat: number;
  lng: number;
  orders: number;
  revenue: number;
  aov: number;
};

export type GeoData = {
  states: StateHeat[];
  bubbles: CityBubble[];
  /** Revenue we could not place on the map, and why. Never silently dropped. */
  unplaced: { city: string; state: string; revenue: number }[];
  maxStateRevenue: number;
  maxCityRevenue: number;
};

/**
 * Revenue by state and by geocoded city, under the current filters (store,
 * salesperson, date). Both sides go through `orderLineWhere`, so switching the
 * salesperson filter re-shades the map with no extra code.
 */
export async function getGeoData(f: Filters): Promise<GeoData> {
  const [stateRows, cityRows] = await Promise.all([
    db
      .select({ state: stateNameCol, orders: orderCount, revenue: revenueSum })
      .from(orderLines)
      .where(orderLineWhere(f))
      .groupBy(sql`1`)
      .orderBy(sql`3 desc`),

    // Left join: a city with no coordinate still returns, with null lat/lng,
    // so we can report its revenue as unplaced instead of losing it.
    db
      .select({
        city: cityNameCol,
        state: sql<string>`max(${stateNameCol})`,
        lat: sql<number | null>`max(${cityGeo.lat})`,
        lng: sql<number | null>`max(${cityGeo.lng})`,
        orders: orderCount,
        revenue: revenueSum,
      })
      .from(orderLines)
      .leftJoin(cityGeo, eq(cityGeo.city, orderLines.shipCity))
      .where(orderLineWhere(f))
      .groupBy(sql`1`)
      .orderBy(sql`6 desc`),
  ]);

  const states: StateHeat[] = stateRows.map((r) => ({
    state: r.state,
    orders: Number(r.orders),
    revenue: Number(r.revenue),
  }));

  const bubbles: CityBubble[] = [];
  const unplaced: GeoData["unplaced"] = [];

  for (const r of cityRows) {
    const revenue = Number(r.revenue);
    const orders = Number(r.orders);
    if (r.lat == null || r.lng == null) {
      unplaced.push({ city: r.city, state: r.state, revenue });
      continue;
    }
    bubbles.push({
      city: r.city,
      state: r.state,
      lat: Number(r.lat),
      lng: Number(r.lng),
      orders,
      revenue,
      aov: safeDivide(revenue, orders),
    });
  }

  return {
    states,
    bubbles,
    unplaced,
    maxStateRevenue: Math.max(1, ...states.map((s) => s.revenue)),
    maxCityRevenue: Math.max(1, ...bubbles.map((b) => b.revenue)),
  };
}
