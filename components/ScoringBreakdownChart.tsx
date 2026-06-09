"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#34d399", "#60a5fa", "#fb7185", "#a78bfa", "#facc15", "#2dd4bf", "#f97316", "#c084fc"];

const metrics = [
  { key: "outcome", label: "Bons résultats" },
  { key: "difference", label: "Bonnes DDB" },
  { key: "exact", label: "Scores exacts" }
] as const;

type BreakdownRow = Record<string, number | string>;

export function ScoringBreakdownChart({ data, names }: { data: BreakdownRow[]; names: string[] }) {
  return (
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
                <Tooltip
                  contentStyle={{ background: "#0b1110", border: "1px solid rgb(255 255 255 / 18%)", borderRadius: 8, color: "#f8fafc" }}
                  formatter={(value, name) => [`${value}`, String(name).replace(`__${metric.key}`, "")]}
                  labelFormatter={(label) => String(label)}
                />
                <Legend align="left" iconType="circle" verticalAlign="top" wrapperStyle={{ color: "#f8fafc", fontSize: 12, fontWeight: 800, paddingBottom: 8 }} />
                {names.map((name, index) => (
                  <Line
                    dataKey={`${name}__${metric.key}`}
                    dot={false}
                    isAnimationActive={false}
                    key={`${name}-${metric.key}`}
                    name={name}
                    stroke={colors[index % colors.length]}
                    strokeLinecap="round"
                    strokeWidth={name === "XGBoost" ? 3.5 : 2.5}
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
