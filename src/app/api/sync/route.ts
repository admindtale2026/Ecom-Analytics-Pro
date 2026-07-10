import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dataSources } from "@/db/schema";
import { STORES, type StoreId } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { resolveMapping } from "@/server/admin";
import { fetchWorkbook, isSheetsConfigured } from "@/lib/ingest/sheets";
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
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  const user = await getCurrentUser();
  return user.role === "admin";
}

async function runSync(storeId: StoreId, mode: SyncMode) {
  const [source] = await db.select().from(dataSources).where(eq(dataSources.storeId, storeId));
  const endpoint = source?.endpointUrl;
  if (!endpoint) {
    throw Object.assign(new Error(`No Google Sheet configured for "${storeId}".`), { status: 400 });
  }

  const workbook = await fetchWorkbook(endpoint);
  if (!workbook.lines.length) {
    throw Object.assign(
      new Error(`Sheet has no data rows. Tabs seen: ${workbook.sheetNames.join(", ") || "none"}.`),
      { status: 422 },
    );
  }

  const mapping = await resolveMapping(storeId);
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
        hint: "Set GOOGLE_SERVICE_ACCOUNT_JSON and share the sheet with that service account. Until then, use Admin › Dataset Connection › Native Upload.",
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
