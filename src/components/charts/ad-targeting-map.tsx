"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Ruler, Radius as RadiusIcon, X, MapPin } from "lucide-react";
import { compactNumber, formatCurrency, formatNumber } from "@/lib/utils";
import { QUADRANT_COLORS, type Quadrant } from "@/lib/opportunity";
import type { CityBubble } from "@/server/geo";
import { cn } from "@/lib/utils";

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(a: L.LatLng, b: L.LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type Mode = "none" | "distance" | "radius";

type Result =
  | null
  | { kind: "distance"; km: number; from: string; to: string }
  | { kind: "radius"; km: number; center: string; cities: number; orders: number; revenue: number };

const INDIA_BOUNDS = L.latLngBounds([6.0, 66.5], [37.5, 98.0]);
const MEASURE = "#d9433f"; // brand-independent measurement red, matches the reference

export function AdTargetingMap({
  bubbles,
  quadrantOf,
  maxCityRevenue,
}: {
  bubbles: CityBubble[];
  quadrantOf: Record<string, Quadrant>;
  maxCityRevenue: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const modeRef = useRef<Mode>("none");
  const pointsRef = useRef<{ latlng: L.LatLng; name: string }[]>([]);

  const [mode, setMode] = useState<Mode>("none");
  const [result, setResult] = useState<Result>(null);

  // Snap a raw click to the nearest city bubble within a few pixels, so
  // "distance between two cities" is exact and labelled rather than approximate.
  function snap(map: L.Map, latlng: L.LatLng): { latlng: L.LatLng; name: string } {
    const p = map.latLngToContainerPoint(latlng);
    let best: { b: CityBubble; d: number } | null = null;
    for (const b of bubbles) {
      const bp = map.latLngToContainerPoint([b.lat, b.lng]);
      const d = p.distanceTo(bp);
      if (d <= 16 && (!best || d < best.d)) best = { b, d };
    }
    return best
      ? { latlng: L.latLng(best.b.lat, best.b.lng), name: `${best.b.city}, ${best.b.state}` }
      : { latlng, name: "Custom point" };
  }

  function clearMeasure() {
    measureLayerRef.current?.clearLayers();
    pointsRef.current = [];
    setResult(null);
  }

  function chooseMode(m: Mode) {
    const next = modeRef.current === m ? "none" : m;
    modeRef.current = next;
    setMode(next);
    clearMeasure();
    const el = containerRef.current;
    if (el) el.style.cursor = next === "none" ? "" : "crosshair";
  }

  // Init the map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      minZoom: 4,
      maxBounds: INDIA_BOUNDS.pad(0.4),
    }).fitBounds(INDIA_BOUNDS);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    // City bubbles: area-proportional to revenue, coloured by ad-spend quadrant.
    const bubbleLayer = L.layerGroup().addTo(map);
    for (const b of bubbles) {
      const color = QUADRANT_COLORS[quadrantOf[b.city] ?? "nurture"];
      L.circleMarker([b.lat, b.lng], {
        radius: 4 + Math.sqrt(b.revenue / Math.max(1, maxCityRevenue)) * 18,
        color,
        weight: 1.2,
        fillColor: color,
        fillOpacity: 0.5,
      })
        .bindTooltip(
          `<b>${b.city}, ${b.state}</b><br>${formatCurrency(b.revenue)} · ${formatNumber(b.orders)} orders`,
          { direction: "top", offset: [0, -2] },
        )
        .addTo(bubbleLayer);
    }

    const measureLayer = L.layerGroup().addTo(map);
    measureLayerRef.current = measureLayer;

    map.on("click", (e: L.LeafletMouseEvent) => {
      const m = modeRef.current;
      if (m === "none") return;
      // A fresh measurement clears the previous one so only the latest shows.
      if (pointsRef.current.length === 0 || pointsRef.current.length >= 2) {
        measureLayer.clearLayers();
        pointsRef.current = [];
      }
      const pt = snap(map, e.latlng);
      pointsRef.current.push(pt);
      L.circleMarker(pt.latlng, {
        radius: 5,
        color: MEASURE,
        weight: 2,
        fillColor: "#fff",
        fillOpacity: 1,
      }).addTo(measureLayer);

      const pts = pointsRef.current;
      if (m === "distance" && pts.length === 2) {
        const km = haversineKm(pts[0].latlng, pts[1].latlng);
        L.polyline([pts[0].latlng, pts[1].latlng], {
          color: MEASURE,
          weight: 2.5,
          dashArray: "6 6",
        })
          .bindTooltip(`${km.toFixed(0)} km`, { permanent: true, direction: "center" })
          .addTo(measureLayer);
        setResult({ kind: "distance", km, from: pts[0].name, to: pts[1].name });
      } else if (m === "radius" && pts.length === 2) {
        const km = haversineKm(pts[0].latlng, pts[1].latlng);
        L.circle(pts[0].latlng, {
          radius: km * 1000,
          color: MEASURE,
          weight: 2,
          fillColor: MEASURE,
          fillOpacity: 0.08,
        }).addTo(measureLayer);
        let cities = 0,
          orders = 0,
          revenue = 0;
        for (const b of bubbles) {
          if (haversineKm(pts[0].latlng, L.latLng(b.lat, b.lng)) <= km) {
            cities += 1;
            orders += b.orders;
            revenue += b.revenue;
          }
        }
        setResult({ kind: "radius", km, center: pts[0].name, cities, orders, revenue });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      measureLayerRef.current = null;
    };
    // Bubbles/quadrants are a stable server snapshot for this render; re-init only
    // if the dataset identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbles, quadrantOf, maxCityRevenue]);

  const toolBtn = (m: Mode, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => chooseMode(m)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors duration-150",
        mode === m
          ? "border-[#d9433f] bg-[#d9433f]/10 text-[#b7322e]"
          : "border-line bg-card text-ink-soft hover:text-ink",
      )}
      aria-pressed={mode === m}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{ height: 560 }}
        className="w-full overflow-hidden rounded-2xl border border-line bg-slate-50"
      />

      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-[1200] flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card/95 p-2 shadow-lg backdrop-blur">
        {toolBtn("radius", <RadiusIcon className="h-3.5 w-3.5" />, "Ad Radius")}
        {toolBtn("distance", <Ruler className="h-3.5 w-3.5" />, "Distance")}
        {(mode !== "none" || result) && (
          <button
            type="button"
            onClick={() => chooseMode("none")}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {mode !== "none" && !result ? (
        <div className="absolute left-3 top-16 z-[1200] max-w-[240px] rounded-lg bg-ink/85 px-3 py-2 text-[11px] font-medium leading-snug text-white shadow-lg">
          {mode === "radius"
            ? "Click a center, then click the edge to set the ad-targeting radius."
            : "Click two cities (or points) to measure the distance between them."}
        </div>
      ) : null}

      {/* Result panel */}
      {result ? (
        <div className="absolute bottom-5 left-3 z-[1200] w-64 rounded-xl border border-line bg-card/97 p-3.5 shadow-xl backdrop-blur anim-rise">
          {result.kind === "distance" ? (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <Ruler className="h-3.5 w-3.5" /> Distance
              </p>
              <p className="mt-1.5 text-2xl font-bold text-ink tnum">{result.km.toFixed(0)} km</p>
              <p className="mt-1 text-xs text-ink-soft">
                <MapPin className="mr-1 inline h-3 w-3" />
                {result.from} → {result.to}
              </p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <RadiusIcon className="h-3.5 w-3.5" /> Ad reach · {result.km.toFixed(0)} km radius
              </p>
              <p className="mt-1 text-xs text-ink-soft">Centered on {result.center}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-base font-bold text-ink tnum">{formatNumber(result.cities)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">Cities</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-base font-bold text-ink tnum">{formatNumber(result.orders)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">Orders</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-base font-bold text-pos tnum">₹{compactNumber(result.revenue)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft">Revenue</p>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
