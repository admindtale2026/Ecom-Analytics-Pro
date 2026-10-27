import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { DetailHeader } from "@/components/ui/page-header";
import { ProductThumb } from "@/components/ui/product-thumb";
import { FulfilmentBadge } from "@/components/ui/status-badge";
import { ProductTableControls } from "@/components/analytics/product-table-controls";
import { CatalogTag, SplitStat } from "@/components/analytics/catalog-bits";
import type { SearchParams } from "@/lib/filters";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  getFulfilmentTypesForType,
  getTopProductsForType,
  getTypeDetail,
} from "@/server/analytics";
import { getNewVsOldBreakdown, type Segment } from "@/server/catalog";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProductTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { type: rawType } = await params;
  const type = decodeURIComponent(rawType);
  const sp = await searchParams;
  const showAll = one(sp.view) === "all";
  const fulfilment = one(sp.fulfilment);
  const segRaw = one(sp.segment);
  const segment: Segment = segRaw === "new" || segRaw === "old" ? segRaw : "all";
  const f = await getFilters();

  const [detail, products, fulfilmentTypes, split] = await Promise.all([
    getTypeDetail(f, type),
    getTopProductsForType(f, type, { limit: showAll ? null : 20, fulfilment, segment }),
    getFulfilmentTypesForType(f, type),
    getNewVsOldBreakdown(f, type),
  ]);
  if (!detail.orders) notFound();

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/analytics`}
        title={type}
        subtitle="Performance Insights & Product Breakdown"
      />

      <div className="anim-stack grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total Sale Value" value={formatCurrency(detail.revenue)} money />
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
        <CardBody className="flex flex-col gap-4 pb-0 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle
            title={
              showAll
                ? `All Products with Sales (${formatNumber(products.length)})`
                : `Top ${products.length} Best Selling Products`
            }
            icon={<CircleCheck className="h-5 w-5" />}
          />
          <ProductTableControls fulfilmentTypes={fulfilmentTypes} />
        </CardBody>

        {/* New vs old split for this product type (always over the full type). */}
        <div className="grid grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-3 sm:px-6">
          <SplitStat
            label="New products"
            hint="Added in the last 3 months"
            stat={split.new}
            tone="pos"
          />
          <SplitStat label="Established" hint="Older catalog products" stat={split.old} tone="ink" />
          <SplitStat
            label="Not in catalog"
            hint="Unmatched to the uploaded catalog"
            stat={split.unmatched}
            tone="soft"
          />
        </div>

        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-5 py-3.5">Added</th>
                <th className="px-5 py-3.5 text-right">Units Sold</th>
                <th className="px-5 py-3.5 text-right">AOV</th>
                <th className="px-5 py-3.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-ink-soft">
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
                      <span className="flex flex-col gap-1">
                        <span className="font-semibold text-ink">{p.name}</span>
                        {p.fulfilment && (
                          <span>
                            <FulfilmentBadge value={p.fulfilment} />
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <CatalogTag createdAt={p.createdAt} isNew={p.isNew} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-ink tnum">
                    {formatNumber(p.units)}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-soft tnum">
                    {formatCurrency(p.aov)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-pos tnum">
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
