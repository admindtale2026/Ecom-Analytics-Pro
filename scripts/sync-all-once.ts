/**
 * One-off FULL sync of all stores from the live public sheet into the current
 * database (local PGlite unless DATABASE_URL is set). Mirrors runSync() in
 * src/app/api/sync/route.ts. Read the sheet, upsert, drop stale batches.
 *
 * Loads .env.local FIRST so DATABASE_URL is honoured — otherwise it would
 * silently target the local PGlite fallback. Run with the dev server STOPPED
 * when using PGlite (single-writer):  npm run db:sync
 */
import "./_load-env"; // must precede any @/db import (see the module's note)

import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { dataSources, orderLines } from "../src/db/schema";
import { STORES, type StoreId } from "../src/lib/constants";
import { resolveMapping } from "../src/server/admin";
import { fetchStoreWorkbook } from "../src/lib/ingest/sheets";
import {
  dropStaleBatches,
  ingestOrderLines,
  ingestOrderSummary,
  newBatchId,
} from "../src/lib/ingest/pipeline";
import { sql } from "drizzle-orm";

async function runSync(storeId: StoreId) {
  const workbook = await fetchStoreWorkbook(storeId);
  if (!workbook.lines.length) {
    console.log(`  ${storeId}: detail tab has no rows — skipped`);
    return;
  }
  const mapping = { ...(await resolveMapping(storeId)), ...(workbook.store.mappingOverrides ?? {}) };
  const batchId = newBatchId();
  const lines = await ingestOrderLines(storeId, workbook.lines, mapping, {
    source: "sheets",
    syncBatchId: batchId,
  });
  const summary = workbook.summary
    ? await ingestOrderSummary(storeId, workbook.summary, { source: "sheets", mode: "full" })
    : null;
  const dropped = await dropStaleBatches(storeId, batchId);
  await db
    .update(dataSources)
    .set({ lastSyncedAt: new Date(), lastSyncMode: "full", rowCount: lines.written })
    .where(eq(dataSources.storeId, storeId));

  console.log(
    `  ${storeId}: lines read ${lines.read}, written ${lines.written}, skipped ${lines.skipped}` +
      (summary ? `, summary ${summary.written}` : "") +
      `, dropped stale ${dropped}`,
  );
}

async function main() {
  for (const s of STORES) {
    console.log(`\nSyncing ${s.id}…`);
    try {
      await runSync(s.id);
    } catch (e) {
      console.error(`  ${s.id}: FAILED — ${(e as Error).message}`);
    }
  }

  const [cov] = await db
    .select({
      min: sql<string>`to_char(min(order_date), 'YYYY-MM-DD')`,
      max: sql<string>`to_char(max(order_date), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)`,
    })
    .from(orderLines);
  console.log(`\norder_lines coverage: ${cov.n} rows | ${cov.min} → ${cov.max}`);

  const perMonth = await db
    .select({
      m: sql<string>`to_char(order_date, 'YYYY-MM')`,
      n: sql<number>`count(*)`,
    })
    .from(orderLines)
    .where(sql`store_id = 'modern' and order_date < '2026-01-01'`)
    .groupBy(sql`to_char(order_date, 'YYYY-MM')`)
    .orderBy(sql`to_char(order_date, 'YYYY-MM')`);
  console.log(`modern 2025 months: ${perMonth.map((r) => `${r.m}:${r.n}`).join("  ")}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
