"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { compactNumber, formatCurrency } from "@/lib/utils";

type Point = { date: string; revenue: number };

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

export function RevenueLine({ data, height = 300 }: { data: Point[]; height?: number }) {
  if (!data.length) {
    return <EmptyChart height={height} />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          tickFormatter={(v) => "₹" + compactNumber(v)}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: "#c7ccff", strokeWidth: 1.5 }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #eef0f4",
            boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
            fontSize: 13,
          }}
          labelFormatter={(l) => fmtDate(l as string)}
          formatter={(v) => [formatCurrency(Number(v)), "Revenue"]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#5d5fef"
          strokeWidth={2}
          fill="url(#revFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          animationDuration={320}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EmptyChart({ height = 300, label = "No data for this selection" }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-slate-50 text-sm text-ink-soft"
      style={{ height }}
    >
      {label}
    </div>
  );
}
