import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import type { StoreId } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { normalizeSku } from "./normalize";

/**
 * Catalog ingest: load a Magento "Export Products" CSV into the `products`
 * table. This is a *full* export, so each upload replaces the store's catalog
 * wholesale (delete-then-insert, mirroring the full-sync path in pipeline.ts) —
 * products removed upstream disappear here too, and a re-upload never
 * duplicates. Nothing in `order_lines` is touched; the "new vs old" split is
 * computed at query time against `createdAt` (see src/server/catalog.ts).
 */

export type CatalogIngestResult = {
  read: number;
  written: number;
  withoutDate: number;
};

/** PGlite chokes on very wide multi-row inserts; 400 keeps statements sane. */
const BATCH = 400;

/** Trim + lowercase + drop spaces/underscores so `Product Type` matches `product_type`. */
function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_]+/g, "");
}

/** Build a header-tolerant accessor over one raw row (exact header wins). */
function accessor(row: Record<string, unknown>) {
  const idx = new Map<string, unknown>();
  for (const k of Object.keys(row)) idx.set(normHeader(k), row[k]);
  return (...candidates: string[]): unknown => {
    for (const c of candidates) if (c in row) return row[c];
    for (const c of candidates) {
      const v = idx.get(normHeader(c));
      if (v !== undefined) return v;
    }
    return null;
  };
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Magento's product export has no plain `status` column; it carries the
 * enabled/disabled flag in `product_online` (1 = enabled, 2 = disabled). Fold
 * that into `status` so the dead-stock filter (which drops Disabled rows) can
 * see it. An explicit `status` cell, should a different export ever carry one,
 * wins; a blank `product_online` stays null and is treated as enabled downstream.
 */
function catalogStatus(status: unknown, productOnline: unknown): string | null {
  const explicit = str(status);
  if (explicit) return explicit;
  const po = str(productOnline);
  if (po === "1") return "enabled";
  if (po === "2") return "disabled";
  return null;
}

/**
 * Parse a Magento money cell to a number, or null when blank/unparseable — null
 * (not 0) so "value at risk" never counts a product with no price and the UI can
 * show "—". Strips `₹`, thousands separators and whitespace.
 */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse Magento's `created_at` string, which exports in US locale as
 * `M/D/YY, h:mm AM/PM` (e.g. `8/9/21, 7:24 PM`) — a format `new Date()` parses
 * inconsistently across engines and gets wrong for 2-digit years. We match it
 * explicitly. The time is kept when present; a bare `M/D/YY` (as some date
 * columns export) also parses. Returns null for a blank/unparseable cell.
 */
export function parseMagentoDate(v: unknown): Date | null {
  if (v == null) return null;
  // Defensive: an .xlsx upload may hand us a real Date instead of a string.
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/,
  );
  if (!m) return null;

  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length <= 2) year += 2000; // '21' -> 2021

  let hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ? Number(m[5]) : 0;
  const second = m[6] ? Number(m[6]) : 0;
  const ampm = m[7]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  // Build in UTC so the stored timestamp matches the catalog's calendar date
  // regardless of the server timezone (we only ever read the date part).
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isFinite(d.getTime()) ? d : null;
}

type ProductInsert = typeof products.$inferInsert;

export async function ingestCatalog(
  storeId: StoreId,
  rawRows: Record<string, unknown>[],
): Promise<CatalogIngestResult> {
  const deduped = new Map<string, ProductInsert>();
  let withoutDate = 0;

  for (const raw of rawRows) {
    const get = accessor(raw);
    const sku = str(get("sku"));
    if (!sku) continue; // no SKU -> no stable key, skip

    const skuKey = normalizeSku(sku);
    if (!skuKey) continue;

    const name = str(get("name"));
    const createdAt = parseMagentoDate(get("created_at", "createdat"));
    if (!createdAt) withoutDate += 1;

    // Last row wins on a repeated SKU, matching the (storeId, skuKey) upsert key.
    deduped.set(skuKey, {
      storeId,
      sku,
      skuKey,
      name,
      nameKey: name ? slugify(name) : null,
      createdAt,
      productType: str(get("product_type", "producttype")),
      visibility: str(get("visibility")),
      categories: str(get("categories")),
      attributeSetCode: str(get("attribute_set_code", "attributesetcode", "attribute set code")),
      price: num(get("price")),
      status: catalogStatus(get("status"), get("product_online", "productonline")),
    });
  }

  const rows = [...deduped.values()];

  // Full reload: drop the store's catalog, then insert fresh. Matches the
  // full-sync semantics in pipeline.ts (delete-then-insert, no transaction).
  await db.delete(products).where(eq(products.storeId, storeId));
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(products).values(rows.slice(i, i + BATCH));
  }

  return { read: rawRows.length, written: rows.length, withoutDate };
}
