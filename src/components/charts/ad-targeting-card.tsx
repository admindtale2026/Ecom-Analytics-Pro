import { Crosshair, Info } from "lucide-react";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { AdTargetingMapLazy } from "./ad-targeting-map-lazy";
import type { Filters } from "@/lib/filters";
import { formatCurrency } from "@/lib/utils";
import { getGeoData } from "@/server/geo";
import { getOpportunityCities } from "@/server/opportunity";

/**
 * Interactive ad-targeting map. Reuses the same geo + opportunity aggregates as
 * the choropleth `MapCard`, but renders a Leaflet tile map with measurement
 * tools (ad-radius reach + point-to-point distance). Rendered as its own async
 * server component so the page can stream it in behind <Suspense>.
 */
export async function AdTargetingCard({ filters }: { filters: Filters }) {
  const [geo, opportunity] = await Promise.all([
    getGeoData(filters),
    getOpportunityCities(filters),
  ]);
  const quadrantOf = Object.fromEntries(opportunity.cities.map((c) => [c.city, c.quadrant]));
  const unplacedRevenue = geo.unplaced.reduce((s, u) => s + u.revenue, 0);

  return (
    <Card>
      <CardBody>
        <CardTitle
          title="Ad Targeting Map"
          subtitle="Pick a center and drag out an ad radius to see the reach, or measure the distance between two cities"
          icon={<Crosshair className="h-5 w-5" />}
        />
        <AdTargetingMapLazy
          bubbles={geo.bubbles}
          quadrantOf={quadrantOf}
          maxCityRevenue={geo.maxCityRevenue}
        />
        {geo.unplaced.length ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
            <p className="text-xs text-ink-soft">
              <strong className="font-semibold text-ink">{formatCurrency(unplacedRevenue)}</strong>{" "}
              across {geo.unplaced.length} cit{geo.unplaced.length === 1 ? "y" : "ies"} has no
              coordinate on file and is not plotted, so it is excluded from radius reach.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Placeholder while the map's queries resolve. */
export function AdTargetingCardSkeleton() {
  return (
    <Card>
      <CardBody>
        <CardTitle title="Ad Targeting Map" icon={<Crosshair className="h-5 w-5" />} />
        <div className="animate-pulse rounded-2xl bg-slate-50" style={{ height: 560 }} aria-label="Loading map" />
      </CardBody>
    </Card>
  );
}
