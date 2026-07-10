import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dataSources, schemaMappings, users } from "@/db/schema";
import type { StoreId } from "@/lib/constants";
import { defaultMapping, type Mapping } from "@/lib/ingest/mapping";

export async function getDataSource(storeId: StoreId) {
  const [row] = await db.select().from(dataSources).where(eq(dataSources.storeId, storeId));
  return row ?? null;
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
