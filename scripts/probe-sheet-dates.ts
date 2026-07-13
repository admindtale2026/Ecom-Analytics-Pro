/**
 * Read-only diagnostic: for each store's summary + detail grid, fetch the public
 * CSV export and report row count and the min/max of any date-like column, so we
 * can see whether April-2025→date history actually lives in the sheet — and in
 * which tab (detail feeds order_lines/dashboards; summary feeds order_summary).
 *
 * Run:  npx tsx scripts/probe-sheet-dates.ts
 */
import * as XLSX from "xlsx";
import { SHEET_ID, STORE_SHEETS } from "../src/lib/ingest/sheet-manifest";
import { parseDate } from "../src/lib/ingest/mapping";

function csvUrl(gid: number) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

async function probe(label: string, gid: number) {
  const res = await fetch(csvUrl(gid), { cache: "no-store" });
  if (!res.ok) {
    console.log(`\n${label} (gid ${gid}): HTTP ${res.status} — cannot read`);
    return;
  }
  const text = await res.text();
  const wb = XLSX.read(text, { type: "string", raw: false, cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: null,
  });
  if (!rows.length) {
    console.log(`\n${label} (gid ${gid}): 0 rows`);
    return;
  }
  const headers = Object.keys(rows[0]);
  const dateCols = headers.filter((h) => /date|time/i.test(h));
  console.log(`\n${label} (gid ${gid}): ${rows.length} rows`);
  console.log(`  headers: ${headers.join(" | ")}`);
  for (const col of dateCols) {
    const dates = rows
      .map((r) => parseDate(r[col]))
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
    if (!dates.length) {
      console.log(`  ${col}: no parseable dates`);
      continue;
    }
    const times = dates.map((d) => d.getTime());
    const min = new Date(Math.min(...times)).toISOString().slice(0, 10);
    const max = new Date(Math.max(...times)).toISOString().slice(0, 10);
    const byYear: Record<string, number> = {};
    for (const d of dates) {
      const y = String(d.getUTCFullYear());
      byYear[y] = (byYear[y] ?? 0) + 1;
    }
    const hist = Object.entries(byYear)
      .sort()
      .map(([y, n]) => `${y}:${n}`)
      .join("  ");
    console.log(`  ${col}: ${dates.length} dated | ${min} → ${max} | ${hist}`);
  }
}

async function main() {
  for (const [store, sheet] of Object.entries(STORE_SHEETS)) {
    console.log(`\n================ ${store.toUpperCase()} ================`);
    await probe(`${store} SUMMARY`, sheet.summaryGid);
    await probe(`${store} DETAIL`, sheet.detailGid);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
