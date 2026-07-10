/**
 * Generates a realistic furniture-retail dataset so the whole app is testable
 * without live data. Deterministic (seeded RNG) => reproducible dashboards.
 * Run with: npm run db:seed  (safe to re-run; it truncates first)
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import type { InferInsertModel } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "./client";
import {
  orderLines,
  orderSummary,
  customers,
  users,
  cityGeo,
  dataSources,
  schemaMappings,
  settings,
  type NewOrderLine,
} from "./schema";
import {
  GEO,
  SALESPEOPLE,
  PRODUCT_TYPES,
  productName,
  FABRICS,
  POLISH,
  PAYMENT_TYPES,
  STATUSES_WEIGHTED,
  BUSINESS_CUSTOMERS,
  FIRST_NAMES,
  LAST_NAMES,
} from "./seed-data";
import { STORES } from "../lib/constants";
import { CANONICAL_FIELDS } from "../lib/ingest/mapping";

// ---- seeded RNG (mulberry32) ---------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

function weightedPick<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[0][0];
}

const geoWeighted: [(typeof GEO)[number], number][] = GEO.map((g) => [g, g.weight]);
const typeWeighted: [string, number][] = Object.entries(PRODUCT_TYPES).map(
  ([t, [, , w]]) => [t, w],
);

// Build a customer pool (some are repeat businesses).
type Cust = {
  name: string;
  email: string | null;
  mobile: string | null;
  geo: (typeof GEO)[number];
  business: boolean;
};
function buildCustomers(): Cust[] {
  const list: Cust[] = [];
  for (const b of BUSINESS_CUSTOMERS) {
    list.push({
      name: b,
      email: `${b.split(" ")[0].toLowerCase()}@gmail.com`,
      mobile: rand() < 0.6 ? `9${randInt(100000000, 999999999)}` : null,
      geo: weightedPick(geoWeighted),
      business: true,
    });
  }
  for (let i = 0; i < 300; i++) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const name = `${fn} ${ln}`;
    const hasEmail = rand() < 0.85;
    const hasMobile = rand() < 0.8;
    list.push({
      name,
      email: hasEmail ? `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(1, 99)}@gmail.com` : null,
      mobile: hasMobile ? `${randInt(6, 9)}${randInt(100000000, 999999999)}` : null,
      geo: weightedPick(geoWeighted),
      business: false,
    });
  }
  return list;
}

// Date generator: Apr 1 – Jul 3 2026, with an end-of-June spike.
function randomOrderDate(): Date {
  const start = new Date("2026-04-01").getTime();
  const end = new Date("2026-07-03").getTime();
  // bias toward later dates + a spike window
  let r = rand();
  if (rand() < 0.18) r = 0.9 + rand() * 0.1; // spike near end of June
  const t = start + r * (end - start);
  return new Date(t);
}

function identityKey(c: Cust): string {
  return `${(c.email ?? "").toLowerCase()}|${c.mobile ?? ""}`;
}

async function main() {
  console.log("Seeding… (driver:", process.env.DATABASE_URL ? "postgres" : "pglite", ")");

  // Clear
  await db.delete(orderLines);
  await db.delete(orderSummary);
  await db.delete(customers);
  await db.delete(users);
  await db.delete(cityGeo);
  await db.delete(dataSources);
  await db.delete(schemaMappings);
  await db.delete(settings);

  // city_geo
  await db.insert(cityGeo).values(
    GEO.map((g) => ({ city: g.city, state: g.state, lat: g.lat, lng: g.lng })),
  );

  // users (login). Password for all demo users: "password"
  const hash = await bcrypt.hash("password", 10);
  await db.insert(users).values([
    { name: "Joju", email: "admin@dtalemodern.com", passwordHash: hash, role: "admin", storeAccess: "modern,homes,decor" },
    { name: "Anjana", email: "anjana@dtalemodern.com", passwordHash: hash, role: "admin", storeAccess: "modern,homes,decor" },
    { name: "Lijith Nair", email: "lijith.nair@dtaledecor.com", passwordHash: hash, role: "sales", storeAccess: "decor" },
    { name: "Sourav", email: "sourav@dtale.com", passwordHash: hash, role: "admin", storeAccess: "modern,homes,decor" },
  ]);

  // data sources + schema mapping (identity mapping) + settings
  await db.insert(dataSources).values(
    STORES.map((s) => ({
      storeId: s.id,
      kind: "sheets" as const,
      endpointUrl:
        "https://docs.google.com/spreadsheets/d/1YBezRHcgSBEF4ZpOEihIsktz3TVTgWIkGtUnoTri6J4/edit?usp=sharing",
      lastSyncedAt: new Date(),
      lastSyncMode: "delta",
      rowCount: 0,
    })),
  );
  // default 1:1 schema mapping for the Modern store
  await db.insert(schemaMappings).values(
    CANONICAL_FIELDS.map((f) => ({
      storeId: "modern",
      canonicalField: f.key,
      sourceColumn: f.defaultColumn,
    })),
  );
  await db.insert(settings).values([
    { key: "identity_match_mode", value: "both" },
    { key: "sync_cadence_minutes", value: "30" },
  ]);

  // Orders
  const custPool = buildCustomers();
  const storeOrderCounts: Record<string, number> = { modern: 373, homes: 210, decor: 180 };
  const lines: NewOrderLine[] = [];
  const summaries: (typeof orderSummary.$inferInsert)[] = [];
  const custAgg = new Map<
    string,
    { c: Cust; storeId: string; orders: number; units: number; spend: number; first: Date; last: Date }
  >();

  let orderNo = 8000;
  for (const store of STORES) {
    const count = storeOrderCounts[store.id];
    for (let i = 0; i < count; i++) {
      orderNo += 1;
      const orderId = `#${orderNo}`;
      const date = randomOrderDate();
      // business customers order more often
      const cust = rand() < 0.14 ? pick(custPool.filter((c) => c.business)) : pick(custPool);
      const geo = cust.geo;
      const sales = pick(SALESPEOPLE);
      const status = weightedPick(STATUSES_WEIGHTED);
      const nLines = randInt(1, 3);
      let orderTotal = 0;
      let orderUnits = 0;

      for (let l = 0; l < nLines; l++) {
        const type = weightedPick(typeWeighted);
        const [minP, maxP] = PRODUCT_TYPES[type];
        const unit = randInt(minP, maxP);
        // qty: mostly 1-3, occasional bulk order (interior projects)
        const qty = cust.business && rand() < 0.4 ? randInt(6, 30) : randInt(1, 3);
        const amount = unit * qty;
        orderTotal += amount;
        orderUnits += qty;

        lines.push({
          storeId: store.id,
          orderId,
          invoiceNo: `INV-${orderNo}-${l + 1}`,
          orderDate: date,
          productName: productName(type, rand),
          productCategory: type,
          productType: type,
          sku: `${type.slice(0, 3).toUpperCase()}-${randInt(1000, 9999)}`,
          quantity: qty,
          paymentAmount: amount,
          status,
          shipCity: geo.city,
          shipState: geo.state,
          shipCountry: "India",
          shipCustomerName: cust.name,
          shipEmail: cust.email,
          shipMobile: cust.mobile,
          shipAddress: `${randInt(1, 200)}, ${geo.city}`,
          shipZip: String(randInt(100000, 899999)),
          salesPerson: sales,
          imageUrl: null,
          fabric: pick(FABRICS),
          dimension: `${randInt(60, 240)}x${randInt(60, 120)}x${randInt(40, 110)} cm`,
          polishFinish: pick(POLISH),
          committedDeliveryDate: new Date(date.getTime() + 12 * 864e5),
          dispatchedDate: status === "Dispatched" || status === "Delivered" ? new Date(date.getTime() + 3 * 864e5) : null,
          extendedDate: null,
          trackingNumber: status === "Dispatched" || status === "Delivered" ? `TRK${randInt(100000, 999999)}` : null,
          remarks: null,
          paymentType: pick(PAYMENT_TYPES),
          billingCustomerName: cust.name,
          billAddress: `${randInt(1, 200)}, ${geo.city}`,
          billCity: geo.city,
          billState: geo.state,
          billCountry: "India",
          billZip: String(randInt(100000, 899999)),
          billMobile: cust.mobile,
          billEmail: cust.email,
          source: "sheets",
          syncBatchId: "seed",
        });
      }

      summaries.push({
        storeId: store.id,
        orderId,
        orderDate: date,
        customerName: cust.name,
        paymentAmount: orderTotal,
        salesPerson: sales,
        source: "sheets",
      });

      // customer aggregate (identity dedup within a store)
      const key = `${store.id}:${identityKey(cust)}`;
      const prev = custAgg.get(key);
      if (prev) {
        prev.orders += 1;
        prev.units += orderUnits;
        prev.spend += orderTotal;
        if (date < prev.first) prev.first = date;
        if (date > prev.last) prev.last = date;
      } else {
        custAgg.set(key, { c: cust, storeId: store.id, orders: 1, units: orderUnits, spend: orderTotal, first: date, last: date });
      }
    }

    // "Not Processed": summary-only orders with no line items (per store)
    const notProcessed = store.id === "modern" ? 78 : store.id === "homes" ? 34 : 22;
    for (let i = 0; i < notProcessed; i++) {
      orderNo += 1;
      const cust = pick(custPool);
      summaries.push({
        storeId: store.id,
        orderId: `#${orderNo}`,
        orderDate: randomOrderDate(),
        customerName: cust.name,
        paymentAmount: 0,
        salesPerson: pick(SALESPEOPLE),
        source: "sheets",
      });
    }
  }

  // customers table
  const custRows = [...custAgg.values()].map((v) => ({
    storeId: v.storeId,
    name: v.c.name,
    email: v.c.email,
    mobile: v.c.mobile,
    identityKey: identityKey(v.c),
    orderCount: v.orders,
    unitsBought: v.units,
    totalSpend: v.spend,
    firstOrderDate: v.first,
    lastOrderDate: v.last,
    isRepeat: v.orders > 1,
  }));

  // batched inserts (PGlite is happiest with modest batches)
  async function insertBatched<T extends PgTable>(
    table: T,
    rows: InferInsertModel<T>[],
    size = 400,
  ) {
    for (let i = 0; i < rows.length; i += size) {
      await db.insert(table).values(rows.slice(i, i + size));
    }
  }
  await insertBatched(orderLines, lines);
  await insertBatched(orderSummary, summaries);
  await insertBatched(customers, custRows);

  console.log(`✓ Seeded ${lines.length} order lines, ${summaries.length} summaries, ${custRows.length} customers.`);
  console.log("  Login: admin@dtalemodern.com / password");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
