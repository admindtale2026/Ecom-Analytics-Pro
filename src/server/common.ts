import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";
import type { StoreId } from "@/lib/constants";

/**
 * Distinct salespeople for the filter dropdown, scoped to one store.
 *
 * Each store has its own sales team — Modern's reps are not Homes' reps — so the
 * dropdown must reflect only the selected store, not every rep across all data.
 *
 * `cache()` dedupes this within a single render: the app layout needs the list
 * for the filter bar, and /orders needs it again for its own select. Without
 * it, every request to /orders ran this `select distinct` twice.
 */
export const getSalespeople = cache(async (storeId: StoreId): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ name: orderLines.salesPerson })
    .from(orderLines)
    .where(
      and(
        eq(orderLines.storeId, storeId),
        sql`${orderLines.salesPerson} is not null and ${orderLines.salesPerson} <> ''`,
      ),
    )
    .orderBy(orderLines.salesPerson);
  return rows.map((r) => r.name!).filter(Boolean);
});
