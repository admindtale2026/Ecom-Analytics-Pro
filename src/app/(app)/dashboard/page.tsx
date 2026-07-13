import { DollarSign, ShoppingBag, Boxes, BarChart3, TrendingUp, MapPin } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { RevenueLine } from "@/components/charts/revenue-line";
import { VBar, HBar } from "@/components/charts/bar-chart";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber, initials, safeDivide } from "@/lib/utils";
import {
  getKpis,
  getDailyRevenue,
  getSalespersonPerformance,
  getStateSales,
  getCitySales,
} from "@/server/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const f = await getFilters();
  const [kpis, daily, sales, states, cities] = await Promise.all([
    getKpis(f),
    getDailyRevenue(f),
    getSalespersonPerformance(f),
    getStateSales(f),
    getCitySales(f),
  ]);
  const maxSalesRev = Math.max(1, ...sales.map((s) => s.revenue));

  return (
    <div className="space-y-6 anim-rise">
      <div>
        <h2 className="text-xl font-bold text-ink">Business Overview</h2>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-soft">
          <span className="uppercase tracking-wide">{f.rangeLabel}</span>
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-brand-600">
            {f.storeId} store
          </span>
        </p>
      </div>

      {/* KPI row */}
      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Gross Revenue"
          value={formatCurrency(kpis.revenue)}
          icon={<DollarSign className="h-5 w-5" />}
          delta={kpis.revenueDelta}
          money
        />
        <KpiCard
          label="Total Orders"
          value={formatNumber(kpis.orders)}
          icon={<ShoppingBag className="h-5 w-5" />}
          delta={kpis.ordersDelta}
        />
        <KpiCard
          label="Total Volume (Units)"
          value={formatNumber(kpis.units)}
          icon={<Boxes className="h-5 w-5" />}
        />
        <KpiCard
          label="Avg Order Value"
          value={formatCurrency(kpis.aov)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Revenue performance */}
      <Card>
        <CardBody>
          <CardTitle
            title="Revenue Performance"
            subtitle="Daily revenue fluctuations over the period"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <RevenueLine data={daily.map((d) => ({ date: d.date, revenue: d.revenue }))} height={320} />
        </CardBody>
      </Card>

      {/* Salesperson + State */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle title="Salesperson Performance" subtitle="Top performing sales representatives" />
            <div className="space-y-4">
              {sales.map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                        {initials(s.name)}
                      </span>
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-soft tnum">
                        {formatNumber(s.orders)}
                      </span>
                    </span>
                    <span className="font-bold text-pos tnum">{formatCurrency(s.revenue)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${safeDivide(s.revenue, maxSalesRev) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle
              title="State Sales"
              subtitle="Top revenue generating states"
              icon={<MapPin className="h-5 w-5" />}
            />
            <VBar data={states.map((s) => ({ label: s.state, value: s.revenue }))} height={300} categorical />
          </CardBody>
        </Card>
      </div>

      {/* Regional / cities */}
      <Card>
        <CardBody>
          <CardTitle
            title="Regional Sales (Cities)"
            subtitle="Top revenue generating cities"
            icon={<MapPin className="h-5 w-5" />}
          />
          <HBar data={cities.map((c) => ({ label: c.city, value: c.revenue }))} height={280} />
        </CardBody>
      </Card>
    </div>
  );
}
