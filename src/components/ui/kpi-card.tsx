import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

/**
 * One headline metric. Colour is reserved for the delta (up/down) — the icon
 * tile stays neutral so a row of four KPIs reads as one object, not four.
 */
export function KpiCard({
  label,
  value,
  icon,
  delta,
  sub,
  money,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  delta?: number | null;
  sub?: string;
  /** Render the value in the positive/green money tone (revenue figures). */
  money?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="group p-5">
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-150 group-hover:bg-brand-100">
          {icon}
        </span>
        {delta != null ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-sm font-semibold",
              up ? "text-pos" : "text-neg",
            )}
          >
            {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm font-medium text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight tnum", money ? "text-pos" : "text-ink")}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-ink-soft">{sub}</p> : null}
    </Card>
  );
}

/**
 * Compact label-over-value tile used on drill-down headers, where six metrics
 * share a row and the KPI card's icon would crowd them out.
 */
export function StatTile({
  label,
  value,
  sub,
  accent,
  money,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** Render the value in the positive/green money tone (revenue figures). */
  money?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-xl font-bold tracking-tight tnum",
          money ? "text-pos" : accent ? "text-brand-600" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs font-medium text-ink-soft tnum">{sub}</p> : null}
    </Card>
  );
}
