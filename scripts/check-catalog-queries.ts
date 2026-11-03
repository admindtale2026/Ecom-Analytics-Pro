import "./_load-env";
import { getNewVsOldBreakdown, getProductsBySegment } from "../src/server/catalog";
import { STORES } from "../src/lib/constants";
import type { Filters } from "../src/lib/filters";

/**
 * Smoke test for the catalog "new vs old" queries against the live DB.
 *
 * These queries build correlated subqueries and GROUP BY expressions that the
 * TypeScript compiler cannot validate — a malformed grouping passes `tsc` and
 * only fails at runtime in Postgres (as it did: "subquery uses ungrouped column").
 * Run this before deploying catalog/analytics changes:  npx tsx scripts/check-catalog-queries.ts
 *
 * It exercises a windowed range (This Month) and an unbounded range (All Time),
 * since the window bounds are exactly what previously broke the GROUP BY.
 */
const now = new Date();

const ranges: Array<{ label: string; from: Date | null; to: Date | null }> = [
  { label: "This Month", from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: now },
  { label: "All Time", from: null, to: null },
];

function filtersFor(from: Date | null, to: Date | null): Filters {
  return {
    storeId: STORES[0].id,
    salespeople: [],
    from,
    to,
    rangeLabel: "check",
    presetId: "check",
  };
}

async function main() {
  let failed = false;

  for (const r of ranges) {
    const f = filtersFor(r.from, r.to);
    try {
      const breakdown = await getNewVsOldBreakdown(f);
      const newRows = await getProductsBySegment(f, "new", { limit: 50 });
      const oldRows = await getProductsBySegment(f, "old", { limit: 50 });
      const typed = await getNewVsOldBreakdown(f, "Bed Cot"); // per-type path
      console.log(
        `OK  [${r.label}] breakdown new=${breakdown.new.products} old=${breakdown.old.products} ` +
          `unmatched=${breakdown.unmatched.products} | list new=${newRows.length} old=${oldRows.length} ` +
          `| typed new=${typed.new.products}`,
      );
    } catch (e) {
      failed = true;
      const cause = (e as { cause?: Error }).cause;
      console.error(`FAIL [${r.label}]:`, cause?.message ?? (e as Error).message);
    }
  }

  if (failed) {
    console.error("\nCatalog query check FAILED.");
    process.exit(1);
  }
  console.log("\nCatalog query check passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error("CHECK CRASHED:", (e as Error).message);
  process.exit(1);
});
