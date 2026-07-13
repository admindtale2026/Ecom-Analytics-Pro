"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, RefreshCw, Download, User, MapPin, CircleDot, Rows3, Loader2 } from "lucide-react";
import { usePatchParams } from "@/hooks/use-patch-params";
import { useApplyFilters } from "@/hooks/use-apply-filters";
import { ORDER_STATUSES } from "@/lib/constants";

function Select({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {icon}
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm font-medium text-ink shadow-sm outline-none focus:border-brand-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function OrdersControls({
  states,
  people,
  salesperson,
}: {
  states: string[];
  people: string[];
  /** The active global salesperson filter (single value shown here; cleared = "All"). */
  salesperson: string;
}) {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const applyFilters = useApplyFilters();
  const router = useRouter();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /**
   * The cron and the Admin panel both POST this route; a GET <a> would have
   * navigated the user to raw JSON.
   */
  async function refreshFeed() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch("/api/sync?mode=delta", { method: "POST" });
      const body = await res.json();
      setSyncNote(res.ok ? "Feed refreshed." : (body.hint ?? body.error ?? "Sync failed."));
      if (res.ok) startTransition(() => router.refresh());
    } catch (err) {
      setSyncNote((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + live sync + actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            patch({ q: q || null }, { resetPage: true });
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID, Invoice, Customer, Mobile, Product or SKU…"
            className="w-full rounded-xl border border-line bg-card py-3 pl-11 pr-4 text-sm shadow-sm outline-none focus:border-brand-400"
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshFeed}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Feed
          </button>
          <a
            href={`/api/export/orders?${sp.toString()}`}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </a>
        </div>
      </div>

      {syncNote ? (
        <p role="status" className="text-xs font-medium text-ink-soft">
          {syncNote}
        </p>
      ) : null}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Sales Person"
          icon={<User className="h-3.5 w-3.5" />}
          value={salesperson}
          options={[{ value: "", label: "All" }, ...people.map((p) => ({ value: p, label: p }))]}
          onChange={(v) => applyFilters({ sp: v || null })}
        />
        <Select
          label="State"
          icon={<MapPin className="h-3.5 w-3.5" />}
          value={sp.get("state") ?? ""}
          options={[{ value: "", label: "All" }, ...states.map((s) => ({ value: s, label: s }))]}
          onChange={(v) => patch({ state: v || null }, { resetPage: true })}
        />
        <Select
          label="Status"
          icon={<CircleDot className="h-3.5 w-3.5" />}
          value={sp.get("status") ?? ""}
          options={[{ value: "", label: "All" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: s }))]}
          onChange={(v) => patch({ status: v || null }, { resetPage: true })}
        />
        <Select
          label="Rows Per Page"
          icon={<Rows3 className="h-3.5 w-3.5" />}
          value={sp.get("rows") ?? "25"}
          options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: `${n} Rows` }))}
          onChange={(v) => patch({ rows: v }, { resetPage: true })}
        />
      </div>
    </div>
  );
}
