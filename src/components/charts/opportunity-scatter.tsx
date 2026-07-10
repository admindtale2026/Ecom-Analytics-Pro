"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { compactNumber, formatCurrency } from "@/lib/utils";
import { EmptyChart } from "./revenue-line";
import { QUADRANT_COLORS, QUADRANT_LABELS, type OpportunityCity } from "@/lib/opportunity";

/** Order volume (x) against average basket value (y), split by the medians. */
export function OpportunityScatter({
  cities,
  medianOrders,
  medianAov,
  height = 360,
}: {
  cities: OpportunityCity[];
  medianOrders: number;
  medianAov: number;
  height?: number;
}) {
  if (!cities.length) return <EmptyChart height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
        <XAxis
          type="number"
          dataKey="orders"
          name="Orders"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{ value: "Orders", position: "insideBottom", offset: -4, fill: "#94a3b8", fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="aov"
          name="Avg order value"
          tickFormatter={(v) => "₹" + compactNumber(v)}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <ZAxis type="number" dataKey="revenue" range={[60, 460]} />
        <ReferenceLine x={medianOrders} stroke="#cbd5e1" strokeDasharray="4 4" />
        <ReferenceLine y={medianAov} stroke="#cbd5e1" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #eef0f4",
            boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
            fontSize: 13,
          }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const c = payload[0].payload as OpportunityCity;
            return (
              <div className="rounded-xl border border-line bg-card px-3 py-2 text-sm shadow-lg">
                <p className="font-semibold text-ink">
                  {c.city}
                  <span className="ml-1.5 font-normal text-ink-soft">{c.state}</span>
                </p>
                <p className="mt-1 text-ink-soft">
                  {compactNumber(c.orders)} orders · AOV {formatCurrency(c.aov)}
                </p>
                <p className="text-ink-soft">Revenue {formatCurrency(c.revenue)}</p>
                <p className="mt-1 font-semibold" style={{ color: QUADRANT_COLORS[c.quadrant] }}>
                  {QUADRANT_LABELS[c.quadrant]}
                </p>
              </div>
            );
          }}
        />
        <Scatter data={cities} fillOpacity={0.75} animationDuration={320}>
          {cities.map((c) => (
            <Cell key={c.city} fill={QUADRANT_COLORS[c.quadrant]} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function QuadrantLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {(Object.keys(QUADRANT_LABELS) as OpportunityCity["quadrant"][]).map((q) => (
        <li key={q} className="flex items-center gap-2 text-sm text-ink-soft">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: QUADRANT_COLORS[q] }}
          />
          {QUADRANT_LABELS[q]}
        </li>
      ))}
    </ul>
  );
}
