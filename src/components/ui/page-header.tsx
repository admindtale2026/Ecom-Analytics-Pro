import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Back-arrow + title block used at the top of every drill-down page. */
export function DetailHeader({
  backHref,
  eyebrow,
  title,
  subtitle,
  icon,
  action,
}: {
  backHref: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Link
          href={backHref}
          aria-label="Back"
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-soft transition-colors duration-150 hover:bg-slate-50 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          {eyebrow ? (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              {icon}
              {eyebrow}
            </p>
          ) : null}
          <h2 className="truncate text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Thin magnitude bar used inside table rows and ranked lists. */
export function MiniBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
