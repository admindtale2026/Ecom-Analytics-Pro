import { Suspense } from "react";
import Link from "next/link";
import { Target, Sparkles, TrendingUp, Compass } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/kpi-card";
import { OpportunityScatter } from "@/components/charts/opportunity-scatter";
import { MapCard, MapCardSkeleton } from "@/components/charts/map-card";
import { getFilters } from "@/lib/filters-server";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  QUADRANT_BLURBS,
  QUADRANT_COLORS,
  QUADRANT_LABELS,
  recommendCities,
  type Quadrant,
} from "@/lib/opportunity";
import { getOpportunityCities } from "@/server/opportunity";

export const dynamic = "force-dynamic";

const QUADRANT_ORDER: Quadrant[] = ["scale", "defend", "hold", "nurture"];

export default async function OpportunityPage() {
  const f = await getFilters();
  const { cities, medianOrders, medianAov } = await getOpportunityCities(f);
  const recommended = recommendCities(cities, medianOrders);

  const counts = Object.fromEntries(
    QUADRANT_ORDER.map((q) => [q, cities.filter((c) => c.quadrant === q).length]),
  ) as Record<Quadrant, number>;

  return (
    <div className="space-y-6 anim-rise">
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink">
          <Target className="h-5 w-5 text-brand-500" />
          Ad Spend Opportunity
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Cities are split against the <strong className="font-semibold text-ink">median</strong> city —
          not the mean, which a couple of runaway metros would drag upward.
          {f.salespeople.length ? ` Scoped to ${f.salespeople.join(", ")}.` : ""}
        </p>
      </div>

      <div className="anim-stack grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Active Cities" value={formatNumber(cities.length)} />
        <StatTile label="Median Orders / City" value={formatNumber(Math.round(medianOrders))} />
        <StatTile label="Median Basket" value={formatCurrency(medianAov)} />
        <StatTile label="Scale Candidates" value={formatNumber(counts.scale)} accent />
      </div>

      {/* The recommendation is the point of the page, so it leads. */}
      <Card>
        <CardBody>
          <CardTitle
            title="Where to spend next"
            subtitle="High basket value, below-median order volume — ranked by revenue headroom"
            icon={<Sparkles className="h-5 w-5" />}
          />
          {recommended.length ? (
            <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {recommended.map((c, i) => (
                <li key={`${c.city}-${c.state}`}>
                  <div className="h-full rounded-2xl border border-line p-5 transition-shadow duration-200 ease-out hover:shadow-[0_8px_20px_rgba(16,24,40,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-lg font-bold text-ink">{c.city}</span>
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                          {c.state}
                        </span>
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                        {i + 1}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-bold text-pos tnum">
                      +{formatCurrency(c.headroom)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                      Est. headroom
                    </p>
                    <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-ink-soft">Basket</dt>
                        <dd className="font-semibold text-ink tnum">{formatCurrency(c.aov)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-soft">Orders</dt>
                        <dd className="font-semibold text-ink tnum">
                          {formatNumber(c.orders)} vs {formatNumber(Math.round(medianOrders))} median
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/regions/city/${encodeURIComponent(c.city)}`}
                      className="mt-4 inline-flex text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Inspect {c.city} →
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-12 text-center text-sm text-ink-soft">
              No city currently shows above-median basket value with below-median volume. Either the
              filter is too narrow, or spend is already well distributed.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Streams in after the KPIs and recommendations have already painted. */}
        <Suspense fallback={<MapCardSkeleton />}>
          <MapCard
            filters={f}
            subtitle="States shaded by revenue; bubbles sized by city revenue, coloured by quadrant"
            showUnplaced
          />
        </Suspense>

        <Card>
          <CardBody>
            <CardTitle
              title="Opportunity Matrix"
              subtitle="Order volume against average basket value"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <OpportunityScatter
              cities={cities}
              medianOrders={medianOrders}
              medianAov={medianAov}
              height={420}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle title="What the quadrants mean" icon={<Compass className="h-5 w-5" />} />
          {/* A `dl` may only contain dt/dd, or divs wrapping them — the swatch lives inside dt. */}
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {QUADRANT_ORDER.map((q) => (
              <div key={q} className="rounded-2xl border border-line p-4">
                <dt className="flex items-baseline gap-2 font-bold text-ink">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 self-start rounded-full"
                    style={{ background: QUADRANT_COLORS[q] }}
                  />
                  {QUADRANT_LABELS[q]}
                  <span className="text-xs font-semibold text-ink-soft tnum">
                    {formatNumber(counts[q])} cities
                  </span>
                </dt>
                <dd className="mt-0.5 pl-[18px] text-sm text-ink-soft">{QUADRANT_BLURBS[q]}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
