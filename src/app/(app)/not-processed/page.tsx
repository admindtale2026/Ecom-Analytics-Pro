import Link from "next/link";
import { AlertCircle, TrendingUp, Users, BarChart3, PackageX, Calendar } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { type SearchParams  } from "@/lib/filters";
import { getFilters } from "@/lib/filters-server";
import { cn, formatCurrency, formatNumber, initials } from "@/lib/utils";
import { getBacklogByRep, getBacklogOrders, getBacklogTotals } from "@/server/not-processed";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function NotProcessedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = await getFilters();
  const rep = one(sp.rep);

  const [totals, byRep, orders] = await Promise.all([
    getBacklogTotals(f),
    getBacklogByRep(f),
    getBacklogOrders(f, rep),
  ]);
  const hrefFor = (name?: string) =>
    `/not-processed${name ? `?rep=${encodeURIComponent(name)}` : ""}`;

  return (
    <div className="space-y-6 anim-rise">
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink">
          <PackageX className="h-5 w-5 text-brand-500" />
          Not Processed Orders
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Orders successfully created but lacking fulfilment details in the warehouse repository.
        </p>
      </div>

      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Backlogged Orders" value={formatNumber(totals.orders)} icon={<AlertCircle className="h-5 w-5" />} />
        <KpiCard label="Trapped Revenue" value={formatCurrency(totals.trappedRevenue)} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Card>
          <CardBody>
            <CardTitle title="Sales Accountability" subtitle="Filter the backlog by rep" icon={<Users className="h-5 w-5" />} />
            <ul className="space-y-2">
              <li>
                <Link
                  href={hrefFor()}
                  className={cn(
                    "row-hover flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                    !rep ? "border-brand-200 bg-brand-50" : "border-line hover:bg-slate-50",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">
                      #
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">All Orders</span>
                      <span className="block text-xs text-neg">{formatNumber(totals.orders)} pending</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink tnum">
                    {formatCurrency(totals.trappedRevenue)}
                  </span>
                </Link>
              </li>
              {byRep.map((r) => (
                <li key={r.name}>
                  <Link
                    href={hrefFor(r.name)}
                    className={cn(
                      "row-hover flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                      rep === r.name ? "border-brand-200 bg-brand-50" : "border-line hover:bg-slate-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-ink-soft">
                        {initials(r.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                        <span className="block text-xs text-neg">{formatNumber(r.pending)} pending</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink tnum">
                      {formatCurrency(r.revenue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="p-5 sm:p-6 sm:pb-0">
              <CardTitle
                title="Order Backlog List"
                subtitle={rep ? `Filtered to ${rep}` : "Every unprocessed order"}
                icon={<BarChart3 className="h-5 w-5" />}
              />
            </div>
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-semibold sm:px-6">Order ID</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Salesperson</th>
                    <th className="px-5 py-3 text-right font-semibold">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderId} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3.5 sm:px-6">
                        <Link
                          href={`/not-processed/${encodeURIComponent(o.orderId)}`}
                          className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-600 transition-colors duration-150 hover:bg-brand-100"
                        >
                          {o.orderId}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-ink-soft">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {o.orderDate ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-ink">{o.customerName || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-ink-soft">
                            {initials(o.salesPerson)}
                          </span>
                          <span className="text-ink">{o.salesPerson || "—"}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-ink tnum">
                        {formatCurrency(o.paymentAmount)}
                      </td>
                    </tr>
                  ))}
                  {!orders.length && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-sm text-ink-soft">
                        Nothing in the backlog. Every order has fulfilment details.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
