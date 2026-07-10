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
import { compactNumber, formatCurrency } from "@/lib/utils";
import { BAR_FILL, CHART_COLORS } from "@/lib/constants";
import { EmptyChart } from "./revenue-line";

type Datum = { label: string; value: number };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #eef0f4",
  boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
  fontSize: 13,
} as const;

/** Recharts' default 1500ms grow is far too slow; keep bars under a third of a second. */
const ANIM_MS = 320;

/**
 * Vertical bars for a single magnitude measure across categories.
 * Single hue by default (magnitude, not identity). Pass `categorical` to color
 * each bar by its entity (stable order) — used where the reference shows
 * multi-color bars.
 */
export function VBar({
  data,
  height = 300,
  money = true,
  categorical = false,
  color = BAR_FILL,
}: {
  data: Datum[];
  height?: number;
  money?: boolean;
  categorical?: boolean;
  color?: string;
}) {
  if (!data.length) return <EmptyChart height={height} />;
  const fmt = money ? (v: number) => "₹" + compactNumber(v) : (v: number) => compactNumber(v);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={54} />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.06)" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [money ? formatCurrency(Number(v)) : compactNumber(Number(v)), "Revenue"]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={46} animationDuration={ANIM_MS}>
          {data.map((_, i) => (
            <Cell key={i} fill={categorical ? CHART_COLORS[i % CHART_COLORS.length] : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars (ranked list, e.g. Regional Dominance). */
export function HBar({
  data,
  height = 300,
  money = true,
  color = BAR_FILL,
}: {
  data: Datum[];
  height?: number;
  money?: boolean;
  color?: string;
}) {
  if (!data.length) return <EmptyChart height={height} />;
  const fmt = money ? (v: number) => "₹" + compactNumber(v) : (v: number) => compactNumber(v);
  // Recharts drops alternating category labels when rows outgrow the height.
  // A named bar with no name is useless, so the chart grows instead.
  const rowHeight = 34;
  const chartHeight = Math.max(height, data.length * rowHeight);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" horizontal={false} />
        <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#475569", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={92}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.06)" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [money ? formatCurrency(Number(v)) : compactNumber(Number(v)), "Revenue"]}
        />
        <Bar
          dataKey="value"
          radius={[0, 6, 6, 0]}
          maxBarSize={26}
          fill={color}
          animationDuration={ANIM_MS}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
