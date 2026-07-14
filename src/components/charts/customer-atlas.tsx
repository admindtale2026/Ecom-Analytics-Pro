"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Ruler, Radius as RadiusIcon, X, Search, MapPin } from "lucide-react";
import { cn, compactNumber, formatCurrency, formatNumber } from "@/lib/utils";
import type { AtlasData, AtlasPoint } from "@/server/atlas";

/* ------------------------------- helpers ------------------------------- */

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

/** Sequential blue scale, low → high average order value. */
const AOV_STEPS = ["#cde2fb", "#86b6ef", "#2a78d6", "#1c5cab", "#0d366b"];
function colorForAvg(avg: number, [lo, hi]: [number, number]): string {
  let t = hi > lo ? (avg - lo) / (hi - lo) : 0.5;
  t = Math.max(0, Math.min(1, t));
  return AOV_STEPS[Math.min(AOV_STEPS.length - 1, Math.floor(t * AOV_STEPS.length))];
}
function radiusForCount(count: number, [lo, hi]: [number, number]): number {
  const t = hi > lo ? (count - lo) / (hi - lo) : 0.5;
  return 7 + Math.sqrt(Math.max(0, t)) * 26;
}

const MEASURE = "#d9433f";
const SELECT = "#2a78d6";
const INDIA_BOUNDS = L.latLngBounds([6.0, 66.5], [37.5, 98.0]);

type View = "city" | "state";
type Mode = "none" | "distance" | "radius";

type Group = {
  key: string;
  label: string;
  state: string;
  count: number;
  revenue: number;
  avg: number;
  lat: number;
  lon: number;
  r75: number;
  rMax: number;
  topProducts: string[];
};

type MeasureResult =
  | null
  | { kind: "distance"; km: number }
  | { kind: "radius"; km: number };

/* ---------------------------- aggregation ------------------------------ */

function aggregate(points: AtlasPoint[], view: View): Group[] {
  const byKey = new Map<string, { pts: AtlasPoint[]; state: string }>();
  for (const p of points) {
    const key = view === "city" ? p.city : p.state;
    let g = byKey.get(key);
    if (!g) {
      g = { pts: [], state: p.state };
      byKey.set(key, g);
    }
    g.pts.push(p);
  }

  const groups: Group[] = [];
  for (const [key, { pts, state }] of byKey) {
    const count = pts.length;
    const revenue = pts.reduce((s, p) => s + p.amount, 0);
    const lat = pts.reduce((s, p) => s + p.lat, 0) / count;
    const lon = pts.reduce((s, p) => s + p.lng, 0) / count;
    const dists = pts.map((p) => haversineKm(lat, lon, p.lat, p.lng)).sort((a, b) => a - b);
    const freq = new Map<string, number>();
    for (const p of pts) for (const name of p.pnames) freq.set(name, (freq.get(name) ?? 0) + 1);
    const topProducts = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);
    groups.push({
      key,
      label: key,
      state,
      count,
      revenue,
      avg: revenue / count,
      lat,
      lon,
      r75: percentile(dists, 75),
      rMax: dists.length ? dists[dists.length - 1] : 0,
      topProducts,
    });
  }
  return groups;
}

/* ------------------------------ count-up ------------------------------- */

