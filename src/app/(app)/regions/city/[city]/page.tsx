import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Users, Tag, Package, TrendingUp, UserCheck } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { DetailHeader } from "@/components/ui/page-header";
import { Donut } from "@/components/charts/donut";
import { RevenueLine } from "@/components/charts/revenue-line";
import { HBar } from "@/components/charts/bar-chart";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { UNATTRIBUTED } from "@/server/base";
import {
  getCities,
  getCityCustomerInsight,
  getCityDetail,
  getCityTrend,
  getProductsInCity,
  getRepsInCity,
  getTypeMixInCity,
} from "@/server/regions";

export const dynamic = "force-dynamic";

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: raw } = await params;
  const city = decodeURIComponent(raw);
  const f = await getFilters();

  const [detail, reps, typeMix, products, trend, insight, allCities] = await Promise.all([
    getCityDetail(f, city),
    getRepsInCity(f, city),
    getTypeMixInCity(f, city),
    getProductsInCity(f, city),
    getCityTrend(f, city),
    getCityCustomerInsight(f, city),
    getCities(f),
  ]);

  if (!detail.orders) notFound();
  const state = allCities.find((c) => c.name === city)?.state ?? "Unknown";

  /*
   * The reference badged this "START PERFORMER: UNKNOWN" — a typo, and the
   * blank-salesperson bucket outranking real reps. We name the bucket
   * "Unattributed" and only badge a genuine person.
   */
  const topRep = reps.find((r) => r.name !== UNATTRIBUTED) ?? null;

  return (
    <div className="space-y-6 anim-rise">
      <DetailHeader
        backHref={`/regions`}
        eyebrow={state}
        icon={<MapPin className="h-3.5 w-3.5" />}
        title={city}
        subtitle="City comprehensive analytics"
      />

      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Total Revenue" value={formatCurrency(detail.revenue)} money />
        <StatTile label="Total Orders" value={formatNumber(detail.orders)} />
        <StatTile label="Units Sold" value={formatNumber(detail.units)} />
        <StatTile label="Avg Order Value" value={formatCurrency(detail.aov)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="p-5 sm:p-6 sm:pb-0">
              <CardTitle title="Top Selling Products" icon={<Package className="h-5 w-5" />} />
            </div>
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-semibold sm:px-6">Product</th>
                    <th className="px-5 py-3 text-right font-semibold">Orders</th>
                    <th className="px-5 py-3 text-right font-semibold">Qty</th>
                    <th className="px-5 py-3 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.name} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 sm:px-6">
                        <Link
                          href={`/inventory/${encodeURIComponent(p.name)}`}
                          className="font-semibold text-ink hover:text-brand-600"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right text-ink tnum">{formatNumber(p.orders)}</td>
                      <td className="px-5 py-3 text-right text-ink tnum">{formatNumber(p.units)}</td>
                      <td className="px-5 py-3 text-right font-bold text-pos tnum">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle title="Product Contribution" subtitle="Revenue share by top products" icon={<Tag className="h-5 w-5" />} />
            <Donut data={typeMix} height={200} centerLabel="Revenue" stack />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <CardTitle
              title="Top Salespersons"
              subtitle="Best performers in this city"
              icon={<Users className="h-5 w-5" />}
              action={
                topRep ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Star performer: {topRep.name}
                  </span>
                ) : undefined
              }
            />
            <HBar data={reps.map((r) => ({ label: r.name, value: r.revenue }))} height={260} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle title="Customer Insights" icon={<UserCheck className="h-5 w-5" />} />
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-line bg-slate-50/60 p-5 text-center">
                <p className="text-2xl font-bold text-ink tnum">{formatNumber(insight.totalCustomers)}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  Total customers
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-slate-50/60 p-5 text-center">
                <p className="text-2xl font-bold text-brand-600 tnum">{formatPercent(insight.repeatRate)}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  Repeat rate
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-ink-soft">
              {insight.repeatCustomers === 0
                ? `No repeat buyers in ${city} yet.`
                : `${formatNumber(insight.repeatCustomers)} customer${insight.repeatCustomers === 1 ? " has" : "s have"} placed more than one order in ${city}.`}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle title="Sales Trend" subtitle={`Daily revenue in ${city}`} icon={<TrendingUp className="h-5 w-5" />} />
          <RevenueLine data={trend} height={260} />
        </CardBody>
      </Card>
    </div>
  );
}
