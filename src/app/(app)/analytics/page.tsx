import Link from "next/link";
import { Activity, Layers, MapPin } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { MiniBar } from "@/components/ui/page-header";
import { RevenueVolumeChart } from "@/components/charts/combo-chart";
import { HBar } from "@/components/charts/bar-chart";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  getAnalyticsHeadline,
  getCitiesForType,
  getProductTypeMatrix,
  getTrajectory,
} from "@/server/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const f = parseFilters(await searchParams);
  const [headline, trajectory, matrix] = await Promise.all([
    getAnalyticsHeadline(f),
    getTrajectory(f),
    getProductTypeMatrix(f),
  ]);
  const leadingType = headline.leadingType ?? matrix[0]?.productType ?? null;
  const cities = leadingType ? await getCitiesForType(f, leadingType) : [];
  const query = filtersToQuery(f);
  const maxAov = Math.max(1, ...matrix.map((m) => m.aov));

  return (
    <div className="space-y-6 anim-rise">
      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Peak Sales Day"
          value={
            headline.peakDay
              ? new Date(headline.peakDay).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"
          }
        />
        <StatTile label="Velocity Score" value={headline.velocity.toFixed(1)} sub="orders / day" />
        <StatTile label="Leading Product Type" value={leadingType ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle
              title="Sales Trajectory"
              subtitle="Total revenue and order volume intensity"
              icon={<Activity className="h-5 w-5" />}
            />
            <RevenueVolumeChart data={trajectory} height={340} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle
              title="Regional Dominance"
              subtitle={leadingType ? `Top cities for ${leadingType}` : "Top cities"}
              icon={<MapPin className="h-5 w-5" />}
            />
            <HBar data={cities.map((c) => ({ label: c.city, value: c.revenue }))} height={340} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="pb-0">
          <CardTitle
            title="Product Type Efficiency Matrix"
            subtitle="Deep dive into revenue per order by product type"
            icon={<Layers className="h-5 w-5" />}
          />
        </CardBody>
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3.5">Product Type</th>
                <th className="px-5 py-3.5 text-right">Revenue Share</th>
                <th className="px-5 py-3.5 text-right">Order Volume</th>
                <th className="px-5 py-3.5 text-right">Total Qty</th>
                <th className="px-5 py-3.5">AOV</th>
                <th className="px-5 py-3.5 text-right">Total Contribution</th>
              </tr>
            </thead>
            <tbody>
              {matrix.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-ink-soft">
                    No product data for this selection.
                  </td>
                </tr>
              )}
              {matrix.map((row) => (
                <tr
                  key={row.productType}
                  className="row-hover border-b border-line/70 last:border-0 hover:bg-brand-50/40"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/analytics/${encodeURIComponent(row.productType)}?${query}`}
                      className="font-semibold text-ink transition-colors duration-150 hover:text-brand-600"
                    >
                      {row.productType}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-ink tnum">
                    {formatPercent(row.share)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink-soft tnum">
                    {formatNumber(row.orders)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink-soft tnum">
                    {formatNumber(row.units)}
                  </td>
                  <td className="w-44 px-5 py-3.5">
                    <p className="text-ink tnum">{formatCurrency(row.aov)}</p>
                    <MiniBar value={row.aov} max={maxAov} className="mt-1.5" />
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-ink tnum">
                    {formatCurrency(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
