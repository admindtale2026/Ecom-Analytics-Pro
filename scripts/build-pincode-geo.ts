/**
 * One-time build of the vendored pincode centroid map.
 *
 *   npx tsx scripts/build-pincode-geo.ts
 *
 * Source: GeoNames postal-code dump for India (CC-BY 4.0),
 * https://download.geonames.org/export/zip/IN.zip — a tab-separated file with
 * one row per post office (~155k rows), including latitude/longitude. A single
 * pincode spans many post offices, so we average their coordinates into one
 * centroid per pincode (~19k) and commit the compact `{pincode:[lat,lng]}` map
 * to `src/db/data/pincode-centroids.json`. Nothing is fetched at runtime; the
 * seed (`npm run db:seed-pincode-geo`) loads the vendored file.
 *
 * Attribution: this data is © GeoNames (https://www.geonames.org), CC-BY 4.0.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SOURCE_URL = "https://download.geonames.org/export/zip/IN.zip";
const OUT_FILE = path.join(process.cwd(), "src", "db", "data", "pincode-centroids.json");

async function main() {
  const tmp = mkdtempSync(path.join(tmpdir(), "pincode-"));
  const zip = path.join(tmp, "IN.zip");

  console.log("↓ downloading GeoNames IN.zip (~1.7MB)…");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Source fetch failed: ${res.status} ${res.statusText}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", zip, "-d", tmp], { stdio: "ignore" });

  console.log("· collapsing post offices into per-pincode centroids…");
  const lines = readFileSync(path.join(tmp, "IN.txt"), "utf8").split("\n");
  const agg = new Map<string, { latSum: number; lngSum: number; n: number }>();
  for (const ln of lines) {
    if (!ln) continue;
    const f = ln.split("\t");
    const pin = f[1]?.trim();
    const lat = parseFloat(f[9]);
    const lng = parseFloat(f[10]);
    if (!/^[1-9][0-9]{5}$/.test(pin) || !isFinite(lat) || !isFinite(lng)) continue;
    const g = agg.get(pin) ?? { latSum: 0, lngSum: 0, n: 0 };
    g.latSum += lat;
    g.lngSum += lng;
    g.n += 1;
    agg.set(pin, g);
  }

  const out: Record<string, [number, number]> = {};
  for (const [pin, g] of agg) {
    out[pin] = [+(g.latSum / g.n).toFixed(4), +(g.lngSum / g.n).toFixed(4)];
  }
  writeFileSync(OUT_FILE, JSON.stringify(out));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ wrote ${Object.keys(out).length} pincode centroids → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
