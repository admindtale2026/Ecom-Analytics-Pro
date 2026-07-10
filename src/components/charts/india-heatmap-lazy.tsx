"use client";

import dynamic from "next/dynamic";

/**
 * The map pulls in d3-geo + topojson-client and reads a 230KB static asset.
 * Loading it lazily keeps all of that out of the shared bundle, so the pages
 * that don't show a map don't pay for one. `ssr: false` because the projection
 * is fitted client-side and the server render would be thrown away anyway.
 */
export const IndiaHeatmapLazy = dynamic(
  () => import("./india-heatmap").then((m) => m.IndiaHeatmap),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-2xl bg-slate-50"
        style={{ aspectRatio: "620 / 700" }}
        aria-label="Loading map"
      />
    ),
  },
);
