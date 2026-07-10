import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Users, Building2, Tag, Package } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { DetailHeader } from "@/components/ui/page-header";
import { Donut } from "@/components/charts/donut";
import { parseFilters, filtersToQuery, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber, initials } from "@/lib/utils";
import {
  getCitiesInState,
  getProductsInState,
  getRepsInState,
  getStateDetail,
  getTypeMixInState,
} from "@/server/regions";

export const dynamic = "force-dynamic";

export default async function StatePage({
  params,
  searchParams,
}: {
  params: Promise<{ state: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { state: raw } = await params;
  const state = decodeURIComponent(raw);
  const f = parseFilters(await searchParams);

  const [detail, cities, reps, typeMix, products] = await Promise.all([
    getStateDetail(f, state),
    getCitiesInState(f, state),
    getRepsInState(f, state),
    getTypeMixInState(f, state),
    getProductsInState(f, state),
  ]);

  if (!detail.orders) notFound();

  const query = filtersToQuery(f);

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/regions?${query}`}
        title={state}
        subtitle="State comprehensive analytics and market share"
        icon={<Globe className="h-3.5 w-3.5" />}
        eyebrow="Region"
      />

      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="State Revenue" value={formatCurrency(detail.revenue)} accent />
        <StatTile label="Total Orders" value={formatNumber(detail.orders)} sub={`${formatNumber(detail.units)} units sold`} />
        <StatTile label="Avg Order Value" value={formatCurrency(detail.aov)} />
        <StatTile label="Unique Customers" value={formatNumber(detail.uniqueCustomers)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle title="Top Performing Cities" icon={<Building2 className="h-5 w-5" />} />
            <ol className="space-y-2">
              {cities.map((c, i) => (
                <li key={c.name}>
                  <Link
                    href={`/regions/city/${encodeURIComponent(c.name)}?${query}`}
                    className="row-hover flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-ink-soft">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                        <span className="block text-xs text-ink-soft tnum">{formatNumber(c.orders)} orders</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-ink tnum">{formatCurrency(c.revenue)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle title="Sales Team Leadership" icon={<Users className="h-5 w-5" />} />
            <ul className="space-y-2">
              {reps.map((r) => (
                <li
                  key={r.name}
                  className="row-hover flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                      {initials(r.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                      <span className="block text-xs text-ink-soft tnum">{formatNumber(r.orders)} deals closed</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-pos tnum">{formatCurrency(r.revenue)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Card>
          <CardBody>
            <CardTitle title="Category Mix" icon={<Tag className="h-5 w-5" />} />
            {/*
              Ingest title-cases product types, so "Warehouse sale" and
              "Warehouse Sale" no longer appear as two slices of one donut.
            */}
            <Donut data={typeMix} height={220} stack />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="p-5 sm:p-6 sm:pb-0">
              <CardTitle title="Top Selling Products" subtitle="Ranked by revenue contribution" icon={<Package className="h-5 w-5" />} />
            </div>
            <div className="max-h-[520px] overflow-auto scroll-slim">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-semibold sm:px-6">Product</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 text-right font-semibold">Units</th>
                    <th className="px-5 py-3 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.name} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 sm:px-6">
                        <span className="flex items-center gap-2.5">
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft tnum">
                            {i + 1}
                          </span>
                          <Link
                            href={`/inventory/${encodeURIComponent(p.name)}?${query}`}
                            className="truncate font-semibold text-ink hover:text-brand-600"
                          >
                            {p.name}
                          </Link>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {p.productType ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-ink tnum">{formatNumber(p.units)}</td>
                      <td className="px-5 py-3 text-right font-bold text-ink tnum">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Revenue" value={formatCurrency(detail.revenue)} sub="Across all cities" />
        <StatTile label="Orders" value={formatNumber(detail.orders)} sub={`${cities.length} cities active`} />
        <StatTile label="Reps Active" value={formatNumber(reps.length)} sub="Selling into this state" />
      </div>
    </div>
  );
}
