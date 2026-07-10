/**
 * Idempotent seed of the `city_geo` lookup that places map bubbles.
 *
 *   npm run db:seed-geo
 *
 * Safe to re-run: rows are upserted on (city, state).
 */
import "dotenv/config";
import { config } from "dotenv";
import { db } from "./client";
import { cityGeo } from "./schema";
import { CITY_COORDS } from "@/lib/geo/city-coords";

config({ path: ".env.local", override: false });

async function main() {
  console.log(`Seeding ${CITY_COORDS.length} city coordinates…`);
  for (const c of CITY_COORDS) {
    await db
      .insert(cityGeo)
      .values(c)
      .onConflictDoUpdate({
        target: [cityGeo.city, cityGeo.state],
        set: { lat: c.lat, lng: c.lng },
      });
  }
  console.log("✓ city_geo seeded");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
