import { revalidatePath, revalidateTag } from "next/cache";
import { STORES, type StoreId } from "@/lib/constants";
import { dataTag } from "@/server/cache-tags";
import { getCurrentUser } from "@/lib/session";
import { resolveMapping } from "@/server/admin";
import { parseWorkbook } from "@/lib/ingest/workbook";
import { ingestOrderLines, ingestOrderSummary, newBatchId } from "@/lib/ingest/pipeline";

// node:crypto, xlsx and the Postgres/PGlite driver are all server-only.
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Admin › Dataset Connection › Native Upload.
 *
 * Shares the whole write path with the Google Sheets sync — this handler only
 * turns a file into raw rows and then hands off to `ingestOrderLines`.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return Response.json({ error: "Admins only." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const storeParam = String(form.get("store") ?? "");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file supplied." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File is ${(file.size / 1e6).toFixed(1)}MB; the limit is 25MB.` },
      { status: 413 },
    );
  }
  if (!STORES.some((s) => s.id === storeParam)) {
    return Response.json({ error: `Unknown store "${storeParam}".` }, { status: 400 });
  }
  const storeId = storeParam as StoreId;

  let workbook;
  try {
    workbook = parseWorkbook(await file.arrayBuffer());
  } catch (err) {
    // A corrupt or non-spreadsheet upload is a user error, not a server fault.
    return Response.json(
      { error: `Could not read that file: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!workbook.lines.length) {
    return Response.json(
      { error: `No data rows found. Sheets seen: ${workbook.sheetNames.join(", ") || "none"}.` },
      { status: 400 },
    );
  }

  const mapping = await resolveMapping(storeId);
  const batchId = newBatchId();

  const lines = await ingestOrderLines(storeId, workbook.lines, mapping, {
    source: "upload",
    syncBatchId: batchId,
  });
  const summary = workbook.summary
    ? await ingestOrderSummary(storeId, workbook.summary, { source: "upload", mode: "full" })
    : null;

  // Every page reads this store's data; blow the whole cache for it.
  revalidateTag(dataTag(storeId), "max");
  revalidatePath("/", "layout");

  return Response.json({ store: storeId, batchId, lines, summary });
}
