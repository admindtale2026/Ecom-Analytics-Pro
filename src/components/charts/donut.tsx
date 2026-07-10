"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { compactNumber, formatCurrency, formatPercent } from "@/lib/utils";
import { EmptyChart } from "./revenue-line";

type Slice = { label: string; value: number };

/**
 * Spread `n` slices across the full ramp instead of taking the first `n`.
 * Two slices would otherwise both be dark indigo (ramp steps 1 and 2) and read
 * as one colour; spread, they land at the ramp's ends. Rank order is preserved
 * either way, since the ramp runs dark→light.
 */
function rampColor(i: number, n: number): string {
  if (n <= 1) return CHART_COLORS[0];
  const last = CHART_COLORS.length - 1;
  return CHART_COLORS[Math.round((i * last) / (n - 1))];
}

/**
 * Donut for identity-by-share (categorical). Always ships a legend (identity
 * is never color-alone) with values, satisfying the palette's contrast floor.
 * Fold the tail with `topNWithOther` before passing more than 8 slices.
 */
export function Donut({
  data,
  height = 260,
  money = true,
  centerLabel,
  stack = false,
}: {
  data: Slice[];
  height?: number;
  money?: boolean;
  centerLabel?: string;
  /** Force the legend below the ring — for cards too narrow to sit it alongside. */
  stack?: boolean;
}) {
  if (!data.length || data.every((d) => !d.value)) return <EmptyChart height={height} />;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div
      className={
        stack
          ? "flex flex-col items-center gap-4"
          : "flex flex-col items-center gap-4 sm:flex-row sm:items-center"
      }
    >
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              animationDuration={320}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={rampColor(i, data.length)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #eef0f4",
                boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
                fontSize: 13,
              }}
              formatter={(v, n) => [
                money ? formatCurrency(Number(v)) : compactNumber(Number(v)),
                n as string,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {centerLabel}
            </span>
          </div>
        ) : null}
      </div>
      <ul className="w-full space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: rampColor(i, data.length) }}
              />
              <span className="truncate text-ink">{d.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-ink-soft tnum">
              {formatPercent(total ? (d.value / total) * 100 : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
