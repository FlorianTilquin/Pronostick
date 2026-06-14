"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CompactTooltip } from "@/components/ChartTooltip";

const colors = ["#34d399", "#60a5fa", "#fb7185", "#a78bfa", "#facc15", "#2dd4bf", "#f97316", "#c084fc"];
const bandLabels = new Set(["Hasard 1%-99%", "Hasard 5%-95%"]);

type TimelineRow = Record<string, number | string | [number, number]>;

function formatTooltipValue(value: unknown, name: string): [string, string] {
  return [`${value} pts`, name];
}

export function TimelineChart({ data, names }: { data: TimelineRow[]; names: string[] }) {
  const bandNames = names.filter((name) => bandLabels.has(name));
  const playerNames = names.filter((name) => !bandLabels.has(name));
  const maxValue = data.reduce((max, row) => {
    return Math.max(
      max,
      ...names.map((name) => {
        const value = row[name];
        return Array.isArray(value) ? value[1] : typeof value === "number" ? value : 0;
      })
    );
  }, 0);
  const yMax = Math.max(50, Math.ceil(maxValue / 50) * 50);
  const yTicks = Array.from({ length: yMax / 50 + 1 }, (_, index) => index * 50);

  return (
    <div className="chart-frame">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ left: 0, right: 16, top: 18, bottom: 4 }}>
          <defs>
            <linearGradient id="randomWide" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#f8fafc" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="randomCore" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <XAxis dataKey="match" hide />
          <YAxis allowDecimals={false} axisLine={false} domain={[0, yMax]} tick={{ fill: "#d1d5db", fontWeight: 800 }} ticks={yTicks} tickLine={false} width={46} />
          <CartesianGrid stroke="#ffffff" strokeDasharray="4 8" strokeOpacity={0.32} vertical={false} />
          <Tooltip content={<CompactTooltip format={formatTooltipValue} skip={(name) => name.startsWith("Zone hasard")} />} />
          <Legend align="left" iconType="circle" verticalAlign="top" wrapperStyle={{ color: "#f8fafc", paddingBottom: 12 }} />
          {bandNames.includes("Hasard 1%-99%") ? (
            <Area
              dataKey="Hasard 1%-99%"
              fill="url(#randomWide)"
              isAnimationActive={false}
              legendType="rect"
              name="Zone hasard 1%-99%"
              stroke="#e5e7eb"
              strokeOpacity={0.26}
              type="monotone"
            />
          ) : null}
          {bandNames.includes("Hasard 5%-95%") ? (
            <Area
              dataKey="Hasard 5%-95%"
              fill="url(#randomCore)"
              isAnimationActive={false}
              legendType="rect"
              name="Zone hasard 5%-95%"
              stroke="#93c5fd"
              strokeOpacity={0.34}
              type="monotone"
            />
          ) : null}
          {playerNames.map((name, index) => (
            <Line
              activeDot={{ r: 5 }}
              dot={false}
              key={name}
              name={name}
              stroke={colors[index % colors.length]}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={name === "XGBoost" ? 4 : 3}
              type="monotone"
              dataKey={name}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
