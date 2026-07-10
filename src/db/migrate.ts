/**
 * Applies generated SQL migrations to whichever driver is active.
 * Run with: npm run db:migrate
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  const migrationsFolder = "./drizzle";

  if (url) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1 });
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    await client.end();
    console.log("✓ Migrated managed Postgres");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(process.env.PGLITE_DIR || ".pglite");
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    console.log("✓ Migrated local PGlite (.pglite)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
