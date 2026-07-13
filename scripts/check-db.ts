import "./_load-env";
import { sql } from "drizzle-orm";
import { db, usingPglite } from "../src/db/client";

async function main() {
  const url = process.env.DATABASE_URL || "";
  const host = url.replace(/^postgres(ql)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`DATABASE_URL set: ${Boolean(url)}`);
  console.log(`host: ${host || "(none — PGlite)"}`);
  console.log(`driver: ${usingPglite ? "PGlite (local)" : "postgres-js (Neon)"}`);
  const r = await db.execute(
    sql.raw(
      "select (select count(*)::int from users) as users, (select count(*)::int from order_lines) as lines, (select to_char(min(order_date),'YYYY-MM-DD') from order_lines) as min_date, (select to_char(max(order_date),'YYYY-MM-DD') from order_lines) as max_date",
    ),
  );
  const rows = (r as unknown as { rows?: unknown[] }).rows ?? (r as unknown as unknown[]);
  console.log("live query:", JSON.stringify(Array.isArray(rows) ? rows[0] : rows));
  process.exit(0);
}
main().catch((e) => {
  console.error("CONNECTION FAILED:", (e as Error).message);
  process.exit(1);
});
