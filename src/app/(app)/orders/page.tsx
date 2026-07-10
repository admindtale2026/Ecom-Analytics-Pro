import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { OrdersControls } from "@/components/orders/orders-controls";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getOrders, getOrderStates } from "@/server/orders";
import { getSalespeople } from "@/server/common";
import { getStoreSheet } from "@/lib/ingest/sheet-manifest";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const page = Number(one(sp.page) ?? 1);
  const pageSize = Number(one(sp.rows) ?? 25);
  const query = {
    q: one(sp.q),
    state: one(sp.state),
    status: one(sp.status),
    page,
    pageSize,
  };

  const [{ rows, total }, states, people] = await Promise.all([
    getOrders(f, query),
    getOrderStates(f),
    getSalespeople(),
  ]);

  // "Live" means this store has sheet grids mapped in the manifest, which it does.
  const syncConfigured = Boolean(getStoreSheet(f.storeId));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-ink">Data Table</h2>

      <Card>
        <CardBody>
          <OrdersControls states={states} people={people} syncConfigured={syncConfigured} />
        </CardBody>
      </Card>

      <Card>
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-4">Order ID</th>
                <th className="px-5 py-4">Order Date</th>
                <th className="px-5 py-4">User Name</th>
                <th className="px-5 py-4">Bill City</th>
                <th className="px-5 py-4">Bill State</th>
                <th className="px-5 py-4 text-right">Total Items</th>
                <th className="px-5 py-4 text-right">Order Qty</th>
                <th className="px-5 py-4 text-right">Payment</th>
                <th className="px-5 py-4">Sales Person</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-ink-soft">
                    No orders match these filters.
                  </td>
                </tr>
              )}
              {rows.map((o) => (
                <tr key={o.orderId} className="border-b border-line/70 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <Link href={`/orders/${encodeURIComponent(o.orderId)}`} className="font-semibold text-brand-600 hover:underline">
                      {o.orderId}
                    </Link>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-ink-soft">
                    {o.orderDate ? new Date(o.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-4 font-semibold text-ink">{o.userName ?? "—"}</td>
                  <td className="px-5 py-4 text-ink-soft">{o.billCity ?? "—"}</td>
                  <td className="px-5 py-4 text-ink-soft">{o.billState ?? "—"}</td>
                  <td className="px-5 py-4 text-right tnum">{formatNumber(o.totalItems)}</td>
                  <td className="px-5 py-4 text-right tnum">{formatNumber(o.orderQuantity)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-brand-600 tnum">{formatCurrency(o.paymentAmount)}</td>
                  <td className="px-5 py-4 font-medium text-ink">{o.salesPerson ?? "—"}</td>
                  <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-5">
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      </Card>
    </div>
  );
}
