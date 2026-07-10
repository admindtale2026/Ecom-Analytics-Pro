import * as XLSX from "xlsx";

/**
 * Turn an uploaded .xlsx / .xls / .csv buffer into raw rows keyed by their
 * source column header. Header names are preserved verbatim — remapping them to
 * canonical fields is `mapRow`'s job, driven by the admin-editable mapping.
 */

export type Workbook = {
  /** The detailed line-item rows (the widest sheet, or the only one). */
  lines: Record<string, unknown>[];
  /** The lightweight "Order Summary" tab, if the workbook has one. */
  summary: Record<string, unknown>[] | null;
  sheetNames: string[];
};

function sheetToRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  // defval:null so absent cells are explicit nulls rather than missing keys —
  // mapRow distinguishes "column not present" from "cell empty".
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
}

const SUMMARY_HINT = /summary/i;

export function parseWorkbook(buf: ArrayBuffer): Workbook {
  // cellDates so date cells arrive as Date objects instead of Excel serials.
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;
  if (!sheetNames.length) return { lines: [], summary: null, sheetNames: [] };

  const summaryName = sheetNames.find((n) => SUMMARY_HINT.test(n)) ?? null;
  const lineNames = sheetNames.filter((n) => n !== summaryName);

  // With several non-summary tabs, the detail sheet is the one with the most
  // columns — the reference workbook's line-item tab carries ~40 of them.
  let lines: Record<string, unknown>[] = [];
  let widest = -1;
  for (const name of lineNames) {
    const rows = sheetToRows(wb, name);
    const width = rows.length ? Object.keys(rows[0]).length : 0;
    if (width > widest) {
      widest = width;
      lines = rows;
    }
  }

  return {
    lines,
    summary: summaryName ? sheetToRows(wb, summaryName) : null,
    sheetNames,
  };
}
