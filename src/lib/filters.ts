import { STORES, type StoreId } from "./constants";

export type Filters = {
  storeId: StoreId;
  salespeople: string[]; // empty = all
  from: Date | null; // null = unbounded
  to: Date | null;
  rangeLabel: string;
  presetId: string;
};

/** Next.js searchParams can be string | string[] | undefined. */
export type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Resolve a date preset into a concrete [from,to]. "Now" is intentionally
 * read from the server clock. Default (no param) = This Month, so first load
 * shows the current period. "All Time" is an explicit choice (`range=all`).
 */
function resolveRange(
  preset: string | undefined,
  fromStr?: string,
  toStr?: string,
): { from: Date | null; to: Date | null; label: string; presetId: string } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Today", presetId: "today" };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), label: "Yesterday", presetId: "yesterday" };
    }
    case "last7": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: startOfDay(s), to: endOfDay(now), label: "Last 7 Days", presetId: "last7" };
    }
    case "thisMonth": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(s), to: endOfDay(now), label: "This Month", presetId: "thisMonth" };
    }
    case "custom": {
      const from = fromStr ? startOfDay(new Date(fromStr)) : null;
      const to = toStr ? endOfDay(new Date(toStr)) : null;
      const fmt = (d: Date | null) =>
        d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "…";
      return { from, to, label: `${fmt(from)} – ${fmt(to)}`, presetId: "custom" };
    }
    case "all":
      return { from: null, to: null, label: "All Time", presetId: "all" };
    default:
      // No cookie / unknown preset → default the dashboard to This Month.
      return resolveRange("thisMonth", fromStr, toStr);
  }
}

export function parseFilters(sp: SearchParams): Filters {
  const storeParam = one(sp.store) as StoreId | undefined;
  const storeId = STORES.some((s) => s.id === storeParam) ? (storeParam as StoreId) : "modern";

  const spRaw = one(sp.sp);
  const salespeople = spRaw ? spRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const { from, to, label, presetId } = resolveRange(one(sp.range), one(sp.from), one(sp.to));

  return { storeId, salespeople, from, to, rangeLabel: label, presetId };
}
