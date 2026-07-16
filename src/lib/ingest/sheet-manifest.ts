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

/**
 * Stores whose Order Summary tab dates its rows as DD/MM/YYYY text.
 *
 * Modern's tab is unambiguous: 1,120 of its 1,824 date cells have a first
 * component above 12 and not one has a second above 12, so it can only be
 * day-first. Left to itself the reader treats those cells as US MM/DD, which
 * silently refiled every order dated 1st-12th into the wrong month and dropped
 * the rest — the tab's own June total read as a fraction of the sheet's.
 *
 * This single set drives both halves of the workaround, which only work in
 * concert: `sheets.ts` must hand the tab over as raw text (SheetJS otherwise
 * pre-parses the 1st-12th cells into wrong Dates that no downstream flag can
 * see), and `pipeline.ts` must then read that text day-first.
 *
 * Homes is deliberately excluded: its column genuinely mixes conventions (96
 * day-first cells alongside 38 month-first), so no single rule is right and
 * forcing day-first would corrupt the month-first rows. Decor's six cells are
 * all ambiguous. Both want fixing in the sheet — ideally by formatting these
 * columns as real dates, which would retire this whole workaround.
 */
export const SUMMARY_DAY_FIRST_STORES: ReadonlySet<StoreId> = new Set<StoreId>(["modern"]);

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
