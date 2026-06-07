"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#157f57", "#2454a6", "#c94c4c", "#7c4dff", "#f0b429", "#0f766e"];
const randomColors: Record<string, string> = {
  "Hasard bottom 1%": "#9ca3af",
  "Hasard bottom 5%": "#6b7280",
  "Hasard top 5%": "#374151",
  "Hasard top 1%": "#111827"
};

export function TimelineChart({ data, names }: { data: Array<Record<string, number | string>>; names: string[] }) {
  return (
    <div style={{ width: "100%", height: 420 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 20, top: 20, bottom: 20 }}>
          <XAxis dataKey="match" hide />
          <YAxis allowDecimals={false} />
          <Tooltip />
          {names.map((name, index) => {
            const isRandom = name.startsWith("Hasard");
            return (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={isRandom ? randomColors[name] : colors[index % colors.length]}
                strokeDasharray={isRandom ? "6 5" : undefined}
                strokeWidth={isRandom ? 2 : 3}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
