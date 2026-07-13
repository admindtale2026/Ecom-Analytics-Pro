import { cookies } from "next/headers";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import { parseFilters, type Filters } from "./filters";
import { STORES, type StoreId } from "./constants";
import { getCurrentUser, canAccessStore } from "./session";

/**
 * The global filters (store / salesperson / date range) are held in a cookie —
 * not the URL — so the address bar stays clean while filters still persist
 * across pages and refreshes. The cookie value is a query string of the same
 * keys `parseFilters` already understands.
 */
// Versioned key — must match the writer in `use-apply-filters.ts`. Bumping the
// version retires stale cookies (e.g. a persisted `range=all`) so first load
// falls through to the This-Month default in `resolveRange`.
export const FILTER_COOKIE = "ea_filters_v2";

/**
 * Resolve the active global filters from the cookie. `cache()` dedupes it across
 * the layout and page in one render.
 *
 * Two server-side adjustments layer onto the pure `parseFilters` result:
 *  1. Security — the requested store is clamped to what the caller may access,
 *     so a `sales` user can't read another store by editing the cookie.
 *  2. Smart default — when the user hasn't explicitly picked a range and the
 *     default "This Month" window is empty (data lags the calendar month), fall
 *     back to the most recent month that actually has orders, so first load is
 *     never a blank dashboard.
 */
export const getFilters = cache(async (): Promise<Filters> => {
  const raw = (await cookies()).get(FILTER_COOKIE)?.value;
  const params = Object.fromEntries(new URLSearchParams(raw ? decodeURIComponent(raw) : "").entries());
  const filters = parseFilters(params);

  const user = await getCurrentUser();
  if (!canAccessStore(user, filters.storeId)) {
    filters.storeId = firstAllowedStore(user.storeAccess);
  }

  // Only when the range wasn't explicitly chosen (no `range` key = the default
  // This Month). An explicit "This Month" pick is honoured as-is, empty or not.
  if (!params.range) {
    await applyLatestMonthFallback(filters);
  }
  return filters;
});

/** First store the user is scoped to (falls back to the default store id). */
function firstAllowedStore(storeAccess: string[]): StoreId {
  const allowed = STORES.find((s) => storeAccess.includes(s.id));
  return (allowed?.id ?? STORES[0].id) as StoreId;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * If the default This Month window (filters.from = 1st of the current month)
 * predates all data, rewrite the window to the month of the latest order so the
 * dashboard opens on real data. Mutates `filters` in place.
 */
async function applyLatestMonthFallback(filters: Filters): Promise<void> {
  if (!filters.from) return; // "All Time" etc. — nothing to fall back from.
  const latest = await latestOrderDate(filters.storeId);
  if (!latest || latest >= filters.from) return; // This Month has data — keep it.

  const start = new Date(latest.getFullYear(), latest.getMonth(), 1);
  const end = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);
  filters.from = startOfDay(start);
  filters.to = endOfDay(end);
  filters.rangeLabel = latest.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  filters.presetId = "latest";
}

/** Most recent order_date for a store, or null when the store has no orders. */
async function latestOrderDate(storeId: StoreId): Promise<Date | null> {
  const [row] = await db
    .select({ d: sql<string | null>`max(${orderLines.orderDate})` })
    .from(orderLines)
    .where(eq(orderLines.storeId, storeId));
  return row?.d ? new Date(row.d) : null;
}
