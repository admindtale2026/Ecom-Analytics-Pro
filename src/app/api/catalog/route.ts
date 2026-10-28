import { revalidatePath, revalidateTag } from "next/cache";
import { STORES, type StoreId } from "@/lib/constants";
import { dataTag } from "@/server/cache-tags";
import { getCurrentUser } from "@/lib/session";
import { parseWorkbook } from "@/lib/ingest/workbook";
import { ingestCatalog } from "@/lib/ingest/catalog";

// xlsx and the Postgres/PGlite driver are server-only.
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Admin › Product Catalog upload.
 *
 * Accepts a Magento "Export Products" catalog and replaces the store's catalog
 * (`products` table) wholesale. Separate from /api/upload — the catalog is
 * independent of the sales data source and feeds the new-vs-old classification,
 * not order lines.
 *
 * Two request shapes are accepted:
 *  - application/json `{ store, rows }` — rows already parsed and slimmed to the
 *    catalog columns in the browser (see CatalogUploadForm). This is the normal
 *    path: a raw export can be 15MB+, which the serverless platform rejects at
 *    the edge before this handler runs, so the client ships only the ~9 columns
 *    the ingest needs and the body stays small.
 *  - multipart/form-data `{ store, file }` — the original whole-file path, kept
 *    for small files and direct API callers; parsed here with xlsx.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return Response.json({ error: "Admins only." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let storeParam: string;
  let rows: Record<string, unknown>[];

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { store?: unknown; rows?: unknown }
      | null;
    if (!body || !Array.isArray(body.rows)) {
      return Response.json({ error: "Malformed catalog payload." }, { status: 400 });
    }
    storeParam = String(body.store ?? "");
    rows = body.rows as Record<string, unknown>[];
  } else {
    const form = await request.formData();
    const file = form.get("file");
    storeParam = String(form.get("store") ?? "");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file supplied." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: `File is ${(file.size / 1e6).toFixed(1)}MB; the limit is 25MB.` },
        { status: 413 },
      );
    }
    try {
      rows = parseWorkbook(await file.arrayBuffer()).lines;
    } catch (err) {
      return Response.json(
        { error: `Could not read that file: ${(err as Error).message}` },
        { status: 400 },
      );
    }
  }

  if (!STORES.some((s) => s.id === storeParam)) {
    return Response.json({ error: `Unknown store "${storeParam}".` }, { status: 400 });
  }
  const storeId = storeParam as StoreId;

  if (!rows.length) {
    return Response.json({ error: "No product rows found in that file." }, { status: 400 });
  }

  const products = await ingestCatalog(storeId, rows);

  // The new-vs-old split is derived data for this store; blow its cache.
  revalidateTag(dataTag(storeId), "max");
  revalidatePath("/", "layout");

  return Response.json({ store: storeId, products });
}
