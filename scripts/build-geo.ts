/**
 * One-time build of the vendored India map.
 *
 *   npx tsx scripts/build-geo.ts
 *
 * Source: https://github.com/geohacker/india (MIT), `state/india_telengana.geojson`
 * — the only variant in that repo that includes Telangana, which happens to be
 * this business's top market. The raw file is ~23MB, so we simplify it to a
 * ~150KB TopoJSON and commit the result; nothing is fetched at runtime.
 *
 * The source carries pre-2014 state names (`Orissa`, `Uttaranchal`). We rename
 * them here to exactly what `normalizeState()` emits, so the choropleth joins on
 * a plain string equality instead of a second alias table at render time.
 *
 * Known limitation: the source predates the 2019 reorganisation, so it has no
 * Ladakh — Ladakh's area is still inside Jammu and Kashmir. Orders shipped to a
 * state with no matching shape are surfaced in the UI rather than dropped.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson";

const OUT_DIR = path.join(process.cwd(), "public", "geo");
const OUT_FILE = path.join(OUT_DIR, "india-states.topo.json");
const TMP_RAW = path.join(process.cwd(), ".geo-tmp-raw.geojson");
const TMP_NAMED = path.join(process.cwd(), ".geo-tmp-named.geojson");

/** Source spelling -> the spelling `normalizeState()` produces. */
const RENAME: Record<string, string> = {
  Orissa: "Odisha",
  Uttaranchal: "Uttarakhand",
  "Andaman and Nicobar": "Andaman and Nicobar Islands",
};

type Feature = { type: string; properties: Record<string, unknown>; geometry: unknown };

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("↓ downloading source (~23MB)…");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Source fetch failed: ${res.status} ${res.statusText}`);
  writeFileSync(TMP_RAW, Buffer.from(await res.arrayBuffer()));

  console.log("· renaming states and stripping unused properties…");
  const fc = JSON.parse(readFileSync(TMP_RAW, "utf8")) as { features: Feature[] };
  const seen: string[] = [];
  for (const f of fc.features) {
    const raw = String(f.properties.NAME_1 ?? "").trim();
    const name = RENAME[raw] ?? raw;
    seen.push(name);
    // Only st_nm survives; every other GADM column is dead weight in the bundle.
    f.properties = { st_nm: name };
  }
  seen.sort();
  console.log(`  ${seen.length} states:`, seen.join(", "));
  writeFileSync(TMP_NAMED, JSON.stringify(fc));

  console.log("· simplifying with mapshaper…");
  execFileSync(
    "npx",
    [
      "mapshaper",
      TMP_NAMED,
      "-simplify",
      "4%",
      "keep-shapes",
      "-o",
      OUT_FILE,
      "format=topojson",
      "id-field=st_nm",
    ],
    { stdio: "inherit" },
  );

  rmSync(TMP_RAW, { force: true });
  rmSync(TMP_NAMED, { force: true });

  const bytes = readFileSync(OUT_FILE).byteLength;
  console.log(`✓ ${path.relative(process.cwd(), OUT_FILE)} — ${(bytes / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
