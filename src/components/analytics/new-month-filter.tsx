"use client";

import { useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { usePatchParams } from "@/hooks/use-patch-params";
import { monthKeyToLabel } from "@/lib/utils";

/**
 * Launch-month dropdown for the new-products list. Writes `?newMonth=2026-01` to
 * the URL so the server component re-queries. `months` are sortable YYYY-MM keys
 * (newest first), rendered as "Jan 26" labels.
 *
 * On the analytics type page the month filter only bites within the `new`
 * segment, so `linkSegment` also flips `segment=new` when a month is picked.
 * The catalog page has no segment toggle, so it leaves that off.
 */
export function NewMonthFilter({
  months,
  linkSegment = false,
}: {
  months: string[];
  linkSegment?: boolean;
}) {
  const sp = useSearchParams();
  const patch = usePatchParams();
  if (!months.length) return null;

  const current = sp.get("newMonth") ?? "";

  return (
    <label className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-sm">
      <CalendarRange className="h-4 w-4 shrink-0 text-ink-soft" />
      <span className="shrink-0 text-sm font-medium text-ink-soft">New month:</span>
      <select
        value={current}
        onChange={(e) => {
          const v = e.target.value || null;
          patch(linkSegment && v ? { newMonth: v, segment: "new" } : { newMonth: v });
        }}
        aria-label="Filter new products by launch month"
        className="min-w-28 bg-transparent text-sm font-semibold text-ink outline-none"
      >
        <option value="">All months</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {monthKeyToLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
