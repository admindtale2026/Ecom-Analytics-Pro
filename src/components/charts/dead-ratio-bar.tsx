"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { EmptyChart } from "./revenue-line";

type Datum = { label: string; value: number };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #eef0f4",
  boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
  fontSize: 13,
} as const;

const ANIM_MS = 320;

/** Severity ramp: the higher the non-moving %, the hotter the bar. */
function fillFor(pct: number): string {
  if (pct >= 60) return "#e11d48"; // rose-600
  if (pct >= 30) return "#f59e0b"; // amber-500
  return "#6366f1"; // indigo-500
}

/**
 * Horizontal bars of each category's share of catalog that is NOT moving
 * (dead + slow), as a percentage. The shared `HBar` hardcodes a ₹/"Revenue"
 * tooltip, so Dead Stock gets its own percent-aware chart.
 */
export function DeadRatioBar({ data, height = 260 }: { data: Datum[]; height?: number }) {
  if (!data.length) return <EmptyChart height={height} />;
  const fmt = (v: number) => `${Math.round(v)}%`;
  const rowHeight = 34;
  const chartHeight = Math.max(height, data.length * rowHeight);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={fmt}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#475569", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={110}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "rgba(225,29,72,0.06)" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [fmt(Number(v)), "Not moving"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26} animationDuration={ANIM_MS}>
          {data.map((d, i) => (
            <Cell key={i} fill={fillFor(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
