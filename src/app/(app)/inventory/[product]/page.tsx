import Link from "next/link";
import { notFound } from "next/navigation";
import { DollarSign, ShoppingBag, TrendingUp, Boxes, MapPin, Users, Calendar } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { DetailHeader } from "@/components/ui/page-header";
import { ProductThumb } from "@/components/ui/product-thumb";
import { RevenueLine } from "@/components/charts/revenue-line";
import { HBar } from "@/components/charts/bar-chart";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { cn, formatCurrency, formatNumber, formatPercent, initials } from "@/lib/utils";
import {
  getProductCities,
  getProductDetail,
  getProductMonthly,
  getProductReps,
  getProductStates,
  getProductTrend,
} from "@/server/inventory";

export const dynamic = "force-dynamic";

const WINDOWS = [
  { id: "last6", label: "Last 6 Months" },
  { id: "thisYear", label: "This Year" },
  { id: "lastYear", label: "Last Year" },
] as const;
type WindowId = (typeof WINDOWS)[number]["id"];

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Single-value ring: this product's slice of total store revenue. */
function ShareRing({ percent }: { percent: number }) {
  const r = 68;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <div className="relative mx-auto" style={{ width: 180, height: 180 }}>
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#eef0f4" strokeWidth="16" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          style={{ transition: "stroke-dasharray var(--dur-slow) var(--ease-out)" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink tnum">{formatPercent(percent)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          Total share
        </span>
      </div>
    </div>
  );
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { product: raw } = await params;
  const name = decodeURIComponent(raw);
  const sp = await searchParams;
  const f = parseFilters(sp);

  const windowParam = one(sp.window);
  const win: WindowId = WINDOWS.some((w) => w.id === windowParam)
    ? (windowParam as WindowId)
    : "last6";

  const detail = await getProductDetail(f, name);
  if (!detail) notFound();

  const [trend, cities, states, reps, monthly] = await Promise.all([
    getProductTrend(f, name),
    getProductCities(f, name),
    getProductStates(f, name),
    getProductReps(f, name),
    getProductMonthly(f, name, win),
  ]);

  const query = filtersToQuery(f);

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/inventory?${query}`}
        title={detail.name}
        subtitle={detail.sku ? `SKU: ${detail.sku}` : undefined}
        action={
          detail.category ? (
            <span className="hidden shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600 sm:inline-flex">
              {detail.category}
            </span>
          ) : undefined
        }
      />

      <div className="flex items-center gap-4">
        <ProductThumb imageUrl={detail.imageUrl} name={detail.name} size={96} className="rounded-2xl" />
      </div>

      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Revenue" value={formatCurrency(detail.revenue)} icon={<DollarSign className="h-5 w-5" />} />
        <KpiCard label="Units Sold" value={formatNumber(detail.units)} icon={<Boxes className="h-5 w-5" />} />
        <KpiCard label="Avg Order Value" value={formatCurrency(detail.aov)} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard label="Orders" value={formatNumber(detail.orders)} icon={<ShoppingBag className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,320px)]">
        <Card>
          <CardBody>
            <CardTitle title="Sales Trend" icon={<TrendingUp className="h-5 w-5" />} />
            <RevenueLine data={trend} height={260} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle title="Revenue Share" subtitle="Contribution to total company revenue" icon={<DollarSign className="h-5 w-5" />} />
            <ShareRing percent={detail.revenueShare} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle title="Top Cities" icon={<MapPin className="h-5 w-5" />} />
            <HBar data={cities} height={240} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CardTitle title="Top States" icon={<MapPin className="h-5 w-5" />} />
            <HBar data={states} height={240} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle title="Sales Team Performance" subtitle="Who moved this product" icon={<Users className="h-5 w-5" />} />
            <ul className="space-y-2">
              {reps.map((r) => (
                <li
                  key={r.name}
                  className="row-hover flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-soft">
                      {initials(r.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                      <span className="block text-xs text-ink-soft tnum">
                        {formatNumber(r.orders)} orders
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-ink tnum">{formatCurrency(r.revenue)}</span>
                    <span className="block text-xs text-ink-soft tnum">{formatNumber(r.units)} units</span>
                  </span>
                </li>
              ))}
              {!reps.length && (
                <li className="py-12 text-center text-sm text-ink-soft">No rep attribution.</li>
              )}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle
              title="Monthly Performance"
              icon={<Calendar className="h-5 w-5" />}
              action={
                <div className="flex rounded-xl border border-line bg-card p-0.5">
                  {WINDOWS.map((w) => (
                    <Link
                      key={w.id}
                      href={`/inventory/${encodeURIComponent(name)}?${query}&window=${w.id}`}
                      scroll={false}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors duration-150",
                        win === w.id ? "bg-brand-50 text-brand-600" : "text-ink-soft hover:text-ink",
                      )}
                    >
                      {w.label}
                    </Link>
                  ))}
                </div>
              }
            />
            {/*
              This table intentionally ignores the global date filter — the
              window tabs own it, so a rep can compare a product's last six
              months against a full calendar year.
            */}
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <th className="py-2.5 font-semibold">Month</th>
                    <th className="py-2.5 text-right font-semibold">Orders</th>
                    <th className="py-2.5 text-right font-semibold">Qty</th>
                    <th className="py-2.5 text-right font-semibold">AOV</th>
                    <th className="py-2.5 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-b border-line last:border-0">
                      <td className="py-2.5 font-semibold text-ink">{m.month}</td>
                      <td className="py-2.5 text-right text-ink tnum">{formatNumber(m.orders)}</td>
                      <td className="py-2.5 text-right text-ink tnum">{formatNumber(m.units)}</td>
                      <td className="py-2.5 text-right text-ink-soft tnum">{formatCurrency(m.aov)}</td>
                      <td className="py-2.5 text-right font-bold text-brand-600 tnum">
                        {formatCurrency(m.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
