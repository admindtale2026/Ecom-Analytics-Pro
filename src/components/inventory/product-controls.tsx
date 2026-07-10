"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { usePatchParams } from "@/hooks/use-patch-params";

/** Search + category filter for the Products table. */
export function ProductControls({ categories }: { categories: string[] }) {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          patch({ q: q || null });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or SKU…"
          aria-label="Search products or SKU"
          className="w-full rounded-xl border border-line bg-card py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition-colors duration-150 focus:border-brand-400"
        />
      </form>

      <label className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-sm">
        <Filter className="h-4 w-4 shrink-0 text-ink-soft" />
        <span className="shrink-0 text-sm font-medium text-ink-soft">Filter by:</span>
        <select
          value={sp.get("category") ?? ""}
          onChange={(e) => patch({ category: e.target.value || null })}
          aria-label="Filter by category"
          className="min-w-32 bg-transparent text-sm font-semibold text-ink outline-none"
        >
          <option value="">All</option>
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
