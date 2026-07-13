"use client";

import dynamic from "next/dynamic";

/**
 * Leaflet touches `window` at import time and fits the view client-side, so the
 * map is loaded lazily with `ssr:false` — the server render would be discarded
 * anyway, and this keeps Leaflet + its CSS out of every other page's bundle.
 */
export const AdTargetingMapLazy = dynamic(
  () => import("./ad-targeting-map").then((m) => m.AdTargetingMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-2xl bg-slate-50"
        style={{ height: 560 }}
        aria-label="Loading map"
      />
    ),
  },
);
