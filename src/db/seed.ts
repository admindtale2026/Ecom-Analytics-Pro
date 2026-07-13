/**
 * Seeds only the *reference* tables the app needs to boot — users (logins),
 * city_geo (map lookups), data_sources, schema_mappings and settings.
 *
 * It deliberately does NOT generate synthetic orders: real order history comes
 * from the live Google Sheet sync (`/api/sync`). Re-running is safe — it clears
 * order_lines / order_summary / customers too, which also wipes any stale rows
 * from an older (pre-fix) sync. Run with: npm run db:seed
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
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
} from "./schema";
import { GEO } from "./seed-data";
import { STORES } from "../lib/constants";
import { CANONICAL_FIELDS } from "../lib/ingest/mapping";

async function main() {
  console.log("Seeding reference tables… (driver:", process.env.DATABASE_URL ? "postgres" : "pglite", ")");

  // Clear. Order tables are cleared too so a re-seed drops any stale/1970 rows;
  // real order data is repopulated by a sheet sync, not here.
  await db.delete(orderLines);
  await db.delete(orderSummary);
  await db.delete(customers);
  await db.delete(users);
  await db.delete(cityGeo);
  await db.delete(dataSources);
  await db.delete(schemaMappings);
  await db.delete(settings);

  // city_geo (map lookups)
  await db.insert(cityGeo).values(
    GEO.map((g) => ({ city: g.city, state: g.state, lat: g.lat, lng: g.lng })),
  );

  // users (logins). Initial password comes from SEED_ADMIN_PASSWORD, or a random
  // one is generated and printed once — never a committed, well-known value.
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const initialPassword = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(initialPassword, 10);
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

  console.log("✓ Seeded reference tables (users, city_geo, data_sources, schema_mappings, settings).");
  console.log("  Order data is empty until a sheet sync runs (Admin → Sync, or POST /api/sync).");
  if (generated) {
    console.log(`  Initial password for all seeded users (change on first login): ${initialPassword}`);
  } else {
    console.log("  Seeded users use the password from SEED_ADMIN_PASSWORD.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
