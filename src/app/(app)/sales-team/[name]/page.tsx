import { notFound } from "next/navigation";
import { DollarSign, ShoppingBag, Boxes, BarChart3, TrendingUp, MapPin, Package } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { DetailHeader, MiniBar } from "@/components/ui/page-header";
import { RevenueLine } from "@/components/charts/revenue-line";
import { HBar } from "@/components/charts/bar-chart";
import { ProductThumb } from "@/components/ui/product-thumb";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getKpis, getDailyRevenue } from "@/server/dashboard";
import { getStates } from "@/server/regions";
import { getProducts } from "@/server/inventory";
import { getReps } from "@/server/sales-team";

export const dynamic = "force-dynamic";

/**
 * A rep's page is the dashboard scoped to one person. Rather than a parallel
 * set of "…ForRep" queries, we pin `salespeople` in the filter and reuse the
 * existing aggregates — one definition of revenue, everywhere.
 */
export default async function RepPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);
  const base = parseFilters(await searchParams);

  const allReps = await getReps(base);
  const rep = allReps.find((r) => r.name === name);
  if (!rep) notFound();

  const f = { ...base, salespeople: [name] };
  const [kpis, daily, states, products] = await Promise.all([
    getKpis(f),
    getDailyRevenue(f),
    getStates(f),
    getProducts(f, { limit: 10 }),
  ]);

  const backHref = `/sales-team?${filtersToQuery(base)}`;
  const maxUnits = Math.max(1, ...products.map((p) => p.units));

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={backHref}
        eyebrow="Salesperson"
        title={name}
        subtitle={`Rank #${allReps.indexOf(rep) + 1} of ${allReps.length} · ${rep.contribution.toFixed(1)}% of store revenue`}
      />

      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Revenue" value={formatCurrency(kpis.revenue)} icon={<DollarSign className="h-5 w-5" />} delta={kpis.revenueDelta} />
        <KpiCard label="Orders" value={formatNumber(kpis.orders)} icon={<ShoppingBag className="h-5 w-5" />} delta={kpis.ordersDelta} />
        <KpiCard label="Units Sold" value={formatNumber(kpis.units)} icon={<Boxes className="h-5 w-5" />} />
        <KpiCard label="Avg Order Value" value={formatCurrency(kpis.aov)} icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <Card>
        <CardBody>
          <CardTitle title="Sales Trend" subtitle={`Daily revenue closed by ${name}`} icon={<TrendingUp className="h-5 w-5" />} />
          <RevenueLine data={daily} height={280} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle title="Territory" subtitle="States this rep sells into" icon={<MapPin className="h-5 w-5" />} />
            <HBar data={states.slice(0, 8).map((s) => ({ label: s.name, value: s.revenue }))} height={300} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle title="Top Products" subtitle="Best sellers for this rep" icon={<Package className="h-5 w-5" />} />
            <ul className="space-y-3.5">
              {products.map((p) => (
                <li key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ProductThumb imageUrl={p.imageUrl} name={p.name} size={32} />
                      <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink tnum">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                  <MiniBar value={p.units} max={maxUnits} />
                </li>
              ))}
              {!products.length && (
                <li className="py-12 text-center text-sm text-ink-soft">No products in this period.</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
