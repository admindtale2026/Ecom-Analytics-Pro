import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines } from "@/db/schema";

/**
 * Distinct salespeople across all data, for the global filter dropdown.
 *
 * `cache()` dedupes this within a single render: the app layout needs the list
 * for the filter bar, and /orders needs it again for its own select. Without
 * it, every request to /orders ran this `select distinct` twice.
 */
export const getSalespeople = cache(async (): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ name: orderLines.salesPerson })
    .from(orderLines)
    .where(sql`${orderLines.salesPerson} is not null and ${orderLines.salesPerson} <> ''`)
    .orderBy(orderLines.salesPerson);
  return rows.map((r) => r.name!).filter(Boolean);
});
