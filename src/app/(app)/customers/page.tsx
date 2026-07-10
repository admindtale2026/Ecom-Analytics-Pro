import { Users, HeartHandshake, History, CreditCard, UserPlus, Crown, Phone, Mail } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Donut } from "@/components/charts/donut";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getCustomers, getIdentityMode, summarizeCustomers } from "@/server/customers";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const f = parseFilters(await searchParams);
  const mode = await getIdentityMode();
  const rows = await getCustomers(f, mode);
  const stats = summarizeCustomers(rows);
  const vips = rows.slice(0, 10);

  return (
    <div className="space-y-6 anim-rise">
      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Unique Customers" value={formatNumber(stats.unique)} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Repeat Buyers" value={formatNumber(stats.repeat)} icon={<HeartHandshake className="h-5 w-5" />} />
        <KpiCard label="Retention Rate" value={formatPercent(stats.retentionRate)} icon={<History className="h-5 w-5" />} />
        {/*
          The reference app printed "₹NaN" here. summarizeCustomers divides
          through safeDivide, so an empty period reads ₹0 instead.
        */}
        <KpiCard label="Avg Lifetime Value" value={formatCurrency(stats.avgLifetimeValue)} icon={<CreditCard className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <Card>
          <CardBody>
            <CardTitle
              title="Loyalty Segmentation"
              subtitle={
                mode === "both"
                  ? "Identity matched via mobile and email"
                  : `Identity matched via ${mode}`
              }
              icon={<UserPlus className="h-5 w-5" />}
            />
            <Donut
              data={[
                { label: "Repeat Buyers", value: stats.repeat },
                { label: "One-time Buyers", value: stats.oneTime },
              ]}
              height={220}
              money={false}
              stack
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="p-5 sm:p-6 sm:pb-0">
              <CardTitle
                title="VIP Buyer Ranking"
                subtitle="Calculated by total revenue contribution"
                icon={<Crown className="h-5 w-5" />}
              />
            </div>
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-y border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-semibold sm:px-6">Customer</th>
                    <th className="px-5 py-3 font-semibold">Orders</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 text-right font-semibold">Gross Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {vips.map((c, i) => (
                    <tr key={`${c.name}-${i}`} className="row-hover border-b border-line last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3.5 sm:px-6">
                        <span className="flex items-center gap-2.5">
                          <span
                            className={
                              i === 0
                                ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700"
                                : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-ink-soft"
                            }
                          >
                            {i + 1}
                          </span>
                          <span className="font-semibold text-ink">{c.name}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600 tnum">
                          {formatNumber(c.orders)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex flex-col gap-0.5 text-xs text-ink-soft">
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="tnum">{c.mobile || "—"}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{c.email || "—"}</span>
                          </span>
                        </span>
                      </td>
                      {/* Also "₹NaN" in the reference; formatCurrency guards it. */}
                      <td className="px-5 py-3.5 text-right font-bold text-ink tnum">
                        {formatCurrency(c.spend)}
                      </td>
                    </tr>
                  ))}
                  {!vips.length && (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-sm text-ink-soft">
                        No customers in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
