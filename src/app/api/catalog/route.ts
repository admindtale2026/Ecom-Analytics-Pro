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
 * Accepts a Magento "Export Products" CSV/XLSX and replaces the store's catalog
 * (`products` table) wholesale. Separate from /api/upload — the catalog is
 * independent of the sales data source and feeds the new-vs-old classification,
 * not order lines.
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
    return Response.json(
      { error: `Could not read that file: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!workbook.lines.length) {
    return Response.json(
      { error: `No product rows found. Sheets seen: ${workbook.sheetNames.join(", ") || "none"}.` },
      { status: 400 },
    );
  }

  const products = await ingestCatalog(storeId, workbook.lines);

  // The new-vs-old split is derived data for this store; blow its cache.
  revalidateTag(dataTag(storeId), "max");
  revalidatePath("/", "layout");

  return Response.json({ store: storeId, products });
}
