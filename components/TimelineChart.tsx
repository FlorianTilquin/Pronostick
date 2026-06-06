"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors = ["#157f57", "#2454a6", "#c94c4c", "#7c4dff", "#f0b429", "#0f766e"];

export function TimelineChart({ data, names }: { data: Array<Record<string, number | string>>; names: string[] }) {
  return (
    <div style={{ width: "100%", height: 420 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 20, top: 20, bottom: 20 }}>
          <XAxis dataKey="match" hide />
          <YAxis allowDecimals={false} />
          <Tooltip />
          {names.map((name, index) => (
            <Line key={name} type="monotone" dataKey={name} stroke={colors[index % colors.length]} strokeWidth={3} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
