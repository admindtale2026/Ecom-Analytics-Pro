import { inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cityGeo, orderLines, pincodeGeo } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere } from "./base";

/**
 * One plotted order for the Customer Atlas. Positioned at its pincode centroid
 * when `ship_zip` is a valid 6-digit pincode we have on file, else at its city
 * centroid. `amount` is the order's line-item total (matches the choropleth map
 * in `geo.ts`, so bubble revenues sum to the atlas KPI total).
 */
export type AtlasPoint = {
  lat: number;
  lng: number;
  city: string;
  state: string;
  amount: number;
  ymd: string; // order date, YYYY-MM-DD
  ptypes: string[]; // product types — drives the category chips
  pnames: string[]; // product names — drives the detail-panel "top products"
};

export type AtlasData = {
  points: AtlasPoint[];
  /** Revenue we couldn't place (no pincode and no city coordinate). Never dropped silently. */
  unplaced: { city: string; state: string; revenue: number }[];
};

/** `ship_zip` normalised to a valid 6-digit pincode, or NULL. */
const VALID_PIN = sql<
  string | null
>`case when trim(${orderLines.shipZip}) ~ '^[1-9][0-9]{5}$' then trim(${orderLines.shipZip}) end`;

/**
 * Small deterministic offset (~<1km) keyed off the order id, so many orders in
 * one pincode scatter for legibility instead of stacking on a single dot. Same
 * order always lands in the same spot, so the map is stable across renders.
 */
const JITTER_DEG = 0.008;
function jitterFor(key: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  const a = (u % 1000) / 1000;
  const b = (Math.floor(u / 1000) % 1000) / 1000;
  return [(a - 0.5) * 2 * JITTER_DEG, (b - 0.5) * 2 * JITTER_DEG];
}

function splitList(s: string | null): string[] {
  return s ? s.split(";").filter(Boolean) : [];
}

/**
 * Order-level points for the atlas, one per order, under the current global
 * filters (store, salesperson, date). Orders are aggregated first, then geocoded
 * against `pincode_geo` (fallback `city_geo`) in JS — no coordinate join widens
 * the aggregate, so the revenue sum stays exact.
 */
export async function getAtlasPoints(f: Filters): Promise<AtlasData> {
  const rows = await db
    .select({
      orderId: orderLines.orderId,
      amount: sql<number>`coalesce(sum(${orderLines.paymentAmount}),0)`,
      city: sql<string>`max(coalesce(nullif(trim(${orderLines.shipCity}),''),'Unknown'))`,
      state: sql<string>`max(coalesce(nullif(trim(${orderLines.shipState}),''),'Unknown'))`,
      zip: sql<string | null>`max(${VALID_PIN})`,
      ymd: sql<string>`to_char(min(${orderLines.orderDate}),'YYYY-MM-DD')`,
      ptypes: sql<string | null>`string_agg(distinct nullif(trim(${orderLines.productType}),''), ';')`,
      pnames: sql<string | null>`string_agg(distinct nullif(trim(${orderLines.productName}),''), ';')`,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(orderLines.orderId);

  // Resolve coordinates without join fan-out: pincode centroids for the zips we
  // saw, plus the whole (small) city table for the fallback.
  const zips = [...new Set(rows.map((r) => r.zip).filter((z): z is string => !!z))];
  const [pinRows, cityRows] = await Promise.all([
    zips.length
      ? db.select().from(pincodeGeo).where(inArray(pincodeGeo.pincode, zips))
      : Promise.resolve([]),
    db.select().from(cityGeo),
  ]);
  const pinMap = new Map(pinRows.map((p) => [p.pincode, p]));
  const cityMap = new Map<string, { lat: number; lng: number }>();
  for (const c of cityRows) {
    cityMap.set(`${c.city}|${c.state}`, c);
    if (!cityMap.has(c.city)) cityMap.set(c.city, c); // loose fallback on city name alone
  }

  const points: AtlasPoint[] = [];
  const unplaced = new Map<string, { city: string; state: string; revenue: number }>();

  for (const r of rows) {
    const amount = Number(r.amount);
    const pin = r.zip ? pinMap.get(r.zip) : undefined;
    const base = pin ?? cityMap.get(`${r.city}|${r.state}`) ?? cityMap.get(r.city);
    if (!base) {
      const key = `${r.city}|${r.state}`;
      const u = unplaced.get(key) ?? { city: r.city, state: r.state, revenue: 0 };
      u.revenue += amount;
      unplaced.set(key, u);
      continue;
    }

    const [dlat, dlng] = jitterFor(r.orderId);
    points.push({
      lat: base.lat + dlat,
      lng: base.lng + dlng,
      city: r.city,
      state: r.state,
      amount,
      ymd: r.ymd,
      ptypes: splitList(r.ptypes),
      pnames: splitList(r.pnames),
    });
  }

  return {
    points,
    unplaced: [...unplaced.values()].sort((a, b) => b.revenue - a.revenue),
  };
}
