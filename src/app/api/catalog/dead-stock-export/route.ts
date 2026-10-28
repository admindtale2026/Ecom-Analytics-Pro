import { getFilters } from "@/lib/filters-server";
import { getCurrentUser } from "@/lib/session";
import { getDeadStockProducts } from "@/server/dead-stock";
import { formatDMY } from "@/lib/utils";

// The Postgres/PGlite driver is server-only.
export const runtime = "nodejs";

/**
 * Dead Stock → CSV. A clearance action list for the merchandising team, scoped
 * to the caller's active global filters (store / date range / salesperson, read
 * from the cookie) plus the on-screen `category` / `tier` narrowing. `getFilters`
 * already clamps the store to what the user may access; we only need to reject
 * an unauthenticated caller so the default-store fallback can't leak data.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user.id) {
    return Response.json({ error: "Sign in to export." }, { status: 401 });
  }

  const f = await getFilters();
  const sp = new URL(request.url).searchParams;
  const category = sp.get("category") || undefined;
  const tierRaw = sp.get("tier");
  const tier = tierRaw === "dead" || tierRaw === "slow" ? tierRaw : undefined;

  const rows = await getDeadStockProducts(f, { category, tier });

  const header = [
    "Category",
    "Product",
    "SKU",
    "Variants",
    "Status",
    "Added",
    "Days idle",
    "Last sold",
    "List value",
    `Units (${f.rangeLabel})`,
    "Tier",
    "Risk",
    "Action",
  ];

  const body = rows.map((r) => [
    r.category,
    r.name,
    r.sku ?? "",
    String(r.skuCount),
    r.status ?? "",
    r.createdAt ? formatDMY(r.createdAt) : "",
    r.daysIdle == null ? "Never sold" : String(r.daysIdle),
    r.lastSold ? formatDMY(r.lastSold) : "",
    r.price == null ? "" : String(r.price),
    String(r.units),
    r.tier,
    String(r.riskScore),
    r.action,
  ]);

  const csv = [header, ...body].map((cols) => cols.map(csvCell).join(",")).join("\r\n");
  const stamp = formatDMY(new Date());

  // Lead with a UTF-8 BOM so Excel opens ₹ and other non-ASCII correctly.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dead-stock-${f.storeId}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** RFC-4180 escaping: quote a field and double its quotes when it needs it. */
function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