function useCountUp(target: number): number {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = from + (target - from) * eased;
      setV(val);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setV(target);
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function Kpi({ label, value, kind }: { label: string; value: number; kind: "count" | "money" }) {
  const v = useCountUp(value);
  return (
    <div className="min-w-[104px] border-l border-line px-4 first:border-l-0 first:pl-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="text-lg font-bold tabular-nums text-ink">
        {kind === "money" ? formatCurrency(v, { compact: true }) : formatNumber(Math.round(v))}
      </div>
    </div>
  );
}

/* ------------------------------ component ------------------------------ */

export function CustomerAtlas({ data }: { data: AtlasData }) {
  const allStates = useMemo(
    () => [...new Set(data.points.map((p) => p.state))].sort(),
    [data.points],
  );
  const stateCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data.points) m.set(p.state, (m.get(p.state) ?? 0) + 1);
    return m;
  }, [data.points]);

  // Product-interest chips are the real product types present in the data,
  // ordered by how many orders carry each — most common first.
  const allCategories = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of data.points) for (const t of p.ptypes) freq.set(t, (freq.get(t) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [data.points]);

  const [view, setView] = useState<View>("city");
  const [activeStates, setActiveStates] = useState<Set<string>>(() => new Set(allStates));
  const [activeCats, setActiveCats] = useState<Set<string>>(() => new Set());
  const [stateSearch, setStateSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");
  const [measureResult, setMeasureResult] = useState<MeasureResult>(null);

  // When the dataset changes — the header store/salesperson/date filter triggers
  // a server re-fetch, so `allStates` gets a new identity — reset the in-map
  // state selection to "all" so states that only appear in the new data aren't
  // silently hidden by a stale selection. Adjusting state during render (guarded)
  // is React's recommended way to reset state on a prop change.
  const [prevAllStates, setPrevAllStates] = useState(allStates);
  if (allStates !== prevAllStates) {
    setPrevAllStates(allStates);
    setActiveStates(new Set(allStates));
    setSelectedKey(null);
  }

  // The date window is applied server-side via the global header filter; the
  // atlas only narrows further by state and product category, client-side.
  const filtered = useMemo(() => {
    const noCat = activeCats.size === 0;
    const out: AtlasPoint[] = [];
    for (const p of data.points) {
      if (!activeStates.has(p.state)) continue;
      if (!noCat && !p.ptypes.some((c) => activeCats.has(c))) continue;
      out.push(p);
    }
    return out;
  }, [data.points, activeStates, activeCats]);

  const groups = useMemo(() => aggregate(filtered, view), [filtered, view]);

  const domains = useMemo(() => {
    if (!groups.length)
      return { count: [0, 1] as [number, number], avg: [0, 1] as [number, number] };
    const counts = groups.map((g) => g.count);
    const avgs = groups.map((g) => g.avg);
    return {
      count: [Math.min(...counts), Math.max(...counts)] as [number, number],
      avg: [Math.min(...avgs), Math.max(...avgs)] as [number, number],
    };
  }, [groups]);

  const kpis = useMemo(() => {
    const revenue = filtered.reduce((s, p) => s + p.amount, 0);
    return {
      orders: filtered.length,
      revenue,
      avg: filtered.length ? revenue / filtered.length : 0,
      cities: new Set(filtered.map((p) => p.city)).size,
      states: new Set(filtered.map((p) => p.state)).size,
    };
  }, [filtered]);

  const leaderboards = useMemo(() => {
    const cityGroups = view === "city" ? groups : aggregate(filtered, "city");
    const stateGroups = view === "state" ? groups : aggregate(filtered, "state");
    const top = (gs: Group[]) => [...gs].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    return { cities: top(cityGroups), states: top(stateGroups) };
  }, [groups, filtered, view]);

  const selected = useMemo(
    () => groups.find((g) => g.key === selectedKey) ?? null,
    [groups, selectedKey],
  );

  /* ----- Leaflet: refs + init ----- */
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const bubbleLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const modeRef = useRef<Mode>("none");
  const pointsRef = useRef<L.LatLng[]>([]);
  const selectRef = useRef<(g: Group) => void>(() => {});

  function flyTo(g: { lat: number; lon: number }, minZoom: number) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([g.lat, g.lon], Math.min(Math.max(map.getZoom(), minZoom), 10), {
      duration: 0.9,
      easeLinearity: 0.2,
    });
  }
  function selectGroup(g: Group) {
    setSelectedKey(g.key);
    flyTo(g, view === "city" ? 8 : 6);
  }
  // Keep the marker-click handler pointing at the latest selectGroup closure
  // (it captures `view`) without re-binding Leaflet listeners.
  useEffect(() => {
    selectRef.current = selectGroup;
  });

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      minZoom: 4,
      maxZoom: 13,
      maxBounds: INDIA_BOUNDS.pad(0.25),
      maxBoundsViscosity: 0.75,
    }).fitBounds(INDIA_BOUNDS);
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    }).addTo(map);

    bubbleLayerRef.current = L.layerGroup().addTo(map);
    coverageLayerRef.current = L.layerGroup().addTo(map);
    measureLayerRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (modeRef.current === "none") return;
      const layer = measureLayerRef.current;
      if (!layer) return;
      if (pointsRef.current.length === 0 || pointsRef.current.length >= 2) {
        layer.clearLayers();
        pointsRef.current = [];
        setMeasureResult(null);
      }
      pointsRef.current.push(e.latlng);
      L.circleMarker(e.latlng, {
        radius: 5,
        color: MEASURE,
        weight: 2.5,
        fillColor: "#fff",
        fillOpacity: 1,
      }).addTo(layer);

      const pts = pointsRef.current;
      if (pts.length === 2) {
        const km = haversineKm(pts[0].lat, pts[0].lng, pts[1].lat, pts[1].lng);
        if (modeRef.current === "distance") {
          L.polyline([pts[0], pts[1]], { color: MEASURE, weight: 2.4 }).addTo(layer);
          setMeasureResult({ kind: "distance", km });
        } else {
          L.circle(pts[0], {
            radius: km * 1000,
            color: MEASURE,
            weight: 2,
            fillColor: MEASURE,
            fillOpacity: 0.08,
          }).addTo(layer);
          L.polyline([pts[0], pts[1]], { color: MEASURE, weight: 1.6, dashArray: "5 6" }).addTo(layer);
          setMeasureResult({ kind: "radius", km });
        }
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw bubbles whenever the aggregated groups change.
  useEffect(() => {
    const layer = bubbleLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const g of groups) {
      const marker = L.circleMarker([g.lat, g.lon], {
        radius: radiusForCount(g.count, domains.count),
        fillColor: colorForAvg(g.avg, domains.avg),
        color: "#ffffff",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.88,
      });
      marker.bindTooltip(
        `<b>${g.label}</b><br>${g.count} order${g.count > 1 ? "s" : ""} · ${formatCurrency(g.revenue, { compact: true })}`,
        { direction: "top", offset: [0, -4] },
      );
      marker.on("click", () => selectRef.current(g));
      marker.addTo(layer);
    }
  }, [groups, domains]);

  // Redraw the coverage rings when the selection changes.
  useEffect(() => {
    const layer = coverageLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!selected) return;
    L.circle([selected.lat, selected.lon], {
      radius: selected.r75 * 1000,
      color: SELECT,
      weight: 1.6,
      fillColor: SELECT,
      fillOpacity: 0.06,
    }).addTo(layer);
    if (selected.rMax > selected.r75) {
      L.circle([selected.lat, selected.lon], {
        radius: selected.rMax * 1000,
        color: "#86b6ef",
        weight: 1,
        dashArray: "4 5",
        fill: false,
      }).addTo(layer);
    }
    L.circleMarker([selected.lat, selected.lon], {
      radius: 4,
      color: "#fff",
      weight: 1.5,
      fillColor: SELECT,
      fillOpacity: 1,
    }).addTo(layer);
  }, [selected]);

  /* ----- handlers ----- */
  function chooseMode(m: Mode) {
    const next = mode === m ? "none" : m;
    setMode(next);
    modeRef.current = next;
    pointsRef.current = [];
    measureLayerRef.current?.clearLayers();
    setMeasureResult(null);
    const el = containerRef.current;
    if (el) el.style.cursor = next === "none" ? "" : "crosshair";
  }
  function clearMeasure() {
    pointsRef.current = [];
    measureLayerRef.current?.clearLayers();
    setMeasureResult(null);
  }
  function toggleCat(c: string) {
    setSelectedKey(null);
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }
  function toggleState(s: string) {
    setSelectedKey(null);
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  const visibleStates = allStates
    .filter((s) => !stateSearch || s.toLowerCase().includes(stateSearch.toLowerCase()))
    .sort((a, b) => (stateCounts.get(b) ?? 0) - (stateCounts.get(a) ?? 0));

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card"
      style={{ height: "80vh", minHeight: 640 }}
    >
      {/* KPI + view toggle header */}
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-0">
          <Kpi label="Orders" value={kpis.orders} kind="count" />
          <Kpi label="Revenue" value={kpis.revenue} kind="money" />
          <Kpi label="Avg Order" value={kpis.avg} kind="money" />
          <Kpi label="Cities" value={kpis.cities} kind="count" />
          <Kpi label="States" value={kpis.states} kind="count" />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line p-1">
          {(["city", "state"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setSelectedKey(null);
                setView(v);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                view === v ? "bg-brand-500 text-white" : "text-ink-soft hover:text-ink",
              )}
            >
              {v} view
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="w-[320px] shrink-0 space-y-3 overflow-y-auto border-r border-line bg-canvas p-3.5">
          {/* Category chips */}
          {allCategories.length > 0 && (
            <section className="rounded-xl border border-line bg-card p-3">
              <h3 className="mb-2.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                Product interest
                <span className="font-normal normal-case tracking-normal">
                  {activeCats.size ? `${activeCats.size} selected` : `${allCategories.length} types`}
                </span>
              </h3>
              <div className="flex max-h-[168px] flex-wrap gap-1.5 overflow-y-auto">
                {allCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCat(c)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                      activeCats.has(c)
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-line text-ink-soft hover:border-brand-400 hover:text-ink",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* States */}
          <section className="rounded-xl border border-line bg-card p-3">
            <h3 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              States
              <span className="font-normal normal-case tracking-normal">
                {activeStates.size === allStates.length ? "All" : `${activeStates.size}/${allStates.length}`}
              </span>
            </h3>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
              <input
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                placeholder="Search state…"
                className="w-full rounded-lg border border-line bg-canvas py-1.5 pl-8 pr-2 text-xs text-ink"
              />
            </div>
            <div className="max-h-[180px] space-y-0.5 overflow-y-auto">
              {visibleStates.map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-canvas"
                >
                  <input
                    type="checkbox"
                    checked={activeStates.has(s)}
                    onChange={() => toggleState(s)}
                    className="accent-brand-500"
                  />
                  <span className="flex-1 truncate text-xs text-ink">{s}</span>
                  <span className="text-[10.5px] tabular-nums text-ink-soft">{stateCounts.get(s)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Ad-targeting tools */}
          <section className="rounded-xl border border-line bg-card p-3">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Ad-targeting tools
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => chooseMode("radius")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                  mode === "radius"
                    ? "border-[#d9433f] bg-[#d9433f]/10 text-[#b7322e]"
                    : "border-line text-ink-soft hover:text-ink",
                )}
              >
                <RadiusIcon className="h-4 w-4" /> Radius — click center, then edge
              </button>
              <button
                type="button"
                onClick={() => chooseMode("distance")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                  mode === "distance"
                    ? "border-[#d9433f] bg-[#d9433f]/10 text-[#b7322e]"
                    : "border-line text-ink-soft hover:text-ink",
                )}
              >
                <Ruler className="h-4 w-4" /> Distance — click A, then B
              </button>
              {(mode !== "none" || measureResult) && (
                <button
                  type="button"
                  onClick={clearMeasure}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line py-1.5 text-[11.5px] text-ink-soft hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" /> Clear measurement
                </button>
              )}
            </div>
            {measureResult && (
              <div className="mt-2.5 rounded-lg bg-[#d9433f]/10 p-2.5 text-xs">
                {measureResult.kind === "distance" ? (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Distance</span>
                    <b className="tabular-nums text-ink">{fmtKm(measureResult.km)}</b>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Ad radius</span>
                      <b className="tabular-nums text-ink">{fmtKm(measureResult.km)}</b>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-ink-soft">Diameter</span>
                      <b className="tabular-nums text-ink">{fmtKm(measureResult.km * 2)}</b>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Detail panel */}
          {selected && (
            <section className="rounded-xl border border-line bg-card p-3">
              <div className="text-base font-bold text-ink">{selected.label}</div>
              <div className="mb-2.5 text-[11.5px] text-ink-soft">
                {view === "city" ? selected.state : "State-level view"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Orders", formatNumber(selected.count)],
                  ["Revenue", formatCurrency(selected.revenue, { compact: true })],
                  ["Avg order", formatCurrency(selected.avg, { compact: true })],
                  ["Diameter", fmtKm(selected.r75 * 2)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-line bg-canvas px-2.5 py-2">
                    <div className="text-[9.5px] uppercase tracking-wide text-ink-soft">{l}</div>
                    <div className="text-sm font-semibold tabular-nums text-ink">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10.5px] uppercase tracking-wide text-ink-soft">
                Order concentration
              </div>
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-ink-soft">Typical radius (75% of orders)</span>
                <b className="tabular-nums text-ink">{fmtKm(selected.r75)}</b>
              </div>
              <div className="mt-0.5 flex justify-between text-xs">
                <span className="text-ink-soft">Full spread (max)</span>
                <b className="tabular-nums text-ink">{fmtKm(selected.rMax)}</b>
              </div>
              <div className="mt-3 text-[10.5px] uppercase tracking-wide text-ink-soft">Top products</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.topProducts.length ? (
                  selected.topProducts.map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-brand-50 px-2 py-1 text-[10.5px] text-brand-700"
                    >
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-ink-soft">No product data</span>
                )}
              </div>
            </section>
          )}

          {/* Leaderboards */}
          <Leaderboard
            title="Top states by revenue"
            rows={leaderboards.states}
            onPick={(g) => {
              if (view !== "state") setView("state");
              setSelectedKey(g.key);
              flyTo(g, 6);
            }}
          />
          <Leaderboard
            title="Top cities by revenue"
            rows={leaderboards.cities}
            onPick={(g) => {
              if (view !== "city") setView("city");
              setSelectedKey(g.key);
              flyTo(g, 8);
            }}
          />

          {/* Legend */}
          <section className="rounded-xl border border-line bg-card p-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Legend
            </h3>
            <p className="text-[11px] text-ink-soft">Bubble size = number of orders</p>
            <p className="mt-2 text-[11px] text-ink-soft">Bubble color = average order value</p>
            <div
              className="mt-1.5 h-2 rounded"
              style={{ background: `linear-gradient(90deg, ${AOV_STEPS.join(",")})` }}
            />
            <div className="mt-1 flex justify-between text-[9.5px] text-ink-soft">
              <span>Lower AOV</span>
              <span>Higher AOV</span>
            </div>
          </section>
        </aside>

        {/* Map */}
        <div className="relative min-w-0 flex-1">
          <div ref={containerRef} className="h-full w-full bg-[#e8e9e5]" />
          {mode !== "none" && !measureResult && (
            <div className="absolute left-1/2 top-4 z-[900] -translate-x-1/2 rounded-lg bg-ink/85 px-3 py-2 text-[11px] font-medium text-white shadow-lg">
              {mode === "radius"
                ? "Click a center, then click the edge to set the ad radius."
                : "Click point A, then point B to measure the distance."}
            </div>
          )}
          {data.unplaced.length > 0 && (
            <div className="absolute bottom-3 left-3 z-[900] flex items-center gap-1.5 rounded-lg border border-line bg-card/95 px-2.5 py-1.5 text-[10.5px] text-ink-soft shadow-sm backdrop-blur">
              <MapPin className="h-3 w-3" />
              {formatCurrency(
                data.unplaced.reduce((s, u) => s + u.revenue, 0),
                { compact: true },
              )}{" "}
              across {data.unplaced.length} cit{data.unplaced.length === 1 ? "y" : "ies"} not mapped
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Leaderboard({
  title,
  rows,
  onPick,
}: {
  title: string;
  rows: Group[];
  onPick: (g: Group) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <section className="rounded-xl border border-line bg-card p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      {rows.length ? (
        <div className="space-y-0.5">
          {rows.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-canvas"
            >
              <span className="w-3.5 shrink-0 text-[10px] tabular-nums text-ink-soft">{i + 1}</span>
              <span className="flex-1 truncate text-xs text-ink">{r.label}</span>
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-canvas">
                <span
                  className="block h-full rounded-full bg-brand-400"
                  style={{ width: `${(r.revenue / max) * 100}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right text-[10.5px] tabular-nums text-ink-soft">
                ₹{compactNumber(r.revenue)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-3 text-center text-[11.5px] text-ink-soft">No data in range</p>
      )}
    </section>
  );
}
