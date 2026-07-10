import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { orderLines, settings } from "@/db/schema";
import type { Filters } from "@/lib/filters";
import { orderLineWhere, revenueSum, unitsSum, orderCount } from "./base";
import { safeDivide } from "@/lib/utils";

export type IdentityMode = "email" | "phone" | "both";

export const IDENTITY_MODE_KEY = "identity_match_mode";

export async function getIdentityMode(): Promise<IdentityMode> {
  const [row] = await db.select().from(settings).where(eq(settings.key, IDENTITY_MODE_KEY));
  const v = row?.value;
  return v === "email" || v === "phone" ? v : "both";
}

const email = sql`nullif(lower(trim(${orderLines.shipEmail})), '')`;
const phone = sql`nullif(trim(${orderLines.shipMobile}), '')`;
const fallbackName = sql`nullif(lower(trim(${orderLines.shipCustomerName})), '')`;

/**
 * Collapse line items onto one row per person. Which contact field wins is
 * configurable in Admin › Identity Logic; "both" prefers email and falls back
 * to phone, which dedupes a buyer who ordered once on mobile and once on web.
 */
function identityKey(mode: IdentityMode): SQL {
  switch (mode) {
    case "email":
      return sql`coalesce(${email}, ${fallbackName})`;
    case "phone":
      return sql`coalesce(${phone}, ${fallbackName})`;
    default:
      return sql`coalesce(${email}, ${phone}, ${fallbackName})`;
  }
}

export type CustomerRow = {
  name: string;
  email: string | null;
  mobile: string | null;
  orders: number;
  units: number;
  spend: number;
};

export type CustomerStats = {
  unique: number;
  repeat: number;
  oneTime: number;
  retentionRate: number;
  avgLifetimeValue: number;
};

/** Deduped buyers in the filtered window, ranked by spend. */
export async function getCustomers(f: Filters, mode: IdentityMode): Promise<CustomerRow[]> {
  const key = identityKey(mode);
  const rows = await db
    .select({
      key: sql<string>`${key}`,
      name: sql<string>`max(${orderLines.shipCustomerName})`,
      email: sql<string | null>`max(${orderLines.shipEmail})`,
      mobile: sql<string | null>`max(${orderLines.shipMobile})`,
      orders: orderCount,
      units: unitsSum,
      spend: revenueSum,
    })
    .from(orderLines)
    .where(orderLineWhere(f))
    .groupBy(sql`1`)
    .orderBy(sql`7 desc`);

  return rows
    .filter((r) => r.key)
    .map((r) => ({
      name: r.name ?? "Unknown",
      email: r.email,
      mobile: r.mobile,
      orders: Number(r.orders),
      units: Number(r.units),
      spend: Number(r.spend),
    }));
}

/** Loyalty/retention roll-up derived from the deduped buyer list. */
export function summarizeCustomers(rows: CustomerRow[]): CustomerStats {
  const unique = rows.length;
  const repeat = rows.filter((r) => r.orders > 1).length;
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return {
    unique,
    repeat,
    oneTime: unique - repeat,
    retentionRate: safeDivide(repeat, unique) * 100,
    avgLifetimeValue: safeDivide(spend, unique),
  };
}
