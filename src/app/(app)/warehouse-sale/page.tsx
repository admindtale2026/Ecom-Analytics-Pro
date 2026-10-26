import Link from "next/link";
import { Layers } from "lucide-react";
import { ClickableRow } from "@/components/ui/clickable-row";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { MiniBar } from "@/components/ui/page-header";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getProductTypeMatrix } from "@/server/analytics";

export const dynamic = "force-dynamic";

const FULFILMENT = "Warehouse Sale";

export default async function WarehouseSalePage() {
  const f = await getFilters();
  const matrix = await getProductTypeMatrix(f, { fulfilment: FULFILMENT });

  const maxAov = Math.max(1, ...matrix.map((m) => m.aov));
  const totalRevenue = matrix.reduce((s, r) => s + r.revenue, 0);
  const totalUnits = matrix.reduce((s, r) => s + r.units, 0);

  return (
    <div className="space-y-6 anim-rise">
      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Warehouse Sale Revenue" value={formatCurrency(totalRevenue)} money />
        <StatTile label="Product Types" value={formatNumber(matrix.length)} />
        <StatTile label="Units Sold" value={formatNumber(totalUnits)} />
      </div>

      <Card>
        <CardBody className="pb-0">
          <CardTitle
            title="Warehouse Sale by Product Type"
            subtitle="Revenue per order for Warehouse Sale products, by product type"
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
                    No Warehouse Sale products for this selection.
                  </td>
                </tr>
              )}
              {matrix.map((row) => {
                const href = `/analytics/${encodeURIComponent(row.productType)}?fulfilment=${encodeURIComponent(FULFILMENT)}`;
                return (
                  <ClickableRow
                    key={row.productType}
                    href={href}
                    className="group row-hover border-b border-line/70 last:border-0 hover:bg-brand-50/40"
                  >
                    <td className="px-5 py-3.5">
                      {/* Real anchor so the primary target navigates even before
                          the page finishes hydrating (the row-level onClick can't). */}
                      <Link
                        href={href}
                        className="font-semibold text-ink transition-colors duration-150 group-hover:text-brand-600"
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
                    <td className="px-5 py-3.5 text-right font-bold text-pos tnum">
                      {formatCurrency(row.revenue)}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
