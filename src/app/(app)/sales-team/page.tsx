import Link from "next/link";
import { Trophy, DollarSign, Zap, Users, TrendingUp, Award, ArrowRight } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { HBar } from "@/components/charts/bar-chart";
import { Donut } from "@/components/charts/donut";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber, formatPercent, safeDivide, topNWithOther } from "@/lib/utils";
import { getReps } from "@/server/sales-team";

export const dynamic = "force-dynamic";

/** Only #1 earns the gold tint; the rest stay neutral so the eye lands once. */
function RankChip({ rank }: { rank: number }) {
  return (
    <span
      className={
        rank === 1
          ? "flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700"
          : "flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-soft"
      }
    >
      {rank}
    </span>
  );
}

export default async function SalesTeamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const f = parseFilters(await searchParams);
  const reps = await getReps(f);

  const totalRevenue = reps.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = reps.reduce((s, r) => s + r.orders, 0);
  const top = reps[0] ?? null;

  return (
    <div className="space-y-6 anim-rise">
      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Top Performer"
          value={top?.name ?? "—"}
          sub={top ? `${formatCurrency(top.revenue)} revenue` : undefined}
          icon={<Trophy className="h-5 w-5" />}
        />
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          label="Avg Order Value (AOV)"
          value={formatCurrency(safeDivide(totalRevenue, totalOrders))}
          icon={<Zap className="h-5 w-5" />}
        />
        <KpiCard
          label="Active Reps"
          value={formatNumber(reps.length)}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle
              title="Revenue Leadership"
              subtitle="Revenue generated per sales associate"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <HBar data={reps.map((r) => ({ label: r.name, value: r.revenue }))} height={340} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle
              title="Market Share"
              subtitle="Revenue contribution %"
              icon={<Award className="h-5 w-5" />}
            />
            {/* Ramp is 8 steps; fold the tail so colour stays a key. */}
            <Donut data={topNWithOther(reps.map((r) => ({ label: r.name, value: r.revenue })))} height={240} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0 sm:p-0">
          <div className="p-5 sm:p-6 sm:pb-0">
            <CardTitle
              title="Sales Performance Matrix"
              subtitle="Detailed performance metrics per salesperson"
            />
          </div>
          {/* Wide table scrolls inside its own container; the page body never does. */}
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-semibold sm:px-6">Rank</th>
                  <th className="px-5 py-3 font-semibold">Salesperson</th>
                  <th className="px-5 py-3 text-right font-semibold">Orders</th>
                  <th className="px-5 py-3 text-right font-semibold">Units Sold</th>
                  <th className="px-5 py-3 text-right font-semibold">Avg Order Value</th>
                  <th className="px-5 py-3 text-right font-semibold">Contribution</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Revenue</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {reps.map((r, i) => (
                  <tr
                    key={r.name}
                    className="row-hover border-b border-line last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5 sm:px-6">
                      <RankChip rank={i + 1} />
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink">{r.name}</td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatNumber(r.orders)}</td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatNumber(r.units)}</td>
                    <td className="px-5 py-3.5 text-right text-ink tnum">{formatCurrency(r.aov)}</td>
                    <td className="px-5 py-3.5 text-right text-ink-soft tnum">
                      {formatPercent(r.contribution)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-brand-600 tnum">
                      {formatCurrency(r.revenue)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/sales-team/${encodeURIComponent(r.name)}`}
                        aria-label={`View ${r.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!reps.length && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm text-ink-soft">
                      No sales recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
