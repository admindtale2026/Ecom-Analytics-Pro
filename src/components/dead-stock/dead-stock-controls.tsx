"use client";

import { useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { usePatchParams } from "@/hooks/use-patch-params";
import { cn } from "@/lib/utils";

const TIERS = [
  { id: "", label: "All" },
  { id: "dead", label: "Dead" },
  { id: "slow", label: "Slow" },
] as const;

/** Category filter + tier toggle for the Dead Stock detail table. */
export function DeadStockControls({ categories }: { categories: string[] }) {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const tier = sp.get("tier") ?? "";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex rounded-xl border border-line bg-card p-1 shadow-sm">
        {TIERS.map((t) => {
          const active = tier === t.id;
          return (
            <button
              key={t.id || "all"}
              onClick={() => patch({ tier: t.id || null })}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150",
                active ? "bg-brand-500 text-white shadow-sm" : "text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-sm">
        <Filter className="h-4 w-4 shrink-0 text-ink-soft" />
        <span className="shrink-0 text-sm font-medium text-ink-soft">Category:</span>
        <select
          value={sp.get("category") ?? ""}
          onChange={(e) => patch({ category: e.target.value || null })}
          aria-label="Filter by category"
          className="min-w-32 bg-transparent text-sm font-semibold text-ink outline-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
