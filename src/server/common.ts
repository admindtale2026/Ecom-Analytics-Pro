import { cache } from "react";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { orderLines, orderSummary } from "@/db/schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { StoreId } from "@/lib/constants";

/**
 * Distinct salespeople for the filter dropdown, scoped to one store.
 *
 * Each store has its own sales team — Modern's reps are not Homes' reps — so the
 * dropdown must reflect only the selected store, not every rep across all data.
 *
 * Both tabs are unioned: a rep whose orders are all still on the Order Summary
 * tab is a rep. Reading order_lines alone hid them from the dropdown entirely,
 * so their revenue could not be filtered to even though it counts.
 *
 * `cache()` dedupes this within a single render: the app layout needs the list
 * for the filter bar, and /orders needs it again for its own select. Without
 * it, every request to /orders ran this `select distinct` twice.
 */
export const getSalespeople = cache(async (storeId: StoreId): Promise<string[]> => {
  const named = (col: AnyPgColumn): SQL => sql`${col} is not null and ${col} <> ''`;
  // `union` (not `unionAll`) dedupes across the two tabs. Ordering by the output
  // ordinal because a set operation's ORDER BY cannot reach a source column.
  const rows = await union(
    db
      .select({ name: orderLines.salesPerson })
      .from(orderLines)
      .where(and(eq(orderLines.storeId, storeId), named(orderLines.salesPerson))),
    db
      .select({ name: orderSummary.salesPerson })
      .from(orderSummary)
      .where(and(eq(orderSummary.storeId, storeId), named(orderSummary.salesPerson))),
  ).orderBy(sql`1`);
  return rows.map((r) => r.name!).filter(Boolean);
});
