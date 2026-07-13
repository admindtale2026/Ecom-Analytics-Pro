import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dataSources } from "@/db/schema";
import { STORES, type StoreId } from "@/lib/constants";
import { dataTag } from "@/server/cache-tags";
import { getCurrentUser } from "@/lib/session";
import { resolveMapping } from "@/server/admin";
import { fetchStoreWorkbook, isSheetsConfigured } from "@/lib/ingest/sheets";
import {
  dropStaleBatches,
  ingestOrderLines,
  ingestOrderSummary,
  newBatchId,
} from "@/lib/ingest/pipeline";

export const runtime = "nodejs";
// Reading a large sheet and upserting it comfortably outruns the 10s default.
export const maxDuration = 300;

export type SyncMode = "delta" | "full";

/**
 * Two callers, one code path:
 *  - Vercel Cron sends `Authorization: Bearer $CRON_SECRET` (delta hourly, full nightly).
 *  - The Admin panel's Delta/Full Sync buttons post as a signed-in admin.
 *
 * Delta upserts on (store_id, row_hash), so running it twice changes nothing.
 * Full writes a fresh batch id and then deletes every line not in that batch,
 * which is the only way an upstream deletion propagates.
 */
async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  // Without a CRON_SECRET the scheduled (session-less) cron can't authenticate,
  // so nightly/hourly syncs silently stop. Surface it rather than fail open —
  // the admin path below still requires a real admin, so this is never a hole.
  if (process.env.NODE_ENV === "production" && !secret) {
    console.warn("CRON_SECRET is unset — scheduled /api/sync calls will be rejected.");
  }
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  const user = await getCurrentUser();
  return user.role === "admin";
}

async function runSync(storeId: StoreId, mode: SyncMode) {
  const workbook = await fetchStoreWorkbook(storeId);
  if (!workbook.lines.length) {
    throw Object.assign(
      new Error(`Sheet detail tab has no data rows for "${storeId}".`),
      { status: 422 },
    );
  }

  // Admin-editable mapping, then the manifest's per-store header patches on top
  // (e.g. Modern dates its detail rows "Order Placed Date Time").
  const mapping = { ...(await resolveMapping(storeId)), ...(workbook.store.mappingOverrides ?? {}) };
  const batchId = newBatchId();

  const lines = await ingestOrderLines(storeId, workbook.lines, mapping, {
    source: "sheets",
    syncBatchId: batchId,
  });
  const summary = workbook.summary
    ? await ingestOrderSummary(storeId, workbook.summary, { source: "sheets" })
    : null;

  const dropped = mode === "full" ? await dropStaleBatches(storeId, batchId) : 0;

  await db
    .update(dataSources)
    .set({ lastSyncedAt: new Date(), lastSyncMode: mode, rowCount: lines.written })
    .where(eq(dataSources.storeId, storeId));

  return { store: storeId, mode, batchId, lines, summary, dropped };
}

async function handle(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSheetsConfigured()) {
    // Not an error condition — the app is designed to run on uploads alone.
    return Response.json(
      {
        error: "Google Sheets sync is not configured.",
        hint: "Populate SHEET_ID and STORE_SHEETS in src/lib/ingest/sheet-manifest.ts (the sheet is read over its public CSV export). Until then, use Admin › Dataset Connection › Native Upload.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const mode: SyncMode = url.searchParams.get("mode") === "full" ? "full" : "delta";
  const storeParam = url.searchParams.get("store");

  // Cron passes no store: sync every one of them.
  const targets: StoreId[] = storeParam
    ? STORES.some((s) => s.id === storeParam)
      ? [storeParam as StoreId]
      : []
    : STORES.map((s) => s.id);

  if (!targets.length) {
    return Response.json({ error: `Unknown store "${storeParam}".` }, { status: 400 });
  }

  const results = [];
  const failures = [];
  for (const storeId of targets) {
    try {
      results.push(await runSync(storeId, mode));
      // The store's data changed — drop its cached aggregates so the next
      // request recomputes. 'max' = stale-while-revalidate (Next 16 signature).
      revalidateTag(dataTag(storeId), "max");
    } catch (err) {
      // One misconfigured store must not abort the others.
      failures.push({ store: storeId, error: (err as Error).message });
    }
  }

  revalidatePath("/", "layout");

  const status = results.length ? 200 : 500;
  return Response.json({ mode, results, failures }, { status });
}

export const GET = handle; // Vercel Cron issues GET
export const POST = handle; // Admin buttons post
