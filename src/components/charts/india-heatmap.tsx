"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { compactNumber, formatCurrency, formatNumber } from "@/lib/utils";
import { QUADRANT_COLORS, type Quadrant } from "@/lib/opportunity";
import type { CityBubble, StateHeat } from "@/server/geo";

const WIDTH = 620;
const HEIGHT = 700;
const TOPO_URL = "/geo/india-states.topo.json";

type StateProps = { st_nm: string };

/** Choropleth ramp: the same indigo the rest of the app uses, light → dark. */
const HEAT = ["#f1f2fb", "#dcdefa", "#c0c3f4", "#9ea3ee", "#7b80e6", "#5d5fef", "#4338ca"];

function heatFill(revenue: number, max: number): string {
  if (revenue <= 0) return "#f6f7f9";
  // sqrt keeps mid-tier states visible next to one runaway metro state.
  const t = Math.sqrt(revenue / max);
  return HEAT[Math.min(HEAT.length - 1, Math.floor(t * HEAT.length))];
}

type Hover =
  | { kind: "state"; name: string; revenue: number; orders: number; x: number; y: number }
  | { kind: "city"; name: string; revenue: number; orders: number; x: number; y: number }
  | null;

export function IndiaHeatmap({
  states,
  bubbles,
  maxStateRevenue,
  maxCityRevenue,
  quadrantOf,
}: {
  states: StateHeat[];
  bubbles: CityBubble[];
  maxStateRevenue: number;
  maxCityRevenue: number;
  /** Colours a bubble by its ad-spend quadrant. */
  quadrantOf: Record<string, Quadrant>;
}) {
  const [geo, setGeo] = useState<FeatureCollection<Geometry, StateProps> | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<Hover>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((topo: Topology) => {
        if (cancelled) return;
        const obj = topo.objects[Object.keys(topo.objects)[0]] as GeometryCollection<StateProps>;
        setGeo(feature(topo, obj) as FeatureCollection<Geometry, StateProps>);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const revenueByState = useMemo(
    () => new Map(states.map((s) => [s.state, s])),
    [states],
  );

  // Projection is derived from the geometry, so it is computed once per load
  // rather than on every hover re-render.
  const { path, project } = useMemo(() => {
    if (!geo) return { path: null, project: null };
    const projection = geoMercator().fitSize([WIDTH, HEIGHT], geo);
    return { path: geoPath(projection), project: projection };
  }, [geo]);

  if (failed) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-ink-soft">
        Could not load the map data.
      </div>
    );
  }

  if (!geo || !path || !project) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-slate-50"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        aria-label="Loading map"
      />
    );
  }

  // Draw the smallest bubbles last so a big metro never hides a small city.
  const sorted = [...bubbles].sort((a, b) => b.revenue - a.revenue);

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Revenue by state and city across India"
      >
        <g>
          {geo.features.map((f: Feature<Geometry, StateProps>) => {
            const name = f.properties.st_nm;
            const row = revenueByState.get(name);
            const revenue = row?.revenue ?? 0;
            return (
              <path
                key={name}
                d={path(f) ?? undefined}
                fill={heatFill(revenue, maxStateRevenue)}
                stroke="#ffffff"
                strokeWidth={0.6}
                style={{ transition: "fill var(--dur-base) var(--ease-out)" }}
                onMouseEnter={(e) => {
                  const box = wrapRef.current?.getBoundingClientRect();
                  setHover({
                    kind: "state",
                    name,
                    revenue,
                    orders: row?.orders ?? 0,
                    x: e.clientX - (box?.left ?? 0),
                    y: e.clientY - (box?.top ?? 0),
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>

        <g>
          {sorted.map((b) => {
            const [cx, cy] = project([b.lng, b.lat]) ?? [0, 0];
            // Area-proportional: radius from the square root, so a city with 4x
            // the revenue draws 4x the ink, not 16x.
            const r = 3 + Math.sqrt(b.revenue / maxCityRevenue) * 17;
            const color = QUADRANT_COLORS[quadrantOf[b.city] ?? "nurture"];
            return (
              <circle
                key={`${b.city}-${b.state}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={0.55}
                stroke={color}
                strokeWidth={1.2}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const box = wrapRef.current?.getBoundingClientRect();
                  setHover({
                    kind: "city",
                    name: `${b.city}, ${b.state}`,
                    revenue: b.revenue,
                    orders: b.orders,
                    x: e.clientX - (box?.left ?? 0),
                    y: e.clientY - (box?.top ?? 0),
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-card px-3 py-2 shadow-lg"
          style={{ left: hover.x, top: hover.y - 10 }}
          role="tooltip"
        >
          <p className="text-xs font-bold text-ink">{hover.name}</p>
          <p className="text-xs text-ink-soft tnum">
            {formatCurrency(hover.revenue)} · {formatNumber(hover.orders)} orders
          </p>
        </div>
      ) : null}

      {/* Legend: the choropleth ramp reads as a scale, so it needs end labels. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            State revenue
          </span>
          <span className="flex overflow-hidden rounded-md">
            {HEAT.map((c) => (
              <span key={c} className="h-2.5 w-6" style={{ background: c }} />
            ))}
          </span>
          <span className="text-[11px] text-ink-soft tnum">
            ₹0 – ₹{compactNumber(maxStateRevenue)}
          </span>
        </div>
        <ul className="flex flex-wrap items-center gap-3">
          {(Object.keys(QUADRANT_COLORS) as Quadrant[]).map((q) => (
            <li key={q} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: QUADRANT_COLORS[q], opacity: 0.75 }}
              />
              {q}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
