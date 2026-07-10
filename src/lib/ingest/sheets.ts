import { google } from "googleapis";
import type { Workbook } from "./workbook";

/**
 * Google Sheets reader. Produces the same shape as `parseWorkbook`, so the
 * ingest pipeline cannot tell a synced sheet from an uploaded file.
 *
 * Dormant until GOOGLE_SERVICE_ACCOUNT_JSON is set — `isSheetsConfigured()`
 * lets callers return a clean "not configured" instead of throwing at import.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const SUMMARY_HINT = /summary/i;

export function isSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

/** Pull the spreadsheet id out of a full edit URL, or accept a bare id. */
export function extractSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  // A bare id has no slashes and is comfortably long.
  return /^[a-zA-Z0-9-_]{20,}$/.test(trimmed) ? trimmed : null;
}

function authClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set.");
  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  return new google.auth.JWT({
    email: creds.client_email,
    // Escaped newlines survive a trip through most secret stores; undo that.
    key: creds.private_key?.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
}

/** First row is the header; every later row becomes a header-keyed object. */
function rowsToObjects(values: unknown[][]): Record<string, unknown>[] {
  if (!values.length) return [];
  const headers = values[0].map((h) => String(h ?? "").trim());
  const out: Record<string, unknown>[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Sheets truncates trailing empties; a row shorter than the header is normal.
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] ?? null;
    });
    out.push(obj);
  }
  return out;
}

/**
 * Read every tab of the spreadsheet and classify them exactly as the file
 * parser does: the tab named "…Summary" is the summary; of the rest, the widest
 * is the line-item detail.
 */
export async function fetchWorkbook(urlOrId: string): Promise<Workbook> {
  const spreadsheetId = extractSpreadsheetId(urlOrId);
  if (!spreadsheetId) throw new Error(`Could not read a spreadsheet id from "${urlOrId}".`);

  const sheets = google.sheets({ version: "v4", auth: authClient() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));

  if (!sheetNames.length) return { lines: [], summary: null, sheetNames: [] };

  // One batched call beats N round-trips.
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: sheetNames,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const byName = new Map<string, Record<string, unknown>[]>();
  (res.data.valueRanges ?? []).forEach((vr, i) => {
    byName.set(sheetNames[i], rowsToObjects((vr.values ?? []) as unknown[][]));
  });

  const summaryName = sheetNames.find((n) => SUMMARY_HINT.test(n)) ?? null;

  let lines: Record<string, unknown>[] = [];
  let widest = -1;
  for (const name of sheetNames) {
    if (name === summaryName) continue;
    const rows = byName.get(name) ?? [];
    const width = rows.length ? Object.keys(rows[0]).length : 0;
    if (width > widest) {
      widest = width;
      lines = rows;
    }
  }

  return {
    lines,
    summary: summaryName ? (byName.get(summaryName) ?? []) : null,
    sheetNames,
  };
}
