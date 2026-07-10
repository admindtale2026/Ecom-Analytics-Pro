import type { StoreId } from "@/lib/constants";

/**
 * Source of truth for the live data sheet.
 *
 * The whole business lives in ONE public, link-shared Google Sheet with six
 * grids — a lightweight "summary" tab and a wide "detail" tab per store. We read
 * each grid over the public CSV export endpoint (`/export?format=csv&gid=…`), so
 * no API key or service account is involved. Tabs are addressed by numeric `gid`
 * because they are stable and confirmed; a tab whose gid changes is re-pointed
 * here in one place.
 *
 * `mappingOverrides` patches the few column headers that differ from the
 * canonical defaults badly enough that header normalisation can't bridge them
 * (e.g. Modern's detail tab dates its rows "Order Placed Date Time", not
 * "Order Date Time"). Everything else is handled by tolerant header matching in
 * `mapRow` plus the admin-editable Schema Mapping.
 */
export const SHEET_ID = "1YBezRHcgSBEF4ZpOEihIsktz3TVTgWlkGtUnoTri6J4";

export type StoreSheet = {
  summaryGid: number;
  detailGid: number;
  /** canonicalField -> exact source column, layered over the resolved mapping. */
  mappingOverrides?: Record<string, string>;
};

export const STORE_SHEETS: Record<StoreId, StoreSheet> = {
  modern: {
    summaryGid: 200309580,
    detailGid: 104109488,
    mappingOverrides: { orderDate: "Order Placed Date Time" },
  },
  homes: {
    summaryGid: 42545770,
    detailGid: 694151773,
  },
  decor: {
    summaryGid: 737110769,
    detailGid: 439740835,
  },
};

export function getStoreSheet(storeId: StoreId): StoreSheet | null {
  return STORE_SHEETS[storeId] ?? null;
}
