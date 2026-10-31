"use client";

import { useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { usePatchParams } from "@/hooks/use-patch-params";
import { NewMonthFilter } from "./new-month-filter";
import { cn } from "@/lib/utils";

/**
 * Controls for the category product table: a Top 20 / All toggle, a new/old
 * segment switch, a launch-month filter, and a fulfilment-class ("Filter by")
 * dropdown. All write to the URL so the server component re-queries — they
 * compose (e.g. All + New + Jan 26 + Made To Order).
 */
export function ProductTableControls({
  fulfilmentTypes,
  months,
}: {
  fulfilmentTypes: string[];
  months: string[];
}) {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const view = sp.get("view") === "all" ? "all" : "top";
  const segRaw = sp.get("segment");
  const segment = segRaw === "new" || segRaw === "old" ? segRaw : "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="inline-flex rounded-xl border border-line bg-card p-0.5 shadow-sm">
        {(["top", "all"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => patch({ view: v === "top" ? null : "all" })}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150",
              view === v ? "bg-brand-500 text-white shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {v === "top" ? "Top 20" : "All products"}
          </button>
        ))}
      </div>

      {/* New vs Old catalog split. Clearing to "all" drops the param. */}
      <div className="inline-flex rounded-xl border border-line bg-card p-0.5 shadow-sm">
        {(["all", "new", "old"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => patch({ segment: s === "all" ? null : s })}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors duration-150",
              segment === s ? "bg-brand-500 text-white shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <NewMonthFilter months={months} linkSegment />

      {fulfilmentTypes.length > 0 && (
        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-sm">
          <Filter className="h-4 w-4 shrink-0 text-ink-soft" />
          <span className="shrink-0 text-sm font-medium text-ink-soft">Filter by:</span>
          <select
            value={sp.get("fulfilment") ?? ""}
            onChange={(e) => patch({ fulfilment: e.target.value || null })}
            aria-label="Filter by fulfilment type"
            className="min-w-32 bg-transparent text-sm font-semibold text-ink outline-none"
          >
            <option value="">All</option>
            {fulfilmentTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
