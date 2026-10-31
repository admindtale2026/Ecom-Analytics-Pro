import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { STORES, type StoreId } from "@/lib/constants";
import { dataTag } from "@/server/cache-tags";
import { getCurrentUser } from "@/lib/session";
import { catalogSyncedKey, getCatalogSource } from "@/server/admin";
import { fetchCatalogRows } from "@/lib/ingest/catalog-sheet";
import { ingestCatalog } from "@/lib/ingest/catalog";

// xlsx and the Postgres/PGlite driver are server-only.
export const runtime = "nodejs";
// Reading a large catalog sheet and reloading it outruns the 10s default.
export const maxDuration = 300;

/**
 * Catalog sync from the per-store Google Sheet link (Admin › Product Catalog).
 *
 * Same two callers as /api/sync: a signed-in admin (the "Sync Catalog" button)
 * or Vercel Cron with `Authorization: Bearer $CRON_SECRET`. Reads the stored
 * sheet link over its public CSV export and replaces the store's `products`
 * catalog wholesale (delete-then-insert in `ingestCatalog`), re-deriving each
 * product's `newMonth` tag. Order lines are untouched; only the catalog-derived
 * new-vs-old split changes.
 */
async function authorize(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  const user = await getCurrentUser();
  return user.role === "admin";
}

async function syncStore(storeId: StoreId) {
  const { sheetUrl } = await getCatalogSource(storeId);
  if (!sheetUrl) {
    throw Object.assign(new Error(`No catalog sheet link configured for "${storeId}".`), {
      status: 400,
    });
  }

  const rows = await fetchCatalogRows(sheetUrl);
  if (!rows.length) {
    throw Object.assign(new Error(`The catalog sheet for "${storeId}" has no product rows.`), {
      status: 422,
    });
  }

  const products = await ingestCatalog(storeId, rows);

  await db
    .insert(settings)
    .values({ key: catalogSyncedKey(storeId), value: new Date().toISOString() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: new Date().toISOString() },
    });

  return { store: storeId, products };
}

async function handle(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const storeParam = url.searchParams.get("store");

  // Cron passes no store: sync every one that has a link configured.
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
      results.push(await syncStore(storeId));
      revalidateTag(dataTag(storeId), "max");
    } catch (err) {
      // A store with no link (common on the cron path) must not abort the rest.
      failures.push({ store: storeId, error: (err as Error).message });
    }
  }

  revalidatePath("/", "layout");

  // The admin button always names a store, so a lone failure there is a real
  // 4xx/5xx; the cron (all stores) succeeds as long as any store synced.
  const status = results.length ? 200 : storeParam ? 422 : 200;
  return Response.json({ results, failures }, { status });
}

export const GET = handle; // Vercel Cron issues GET
export const POST = handle; // Admin button posts
