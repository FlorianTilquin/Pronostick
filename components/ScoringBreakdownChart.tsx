"use client";

import { useState, type CSSProperties } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CompactTooltip } from "@/components/ChartTooltip";
import type { ChartSeries } from "@/lib/chartColors";

const metrics = [
  { key: "outcome", label: "Bons résultats" },
  { key: "difference", label: "Bonnes DDB" },
  { key: "exact", label: "Scores exacts" }
] as const;

type BreakdownRow = Record<string, number | string>;

function lineDash(series: ChartSeries) {
  if (series.kind === "bookmaker") return "8 5";
  if (series.kind === "model") return "2 5";
  return undefined;
}

export function ScoringBreakdownChart({ data, series }: { data: BreakdownRow[]; series: ChartSeries[] }) {
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);
  const focusName = pinnedName ?? hoverName;

  return (
    <div className="breakdown-block">
      <div className="chart-focus-legend compact" onMouseLeave={() => setHoverName(null)}>
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
      <div className="breakdown-grid">
        {metrics.map((metric) => (
          <div className="breakdown-card" key={metric.key}>
            <h3>{metric.label}</h3>
            <div className="breakdown-chart">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ bottom: 0, left: -18, right: 10, top: 8 }}>
                  <XAxis dataKey="match" hide />
                  <YAxis allowDecimals={false} axisLine={false} tick={{ fill: "#d1d5db", fontWeight: 800 }} tickLine={false} width={38} />
                  <CartesianGrid stroke="#ffffff" strokeDasharray="4 8" strokeOpacity={0.24} vertical={false} />
                  <Tooltip content={<CompactTooltip format={(value, name) => [`${value}`, name]} />} />
                  {series.map((item) => {
                    const focused = focusName === item.name;
                    const muted = focusName !== null && !focused;
                    return (
                      <Line
                        dataKey={`${item.name}__${metric.key}`}
                        dot={false}
                        isAnimationActive={false}
                        key={`${item.name}-${metric.key}`}
                        name={item.name}
                        stroke={item.color}
                        strokeDasharray={lineDash(item)}
                        strokeLinecap="round"
                        strokeOpacity={muted ? 0.16 : 1}
                        strokeWidth={focused ? 4.5 : item.kind === "model" ? 3.5 : 2.6}
                        type="linear"
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
