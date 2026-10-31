import * as XLSX from "xlsx";
import { extractSpreadsheetId } from "./sheets";
import { projectCatalogRow } from "./catalog-columns";

/**
 * Read a link-shared Google Sheet holding the full Magento product export and
 * return rows slimmed to the catalog columns (ready for `ingestCatalog`).
 *
 * Mirrors the sales-sheet reader in `sheets.ts`: fetch the public CSV export
 * endpoint (no API key / service account — the sheet must be "anyone with the
 * link can view"), parse with SheetJS. The catalog is a single tab, so we export
 * the first sheet (no gid) unless the URL pins one via `#gid=` or `?gid=`.
 *
 * We parse as raw text (not SheetJS date inference): the only date column,
 * `created_at`, is Magento's `M/D/YY, h:mm AM/PM` string that `parseMagentoDate`
 * handles explicitly — letting SheetJS pre-parse it would hand us a wrong Date.
 */

function csvExportUrl(spreadsheetId: string, gid: string | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}

/** Pull a gid out of a sheet URL fragment/query, if the link pins a specific tab. */
function extractGid(urlOrId: string): string | null {
  const m = urlOrId.match(/[#&?]gid=(\d+)/);
  return m ? m[1] : null;
}

export async function fetchCatalogRows(sheetUrl: string): Promise<Record<string, unknown>[]> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw Object.assign(new Error("That doesn't look like a Google Sheets link."), { status: 400 });
  }

  const res = await fetch(csvExportUrl(spreadsheetId, extractGid(sheetUrl)), {
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    throw Object.assign(
      new Error(
        `Could not read the catalog sheet (HTTP ${res.status}). Is it link-shared as "anyone with the link can view"?`,
      ),
      { status: 502 },
    );
  }

  const text = await res.text();
  const wb = XLSX.read(text, { type: "string", raw: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], {
    defval: null,
    raw: true,
  });
  // Slim to the ~9 columns the ingest reads, keyed to canonical headers.
  return rows.map(projectCatalogRow);
}
