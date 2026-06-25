"use client";

import { useState, type CSSProperties } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CompactTooltip } from "@/components/ChartTooltip";
import type { ChartSeries } from "@/lib/chartColors";

const bandLabels = new Set(["Hasard 1%-99%", "Hasard 5%-95%"]);

type TimelineRow = Record<string, number | string | [number, number]>;

function formatTooltipValue(value: unknown, name: string): [string, string] {
  return [`${value} pts`, name];
}

function lineDash(series: ChartSeries) {
  if (series.kind === "bookmaker") return "8 5";
  if (series.kind === "model") return "2 5";
  return undefined;
}

export function TimelineChart({ data, names, series }: { data: TimelineRow[]; names: string[]; series: ChartSeries[] }) {
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);
  const focusName = pinnedName ?? hoverName;
  const bandNames = names.filter((name) => bandLabels.has(name));
  const playerNames = names.filter((name) => !bandLabels.has(name));
  const seriesByName = new Map(series.map((item) => [item.name, item]));
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
      <div className="chart-focus-legend" onMouseLeave={() => setHoverName(null)}>
        {series.map((item) => (
          <button
            className={focusName === item.name ? "active" : ""}
            key={item.name}
            onBlur={() => setHoverName(null)}
            onClick={() => setPinnedName((current) => (current === item.name ? null : item.name))}
            onFocus={() => setHoverName(item.name)}
            onMouseEnter={() => setHoverName(item.name)}
            style={{ "--series-color": item.color } as CSSProperties}
            type="button"
          >
            <span aria-hidden="true" />
            {item.name}
          </button>
        ))}
      </div>
      <div className="chart-plot">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
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
          {playerNames.map((name) => {
            const item = seriesByName.get(name) ?? { name, color: "#f8fafc" };
            const focused = focusName === name;
            const muted = focusName !== null && !focused;
            return (
              <Line
                activeDot={{ r: focused ? 7 : 5 }}
                dataKey={name}
                dot={false}
                isAnimationActive={false}
                key={name}
                name={name}
                stroke={item.color}
                strokeDasharray={lineDash(item)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={muted ? 0.16 : 1}
                strokeWidth={focused ? 5.5 : item.kind === "model" ? 4 : 3.2}
                type="linear"
              />
            );
          })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
