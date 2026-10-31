import { Sparkles } from "lucide-react";
import type { SegmentStats } from "@/server/catalog";
import { formatCurrency, formatDMY, formatNumber, monthKeyToLabel, cn } from "@/lib/utils";

/**
 * A product's catalog status, shown in sales tables: a "New" chip tagged with the
 * launch month (e.g. "✦ Jan 26") for month-tagged products, else their creation
 * date (DD-MM-YYYY), else an em dash when the product isn't in the catalog.
 */
export function CatalogTag({
  createdAt,
  isNew,
  newMonth,
}: {
  createdAt: Date | null;
  isNew: boolean;
  newMonth?: string | null;
}) {
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-pos">
        <Sparkles className="h-3 w-3" />
        {newMonth ? `New · ${monthKeyToLabel(newMonth)}` : "New"}
      </span>
    );
  }
  if (createdAt) {
    return <span className="text-xs font-medium text-ink-soft tnum">{formatDMY(createdAt)}</span>;
  }
  return <span className="text-xs text-ink-soft/60">—</span>;
}

const TONES = {
  pos: "border-emerald-200 bg-emerald-50/50",
  ink: "border-line bg-slate-50/60",
  soft: "border-line bg-slate-50/30",
} as const;

/** Compact new/old/unmatched stat used on the analytics and catalog pages. */
export function SplitStat({
  label,
  hint,
  stat,
  tone = "ink",
}: {
  label: string;
  hint?: string;
  stat: SegmentStats;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", TONES[tone])}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
        <span className="text-sm font-bold text-ink tnum">{formatNumber(stat.products)}</span>
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-ink-soft">{hint}</p>}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-pos tnum">{formatCurrency(stat.revenue)}</span>
        <span className="text-xs text-ink-soft tnum">{formatNumber(stat.units)} units</span>
      </div>
    </div>
  );
}
