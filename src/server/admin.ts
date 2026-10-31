import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { dataSources, schemaMappings, settings, users } from "@/db/schema";
import type { StoreId } from "@/lib/constants";
import { defaultMapping, type Mapping } from "@/lib/ingest/mapping";

export async function getDataSource(storeId: StoreId) {
  const [row] = await db.select().from(dataSources).where(eq(dataSources.storeId, storeId));
  return row ?? null;
}

/** settings keys for the per-store catalog Google Sheet link + last sync time. */
export const catalogUrlKey = (storeId: StoreId) => `catalog_sheet_url:${storeId}`;
export const catalogSyncedKey = (storeId: StoreId) => `catalog_synced_at:${storeId}`;

export type CatalogSource = { sheetUrl: string | null; syncedAt: Date | null };

/** The stored catalog sheet link + last-synced timestamp for a store. */
export async function getCatalogSource(storeId: StoreId): Promise<CatalogSource> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, [catalogUrlKey(storeId), catalogSyncedKey(storeId)]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const synced = map.get(catalogSyncedKey(storeId));
  const syncedDate = synced ? new Date(synced) : null;
  return {
    sheetUrl: map.get(catalogUrlKey(storeId)) ?? null,
    syncedAt: syncedDate && Number.isFinite(syncedDate.getTime()) ? syncedDate : null,
  };
}

export async function getSchemaMappings(storeId: StoreId) {
  return db
    .select({
      canonicalField: schemaMappings.canonicalField,
      sourceColumn: schemaMappings.sourceColumn,
    })
    .from(schemaMappings)
    .where(eq(schemaMappings.storeId, storeId))
    .orderBy(schemaMappings.id);
}

/**
 * The mapping the ingest pipeline should use for a store: the built-in defaults
 * with any admin overrides from Admin › Schema Mapping layered on top. A store
 * that has never been customised therefore still ingests correctly.
 */
export async function resolveMapping(storeId: StoreId): Promise<Mapping> {
  const overrides = await getSchemaMappings(storeId);
  const mapping = defaultMapping();
  for (const o of overrides) {
    if (o.sourceColumn) mapping[o.canonicalField] = o.sourceColumn;
  }
  return mapping;
}

export async function getTeam() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .orderBy(users.id);
}
