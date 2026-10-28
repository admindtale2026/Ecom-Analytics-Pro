import Link from "next/link";
import { PackageX, Layers, Info, TrendingDown, BarChart3 } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { ClickableRow } from "@/components/ui/clickable-row";
import { ProductThumb } from "@/components/ui/product-thumb";
import { CatalogTag } from "@/components/analytics/catalog-bits";
import { DeadStockControls } from "@/components/dead-stock/dead-stock-controls";
import { DeadRatioBar } from "@/components/charts/dead-ratio-bar";
import { type SearchParams } from "@/lib/filters";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber, formatDMY, cn } from "@/lib/utils";
import {
  getDeadStockSummary,
  getDeadStockProducts,
  SLOW_MAX_UNITS,
  type DeadStockTier,
  type DeadAction,
} from "@/server/dead-stock";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DeadStockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const f = await getFilters();

  const category = one(sp.category);
  const tierRaw = one(sp.tier);
  const tier = tierRaw === "dead" || tierRaw === "slow" ? tierRaw : undefined;

  const [summary, productsList] = await Promise.all([
    getDeadStockSummary(f),
    getDeadStockProducts(f, { category, tier }),
  ]);

  // Empty summary = the store has no uploaded catalog to measure against.
  if (summary.length === 0) {
    return (
      <div className="anim-rise">
        <Card>
          <CardBody className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
            <p className="text-sm text-ink-soft">
              No product catalog found for this store. Upload the Magento product export under{" "}
              <Link
                href="/admin/settings?tab=catalog"
                className="font-semibold text-brand-600 hover:underline"
              >
                Admin → Product Catalog
              </Link>{" "}
              to see which products aren&apos;t selling. Include the{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">attribute_set_code</code>,{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">price</code> and{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">status</code> columns —
              categories, value-at-risk and the Disabled filter read from them.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const totals = summary.reduce(
    (a, c) => {
      a.dead += c.dead;
      a.slow += c.slow;
      a.valueAtRisk += c.valueAtRisk;
      a.affected += c.dead + c.slow > 0 ? 1 : 0;
      return a;
    },
    { dead: 0, slow: 0, valueAtRisk: 0, affected: 0 },
  );

  const categoryNames = summary.map((c) => c.category);

  // Share of each category's catalog that isn't moving — hottest first, top 12.
  const ratioData = summary
    .map((c) => ({ label: c.category, value: c.catalog ? ((c.dead + c.slow) / c.catalog) * 100 : 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const exportHref = `/api/catalog/dead-stock-export${buildQuery({ category, tier })}`;

  return (
    <div className="space-y-6 anim-rise">
      {/* Headline counts */}
      <div className="anim-stack grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Dead products" value={formatNumber(totals.dead)} sub="0 units sold" />
        <StatTile
          label="Slow movers"
          value={formatNumber(totals.slow)}
          sub={`1–${SLOW_MAX_UNITS} units sold`}
        />
        <StatTile
          label="Value at risk"
          value={formatCurrency(totals.valueAtRisk)}
          sub="list value of non-moving stock"
          accent
        />
        <StatTile label="Categories affected" value={formatNumber(totals.affected)} />
      </div>

      {/* Range hint — this view honours the global date filter. */}
      <Card>
        <CardBody className="flex items-start gap-3 py-4">
          <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
          <p className="text-sm text-ink-soft">
            &ldquo;Not selling&rdquo; is measured over the active range —{" "}
            <span className="font-semibold text-ink">{f.rangeLabel}</span>. For a true dead-stock
            picture, widen the date filter (e.g. <span className="font-semibold">All Time</span> or a
            full quarter) so a product isn&apos;t flagged dead just for a quiet month.{" "}
            <span className="text-ink-soft/80">Days-idle and value-at-risk are lifetime figures and
            ignore the filter.</span>
          </p>
        </CardBody>
      </Card>

      {/* Where dead stock concentrates */}
      {ratioData.length > 0 && (
        <Card>
          <CardBody>
            <CardTitle
              title="Where dead stock concentrates"
              subtitle="Share of each category's catalog that is dead or slow — spot structurally overstocked sets"
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <div className="mt-2">
              <DeadRatioBar data={ratioData} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Category-wise overview */}
      <Card>
        <CardBody className="pb-0">
          <CardTitle
            title="By category"
            subtitle="Non-moving products in each attribute set — click a row to filter the list below"
            icon={<Layers className="h-5 w-5" />}
          />
        </CardBody>
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-right">Catalog</th>
                <th className="px-5 py-3.5 text-right">Dead</th>
                <th className="px-5 py-3.5 text-right">Slow</th>
                <th className="px-5 py-3.5 text-right">Moving</th>
                <th className="px-5 py-3.5 text-right">Value at risk</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((c) => (
                <ClickableRow
                  key={c.category}
                  href={`/dead-stock?category=${encodeURIComponent(c.category)}`}
                  className="group row-hover border-b border-line/70 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/dead-stock?category=${encodeURIComponent(c.category)}`}
                      className="font-semibold text-ink transition-colors duration-150 group-hover:text-brand-600"
                    >
                      {c.category}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink-soft tnum">
                    {formatNumber(c.catalog)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold tnum">
                    {c.dead > 0 ? (
                      <span className="text-neg">{formatNumber(c.dead)}</span>
                    ) : (
                      <span className="text-ink-soft/60">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold tnum">
                    {c.slow > 0 ? (
                      <span className="text-amber-600">{formatNumber(c.slow)}</span>
                    ) : (
                      <span className="text-ink-soft/60">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right text-ink-soft tnum">
                    {formatNumber(c.moving)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold tnum text-ink">
                    {c.valueAtRisk > 0 ? formatCurrency(c.valueAtRisk) : <span className="text-ink-soft/60">—</span>}
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail list */}
      <Card>
        <CardBody>
          <CardTitle
            title="Products not moving"
            subtitle={
              category
                ? `${category} — dead & slow movers, highest risk first`
                : "Every dead & slow product across the catalog, highest risk first"
            }
            icon={<PackageX className="h-5 w-5" />}
            action={
              productsList.length > 0 ? (
                <a
                  href={exportHref}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-semibold text-ink-soft shadow-sm transition-colors hover:text-brand-600"
                >
                  Export CSV
                </a>
              ) : undefined
            }
          />
          <DeadStockControls categories={categoryNames} />
        </CardBody>
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">SKU</th>
                <th className="px-5 py-3.5">Added</th>
                <th className="px-5 py-3.5">Last sold</th>
                <th className="px-5 py-3.5 text-right">Value</th>
                <th className="px-5 py-3.5 text-right">Risk</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {productsList.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-ink-soft">
                    No dead or slow products for this selection.
                  </td>
                </tr>
              )}
              {productsList.map((p) => (
                <tr
                  key={`${p.category}:${p.sku}:${p.name}`}
                  className="row-hover border-b border-line/70 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <ProductThumb imageUrl={null} name={p.name} />
                      <span className="flex flex-col">
                        <span className="font-semibold text-ink">{p.name}</span>
                        <span className="flex items-center gap-1.5">
                          <TierBadge tier={p.tier} />
                          {p.daysToFirstSale != null && (
                            <span className="text-[11px] text-ink-soft/70">
                              sold after {formatNumber(p.daysToFirstSale)}d
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex flex-col gap-0.5">
                      <code className="text-xs text-ink-soft">{p.sku || "—"}</code>
                      {p.skuCount > 1 && (
                        <span className="text-[11px] font-medium text-ink-soft/70">
                          ×{p.skuCount} variants
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <CatalogTag createdAt={p.createdAt} isNew={p.isNew} />
                  </td>
                  <td className="px-5 py-3">
                    <IdleCell lastSold={p.lastSold} daysIdle={p.daysIdle} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tnum text-ink">
                    {p.price != null ? formatCurrency(p.price) : <span className="text-ink-soft/60">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RiskBadge score={p.riskScore} />
                  </td>
                  <td className="px-5 py-3">
                    <ActionPill action={p.action} />
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

/** Build a `?a=b&c=d` string from defined params (keeps the export in sync with the view). */
function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function IdleCell({ lastSold, daysIdle }: { lastSold: Date | null; daysIdle: number | null }) {
  if (daysIdle == null) {
    return <span className="text-xs font-semibold text-neg">Never sold</span>;
  }
  return (
    <span className="flex flex-col">
      <span className="text-sm font-semibold text-ink tnum">{formatNumber(daysIdle)}d idle</span>
      {lastSold && <span className="text-[11px] text-ink-soft/70 tnum">{formatDMY(lastSold)}</span>}
    </span>
  );
}

function RiskBadge({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "bg-rose-50 text-neg"
      : score >= 40
        ? "bg-amber-50 text-amber-600"
        : "bg-slate-100 text-ink-soft";
  return (
    <span className={cn("inline-flex min-w-9 justify-center rounded-md px-2 py-0.5 text-[12px] font-bold tnum", tone)}>
      {score}
    </span>
  );
}

const ACTION_TONE: Record<DeadAction, string> = {
  Liquidate: "bg-rose-50 text-neg",
  Discount: "bg-amber-50 text-amber-600",
  Bundle: "bg-brand-50 text-brand-600",
  Watch: "bg-slate-100 text-ink-soft",
};

function ActionPill({ action }: { action: DeadAction }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        ACTION_TONE[action],
      )}
    >
      {action}
    </span>
  );
}

function TierBadge({ tier }: { tier: DeadStockTier }) {
  if (tier === "dead") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-neg">
        Dead
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-600">
      Slow
    </span>
  );
}
