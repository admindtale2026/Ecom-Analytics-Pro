/**
 * The raw Magento "Export Products" header is ~90 columns wide, but the catalog
 * ingest only ever reads these. A full export is large (descriptions, meta tags
 * and image URLs dominate the bytes); projecting each row down to just these
 * columns in the browser before upload shrinks the payload roughly 10× — enough
 * to clear the serverless request-body limit that otherwise rejects the raw file
 * at the edge. Keep this list in sync with the fields read in `ingestCatalog`.
 */
export const CATALOG_COLUMNS = [
  "sku",
  "name",
  "created_at",
  "product_type",
  "visibility",
  "categories",
  "attribute_set_code",
  "price",
  "status",
  "product_online",
] as const;

/** Trim + lowercase + drop spaces/underscores so `Attribute Set Code` matches `attribute_set_code`. */
function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_]+/g, "");
}

/**
 * Slim one raw export row to the columns the catalog ingest consumes, re-keyed
 * to the canonical header names. Header matching is tolerant of case / space /
 * underscore differences, mirroring the server-side accessor, so a differently
 * cased export header still lands on the right field. Absent columns become
 * null so the ingest can tell "column missing" from "cell empty".
 */
export function projectCatalogRow(row: Record<string, unknown>): Record<string, unknown> {
  const idx = new Map<string, unknown>();
  for (const k of Object.keys(row)) idx.set(normHeader(k), row[k]);

  const out: Record<string, unknown> = {};
  for (const col of CATALOG_COLUMNS) {
    const v = idx.get(normHeader(col));
    out[col] = v === undefined ? null : v;
  }
  return out;
}
