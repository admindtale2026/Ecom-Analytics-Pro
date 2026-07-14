"use client";

import dynamic from "next/dynamic";

/**
 * Leaflet touches `window` at import time, so the atlas is loaded lazily with
 * `ssr:false` — the server render would be discarded anyway, and this keeps
 * Leaflet + its CSS out of every other page's bundle.
 */
export const CustomerAtlasLazy = dynamic(
  () => import("./customer-atlas").then((m) => m.CustomerAtlas),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-2xl bg-canvas"
        style={{ height: "80vh", minHeight: 640 }}
        aria-label="Loading atlas"
      />
    ),
  },
);
