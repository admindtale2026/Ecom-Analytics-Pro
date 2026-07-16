import * as XLSX from "xlsx";
import type { StoreId } from "@/lib/constants";
import type { Workbook } from "./workbook";
import {
  SHEET_ID,
  STORE_SHEETS,
  SUMMARY_DAY_FIRST_STORES,
  getStoreSheet,
  type StoreSheet,
} from "./sheet-manifest";

/**
 * Public Google Sheets reader. Produces the same shape as `parseWorkbook`, so
 * the ingest pipeline cannot tell a synced sheet from an uploaded file.
 *
 * Reads the sheet's CSV export endpoint — no service account, no API key. The
 * sheet must be link-shared ("anyone with the link can view"), which it is. Each
 * store maps to two tabs (summary + detail) via `sheet-manifest.ts`.
 */

/** True when the app has a sheet manifest to sync from (it always does now). */
export function isSheetsConfigured(): boolean {
  return Boolean(SHEET_ID) && Object.keys(STORE_SHEETS).length > 0;
}

/** Pull the spreadsheet id out of a full edit URL, or accept a bare id. */
export function extractSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(trimmed) ? trimmed : null;
}

function csvExportUrl(spreadsheetId: string, gid: number): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Fetch one tab as CSV and turn it into raw rows keyed by their source column
 * header. SheetJS parses the CSV (handling quoted `"₹6,240.00"` and trailing
 * empty columns); `defval:null` keeps absent cells as explicit nulls so `mapRow`
 * can tell "column missing" from "cell empty".
 */
async function fetchTabRows(
  spreadsheetId: string,
  gid: number,
  opts: { rawText?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const res = await fetch(csvExportUrl(spreadsheetId, gid), {
    redirect: "follow",
    // Never serve a stale sync from an edge/data cache.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Could not read sheet tab gid ${gid} (HTTP ${res.status}). Is the sheet link-shared as "anyone with the link can view"?`,
    );
  }
  const text = await res.text();
  // `rawText` opts a tab out of SheetJS's date inference entirely, handing every
  // cell over as the string the CSV actually contains. Needed because inference
  // reads `d/m/yyyy` as US MM/DD: it cannot fail loudly (a day past the 12th is
  // simply left as text) and for days 1-12 it produces a confidently wrong Date
  // that no later flag can distinguish from a correct one. Only `parseDate` can
  // resolve those cells, and only if it sees the original text.
  //
  // Otherwise `cellDates:true` mirrors the known-good upload path
  // (`workbook.ts`) so datetime cells arrive as JS Dates. WITHOUT it, SheetJS
  // returns them as Excel serial numbers (e.g. 45748.01) which downstream
  // `new Date(n)` would misread as ms-since-1970, collapsing every synced order
  // to 1970.
  const wb = opts.rawText
    ? XLSX.read(text, { type: "string", raw: true })
    : XLSX.read(text, { type: "string", raw: false, cellDates: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], {
    defval: null,
    raw: opts.rawText ?? false,
  });
}

/**
 * Read one store's two tabs into the `Workbook` shape the pipeline consumes:
 * `lines` = the wide detail tab (→ order_lines), `summary` = the lightweight
 * summary tab (→ order_summary / "Not Processed").
 */
export async function fetchStoreWorkbook(
  storeId: StoreId,
): Promise<Workbook & { store: StoreSheet }> {
  const store = getStoreSheet(storeId);
  if (!store) {
    throw Object.assign(new Error(`No sheet grids mapped for store "${storeId}".`), {
      status: 400,
    });
  }
  // Only the summary tab of a day-first store opts out of date inference; the
  // detail tab's cells are real dates and parse correctly as they are.
  const [lines, summary] = await Promise.all([
    fetchTabRows(SHEET_ID, store.detailGid),
    fetchTabRows(SHEET_ID, store.summaryGid, {
      rawText: SUMMARY_DAY_FIRST_STORES.has(storeId),
    }),
  ]);
  return {
    lines,
    summary,
    sheetNames: [`gid:${store.summaryGid}`, `gid:${store.detailGid}`],
    store,
  };
}
