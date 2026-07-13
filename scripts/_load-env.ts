/**
 * Side-effect module: load .env.local (then .env) into process.env.
 *
 * Import this FIRST — before any `@/db/*` import — because `src/db/client.ts`
 * reads DATABASE_URL eagerly at module-evaluation time. ES module imports
 * evaluate in source order, so this guarantees the env is populated before the
 * DB client decides between Neon (DATABASE_URL) and the local PGlite fallback.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();
