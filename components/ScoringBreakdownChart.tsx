"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CompactTooltip } from "@/components/ChartTooltip";

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
                <Tooltip content={<CompactTooltip format={(value, name) => [`${value}`, name]} />} />
                <Legend align="center" iconType="circle" verticalAlign="top" wrapperStyle={{ color: "#f8fafc", fontSize: 12, fontWeight: 800, paddingBottom: 8 }} />
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
