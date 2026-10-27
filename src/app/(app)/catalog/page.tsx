import Link from "next/link";
import { Sparkles, Clock, Scale, Info } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { HBar } from "@/components/charts/bar-chart";
import { ProductThumb } from "@/components/ui/product-thumb";
import { CatalogTag, SplitStat } from "@/components/analytics/catalog-bits";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  getNewVsOldBreakdown,
  getProductsBySegment,
  type SegmentProductRow,
} from "@/server/catalog";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const f = await getFilters();
  const [split, newProducts, oldProducts] = await Promise.all([
    getNewVsOldBreakdown(f),
    getProductsBySegment(f, "new", { limit: 50 }),
    getProductsBySegment(f, "old", { limit: 50 }),
  ]);

  const matched = split.new.products + split.old.products;
  const barData = [
    { label: "New", value: split.new.revenue },
    { label: "Established", value: split.old.revenue },
    { label: "Not in catalog", value: split.unmatched.revenue },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 anim-rise">
      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SplitStat
          label="New products"
          hint="Created in the last 3 months"
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

      {matched === 0 ? (
        <Card>
          <CardBody className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
            <p className="text-sm text-ink-soft">
              No sold products matched a catalog for this store and period. Upload the Magento product
              export under{" "}
              <Link
                href="/admin/settings?tab=catalog"
                className="font-semibold text-brand-600 hover:underline"
              >
                Admin → Product Catalog
              </Link>{" "}
              to classify products as new vs old.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <CardTitle
              title="Revenue: New vs Established"
              subtitle="How much of this period's revenue comes from recently added products"
              icon={<Scale className="h-5 w-5" />}
            />
            <HBar data={barData} height={220} />
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProductTable
          title="New products sold"
          subtitle="Added in the last 3 months"
          icon={<Sparkles className="h-5 w-5" />}
          rows={newProducts}
          emptyLabel="No new products sold in this period."
        />
        <ProductTable
          title="Established products sold"
          subtitle="Older catalog products, with their creation date"
          icon={<Clock className="h-5 w-5" />}
          rows={oldProducts}
          emptyLabel="No established products sold in this period."
        />
      </div>
    </div>
  );
}

function ProductTable({
  title,
  subtitle,
  icon,
  rows,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: SegmentProductRow[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardBody className="pb-0">
        <CardTitle title={`${title} (${formatNumber(rows.length)})`} subtitle={subtitle} icon={icon} />
      </CardBody>
      <div className="overflow-x-auto scroll-slim">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3.5">Product</th>
              <th className="px-5 py-3.5">Added</th>
              <th className="px-5 py-3.5 text-right">Units</th>
              <th className="px-5 py-3.5 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-ink-soft">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {rows.map((p) => (
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
                <td className="px-5 py-3">
                  <CatalogTag createdAt={p.createdAt} isNew={p.isNew} />
                </td>
                <td className="px-5 py-3 text-right font-semibold text-ink tnum">
                  {formatNumber(p.units)}
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
  );
}
