/**
 * Idempotent seed of the `pincode_geo` lookup that places atlas orders at postal
 * -code granularity.
 *
 *   npm run db:seed-pincode-geo
 *
 * Reads the vendored centroid map (`src/db/data/pincode-centroids.json`, built
 * once by `scripts/build-pincode-geo.ts` from GeoNames) and upserts every
 * pincode. Batched so ~19k rows land in a handful of round trips instead of one
 * per row. Safe to re-run.
 */
// Must precede any `./client` import: the DB client reads DATABASE_URL eagerly
// at module-eval time, and ESM evaluates imported modules before this file's
// own statements — so a plain `config()` call here would run too late and the
// client would silently fall back to local PGlite.
import "../../scripts/_load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { pincodeGeo } from "./schema";

const BATCH = 1000;

async function main() {
  const file = path.join(process.cwd(), "src/db/data/pincode-centroids.json");
  const centroids = JSON.parse(readFileSync(file, "utf8")) as Record<string, [number, number]>;
  const rows = Object.entries(centroids).map(([pincode, [lat, lng]]) => ({ pincode, lat, lng }));

  console.log(`Seeding ${rows.length} pincode coordinates…`);
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db
      .insert(pincodeGeo)
      .values(chunk)
      .onConflictDoUpdate({
        target: pincodeGeo.pincode,
        set: { lat: sql`excluded.lat`, lng: sql`excluded.lng` },
      });
  }
  console.log("✓ pincode_geo seeded");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
