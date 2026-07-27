import Link from "next/link";
import { ProductThumb } from "@/components/ui/product-thumb";
import { ClickableRow } from "@/components/ui/clickable-row";
import { MiniBar } from "@/components/ui/page-header";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { ProductListRow } from "@/server/inventory";

export function ProductsTable({
  products,
  maxUnits,
  hasFilters,
}: {
  products: ProductListRow[];
  maxUnits: number;
  hasFilters: boolean;
}) {
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-soft">
            <th className="px-5 py-3.5 font-semibold sm:px-6">Product Details</th>
            <th className="px-5 py-3.5 font-semibold">Category</th>
            <th className="px-5 py-3.5 font-semibold">SKU</th>
            <th className="px-5 py-3.5 text-right font-semibold">Orders</th>
            <th className="px-5 py-3.5 font-semibold">Units Sold</th>
            <th className="px-5 py-3.5 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ClickableRow
              key={p.name}
              href={`/inventory/${p.slug}`}
              className="group row-hover border-b border-line last:border-0 hover:bg-slate-50"
            >
              <td className="px-5 py-4 sm:px-6">
                <span className="flex items-center gap-3">
                  <ProductThumb imageUrl={p.imageUrl} name={p.name} size={44} />
                  <span className="min-w-0">
                    {/* Real anchor so the name navigates even pre-hydration. */}
                    <Link
                      href={`/inventory/${p.slug}`}
                      className="block truncate font-semibold text-ink group-hover:text-brand-600"
                    >
                      {p.name}
                    </Link>
                  </span>
                </span>
              </td>
              <td className="px-5 py-4">
                {p.category ? (
                  <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
                    {p.category}
                  </span>
                ) : (
                  <span className="text-xs text-ink-soft">—</span>
                )}
              </td>
              <td className="px-5 py-4">
                <code className="text-xs text-ink-soft">{p.sku || "—"}</code>
              </td>
              <td className="px-5 py-4 text-right text-ink tnum">{formatNumber(p.orders)}</td>
              <td className="w-40 px-5 py-4">
                <span className="mb-1.5 block text-sm font-semibold text-ink tnum">
                  {formatNumber(p.units)}
                </span>
                <MiniBar value={p.units} max={maxUnits} />
              </td>
              <td className="px-5 py-4 text-right">
                <span className="block font-bold text-pos tnum">{formatCurrency(p.revenue)}</span>
                <span className="block text-[11px] text-ink-soft tnum">
                  avg. {formatCurrency(p.avgPrice)}
                </span>
              </td>
            </ClickableRow>
          ))}
          {!products.length && (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center text-sm text-ink-soft">
                {hasFilters ? "No products match those filters." : "No products in this period."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
