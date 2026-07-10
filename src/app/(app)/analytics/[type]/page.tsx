import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { DetailHeader } from "@/components/ui/page-header";
import { ProductThumb } from "@/components/ui/product-thumb";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getTopProductsForType, getTypeDetail } from "@/server/analytics";

export const dynamic = "force-dynamic";

export default async function ProductTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { type: rawType } = await params;
  const type = decodeURIComponent(rawType);
  const f = parseFilters(await searchParams);

  const [detail, products] = await Promise.all([
    getTypeDetail(f, type),
    getTopProductsForType(f, type),
  ]);
  if (!detail.orders) notFound();

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/analytics?${filtersToQuery(f)}`}
        title={type}
        subtitle="Performance Insights & Product Breakdown"
      />

      <div className="anim-stack grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total Sale Value" value={formatCurrency(detail.revenue)} accent />
        <StatTile label="Revenue Share" value={formatPercent(detail.share)} />
        <StatTile label="Avg Order Value" value={formatCurrency(detail.aov)} />
        <StatTile
          label="Best Salesperson"
          value={detail.bestSalesperson?.name ?? "—"}
          sub={detail.bestSalesperson ? formatCurrency(detail.bestSalesperson.revenue) : undefined}
        />
        <StatTile
          label="Top Market (State)"
          value={detail.topState?.name ?? "—"}
          sub={detail.topState ? formatCurrency(detail.topState.revenue) : undefined}
        />
        <StatTile
          label="Top City"
          value={detail.topCity?.name ?? "—"}
          sub={detail.topCity ? formatCurrency(detail.topCity.revenue) : undefined}
        />
      </div>

      <Card>
        <CardBody className="pb-0">
          <CardTitle
            title={`Top ${products.length} Best Selling Products`}
            icon={<CircleCheck className="h-5 w-5" />}
          />
        </CardBody>
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-5 py-3.5 text-right">Units Sold</th>
                <th className="px-5 py-3.5 text-right">AOV</th>
                <th className="px-5 py-3.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-ink-soft">
                    No products for this selection.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr
                  key={p.name}
                  className="row-hover border-b border-line/70 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <ProductThumb imageUrl={p.imageUrl} name={p.name} />
                      <span className="font-semibold text-ink">{p.name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-ink tnum">
                    {formatNumber(p.units)}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-soft tnum">
                    {formatCurrency(p.aov)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-brand-600 tnum">
                    {formatCurrency(p.revenue)}
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
