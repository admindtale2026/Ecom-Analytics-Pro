import { Map as MapIcon, Info } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { IndiaHeatmapLazy } from "./india-heatmap-lazy";
import type { Filters } from "@/lib/filters";
import { formatCurrency } from "@/lib/utils";
import { getGeoData } from "@/server/geo";
import { getOpportunityCities } from "@/server/opportunity";

/**
 * The map's two queries are the heaviest on their pages. Rendering this as its
 * own async server component lets the caller wrap it in <Suspense>, so the KPI
 * row and recommendations paint immediately and the map streams in after.
 */
export async function MapCard({
  filters,
  title = "Revenue Map",
  subtitle,
  showUnplaced = false,
}: {
  filters: Filters;
  title?: string;
  subtitle?: string;
  showUnplaced?: boolean;
}) {
  const [geo, opportunity] = await Promise.all([
    getGeoData(filters),
    getOpportunityCities(filters),
  ]);

  // Colour bubbles by the quadrant the scatter already computed, so the two
  // views can never disagree about a city.
  const quadrantOf = Object.fromEntries(opportunity.cities.map((c) => [c.city, c.quadrant]));
  const unplacedRevenue = geo.unplaced.reduce((s, u) => s + u.revenue, 0);

  return (
    <Card>
      <CardBody>
        <CardTitle title={title} subtitle={subtitle} icon={<MapIcon className="h-5 w-5" />} />
        <IndiaHeatmapLazy
          states={geo.states}
          bubbles={geo.bubbles}
          maxStateRevenue={geo.maxStateRevenue}
          maxCityRevenue={geo.maxCityRevenue}
          quadrantOf={quadrantOf}
        />

        {/*
          Revenue with no coordinate would otherwise vanish from the map without
          a trace. Name it, so the map is never quietly wrong.
        */}
        {showUnplaced && geo.unplaced.length ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
            <p className="text-xs text-ink-soft">
              <strong className="font-semibold text-ink">{formatCurrency(unplacedRevenue)}</strong>{" "}
              across {geo.unplaced.length} cit{geo.unplaced.length === 1 ? "y" : "ies"} has no bubble
              — no coordinate on file for{" "}
              {geo.unplaced
                .slice(0, 4)
                .map((u) => u.city)
                .join(", ")}
              {geo.unplaced.length > 4 ? ` +${geo.unplaced.length - 4} more` : ""}. It still counts
              toward the state shading. Add them to{" "}
              <code className="text-[11px]">src/lib/geo/city-coords.ts</code>.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Placeholder shown while MapCard's queries resolve. */
export function MapCardSkeleton({ title = "Revenue Map" }: { title?: string }) {
  return (
    <Card>
      <CardBody>
        <CardTitle title={title} icon={<MapIcon className="h-5 w-5" />} />
        <div
          className="animate-pulse rounded-2xl bg-slate-50"
          style={{ aspectRatio: "620 / 700" }}
          aria-label="Loading map"
        />
      </CardBody>
    </Card>
  );
}
