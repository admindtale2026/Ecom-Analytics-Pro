import * as schema from "./schema";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * One DB client for the whole app.
 *  - Production / any real Postgres: set DATABASE_URL (Supabase, Neon, etc.).
 *  - Local dev with no server: falls back to embedded PGlite (WASM Postgres),
 *    persisted under PGLITE_DIR (default `.pglite`). Same SQL semantics.
 *
 * The two drivers expose an identical Drizzle query API, so the rest of the
 * app is driver-agnostic. We cast to the postgres-js type purely for editor
 * intellisense.
 */
export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB };

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Lazy require keeps the pg driver out of the PGlite dev path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres");
    const client = postgres(url, { max: 1, prepare: false });
    return drizzlePg(client, { schema }) as unknown as DB;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite");
  const client = new PGlite(process.env.PGLITE_DIR || ".pglite");
  return drizzlePglite(client, { schema }) as unknown as DB;
}

export const db: DB = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export const usingPglite = !process.env.DATABASE_URL;
