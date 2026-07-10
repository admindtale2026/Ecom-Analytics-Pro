"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { compactNumber, formatCurrency } from "@/lib/utils";
import { EmptyChart } from "./revenue-line";

type Point = { date: string; revenue: number; orders: number };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

/**
 * Revenue (line, left axis) against order volume (bars, right axis). The bars
 * sit behind the line and are muted, so the money series stays the figure.
 */
export function RevenueVolumeChart({ data, height = 340 }: { data: Point[]; height?: number }) {
  if (!data.length) return <EmptyChart height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          yAxisId="revenue"
          tickFormatter={(v) => "₹" + compactNumber(v)}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <YAxis
          yAxisId="orders"
          orientation="right"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={34}
        />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.06)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #eef0f4",
            boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
            fontSize: 13,
          }}
          labelFormatter={(l) => fmtDate(l as string)}
          formatter={(v, name) =>
            name === "revenue"
              ? [formatCurrency(Number(v)), "Revenue"]
              : [compactNumber(Number(v)), "Orders"]
          }
        />
        <Bar
          yAxisId="orders"
          dataKey="orders"
          fill="#e2e5ec"
          radius={[3, 3, 0, 0]}
          maxBarSize={14}
          animationDuration={320}
        />
        <Line
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          stroke="#5d5fef"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          animationDuration={320}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
