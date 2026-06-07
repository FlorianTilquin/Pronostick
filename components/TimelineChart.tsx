"use client";

import { Area, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#157f57", "#2454a6", "#c94c4c", "#7c4dff", "#f0b429", "#0f766e"];
const bandLabels = new Set(["Hasard 1%-99%", "Hasard 5%-95%"]);

type TimelineRow = Record<string, number | string | [number, number]>;

function formatTooltipValue(value: unknown, name: string) {
  if (Array.isArray(value)) {
    return [`${value[0]} - ${value[1]} pts`, name];
  }
  return [`${value} pts`, name];
}

export function TimelineChart({ data, names }: { data: TimelineRow[]; names: string[] }) {
  const bandNames = names.filter((name) => bandLabels.has(name));
  const playerNames = names.filter((name) => !bandLabels.has(name));

  return (
    <div className="chart-frame">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ left: 0, right: 16, top: 18, bottom: 4 }}>
          <defs>
            <linearGradient id="randomWide" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="randomCore" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2454a6" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#2454a6" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <XAxis dataKey="match" hide />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={42} />
          <Tooltip
            contentStyle={{ border: "1px solid #dbe3d8", borderRadius: 8, boxShadow: "0 18px 50px rgb(24 33 27 / 10%)" }}
            formatter={formatTooltipValue}
            labelFormatter={(label) => String(label)}
          />
          <Legend align="left" iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: 12 }} />
          {bandNames.includes("Hasard 1%-99%") ? (
            <Area
              dataKey="Hasard 1%-99%"
              fill="url(#randomWide)"
              isAnimationActive={false}
              legendType="rect"
              name="Zone hasard 1%-99%"
              stroke="#94a3b8"
              strokeOpacity={0.35}
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
              stroke="#2454a6"
              strokeOpacity={0.3}
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
