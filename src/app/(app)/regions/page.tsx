import { Suspense } from "react";
import Link from "next/link";
import { Globe, Building2, Navigation, TrendingUp, MapPin } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { MiniBar } from "@/components/ui/page-header";
import { VBar, HBar } from "@/components/charts/bar-chart";
import { MapCard, MapCardSkeleton } from "@/components/charts/map-card";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getCities, getRegionHeadline, getStates } from "@/server/regions";

export const dynamic = "force-dynamic";

export default async function RegionsPage() {
  const f = await getFilters();
  const [headline, states, cities] = await Promise.all([
    getRegionHeadline(f),
    getStates(f),
    getCities(f),
  ]);
  const maxStateRev = Math.max(1, ...states.map((s) => s.revenue));

  return (
    <div className="space-y-6 anim-rise">
      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/*
          The reference left this tile blank when the top state had no name.
          `getStates` coalesces blanks to "Unknown", so it always says something.
        */}
        <KpiCard
          label="Dominant State"
          value={headline.dominantState?.name ?? "—"}
          sub={headline.dominantState ? formatCurrency(headline.dominantState.revenue) : undefined}
          icon={<Globe className="h-5 w-5" />}
        />
        <KpiCard
          label="Top Performing City"
          value={headline.topCity?.name ?? "—"}
          sub={headline.topCity ? formatCurrency(headline.topCity.revenue) : undefined}
          icon={<Building2 className="h-5 w-5" />}
        />
        <KpiCard label="Active Markets" value={formatNumber(headline.activeMarkets)} icon={<Navigation className="h-5 w-5" />} />
        <KpiCard label="Avg Market Value" value={formatCurrency(headline.avgMarketValue)} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,480px)_1fr]">
        <Suspense fallback={<MapCardSkeleton />}>
          <MapCard filters={f} subtitle="Where the money actually comes from" />
        </Suspense>

        <Card>
          <CardBody>
            <CardTitle title="Urban Sales Concentration" subtitle="Revenue share across top metropolitan areas" icon={<Building2 className="h-5 w-5" />} />
            <VBar data={cities.slice(0, 10).map((c) => ({ label: c.name, value: c.revenue }))} height={320} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle title="State-wise Contribution" subtitle="Total revenue generated per primary state" icon={<MapPin className="h-5 w-5" />} />
          <HBar data={states.slice(0, 8).map((s) => ({ label: s.name, value: s.revenue }))} height={320} />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0 sm:p-0">
          <div className="p-5 sm:p-6 sm:pb-0">
            <CardTitle title="State Performance List" subtitle="Select a state to view comprehensive local analytics" />
          </div>
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-semibold sm:px-6">State</th>
                  <th className="px-5 py-3 text-right font-semibold">Orders</th>
                  <th className="px-5 py-3 text-right font-semibold">Units Sold</th>
                  <th className="px-5 py-3 text-right font-semibold">Avg. Order Value</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.name} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3.5 sm:px-6">
                      <Link href={`/regions/${encodeURIComponent(s.name)}`} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                          <Globe className="h-4 w-4" />
                        </span>
                        <span className="font-semibold text-ink hover:text-brand-600">{s.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatNumber(s.orders)}</td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatNumber(s.units)}</td>
                    <td className="px-5 py-3.5 text-right text-ink-soft tnum">{formatCurrency(s.aov)}</td>
                    <td className="w-56 px-5 py-3.5 text-right">
                      <span className="mb-1.5 block font-bold text-pos tnum">{formatCurrency(s.revenue)}</span>
                      <MiniBar value={s.revenue} max={maxStateRev} />
                    </td>
                  </tr>
                ))}
                {!states.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-ink-soft">
                      No regional sales in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0 sm:p-0">
          <div className="p-5 sm:p-6 sm:pb-0">
            <CardTitle title="Regional Performance List" subtitle="Drill down into specific city and state metrics" />
          </div>
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-semibold sm:px-6">Location</th>
                  <th className="px-5 py-3 text-right font-semibold">Orders</th>
                  <th className="px-5 py-3 text-right font-semibold">Units Sold</th>
                  <th className="px-5 py-3 text-right font-semibold">Avg. Order Value</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {cities.slice(0, 40).map((c) => (
                  <tr key={`${c.name}-${c.state}`} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3.5 sm:px-6">
                      <Link href={`/regions/city/${encodeURIComponent(c.name)}`} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink hover:text-brand-600">{c.name}</span>
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                            {c.state}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatNumber(c.orders)}</td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatNumber(c.units)}</td>
                    <td className="px-5 py-3.5 text-right text-ink-soft tnum">{formatCurrency(c.aov)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-pos tnum">{formatCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
