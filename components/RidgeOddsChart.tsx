"use client";

import type { RidgeOddsRow } from "@/lib/graphStats";

const palette = ["#34d399", "#60a5fa", "#fb7185", "#a78bfa", "#facc15", "#2dd4bf", "#f97316", "#c084fc"];

function logOdds(value: number) {
  return Math.log(Math.max(1.01, value));
}

function density(values: number[], x: number) {
  if (!values.length) return 0;
  const bandwidth = 0.22;
  const scale = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
  return values.reduce((sum, value) => {
    const z = (x - logOdds(value)) / bandwidth;
    return sum + scale * Math.exp(-0.5 * z * z);
  }, 0) / values.length;
}

export function RidgeOddsChart({ rows }: { rows: RidgeOddsRow[] }) {
  const activeRows = rows.filter((row) => row.values.length);
  const width = 980;
  const rowHeight = 58;
  const top = 30;
  const left = 130;
  const right = 28;
  const bottom = 42;
  const plotWidth = width - left - right;
  const height = top + bottom + Math.max(1, activeRows.length) * rowHeight;
  const maxOdds = Math.max(12, ...activeRows.flatMap((row) => row.values));
  const domainMin = logOdds(1.05);
  const domainMax = logOdds(Math.min(40, Math.max(8, maxOdds)));
  const points = 96;
  const grid = Array.from({ length: points }, (_, index) => domainMin + (index / (points - 1)) * (domainMax - domainMin));
  const densities = activeRows.map((row) => grid.map((x) => density(row.values, x)));
  const maxDensity = Math.max(0.001, ...densities.flat());
  const xFor = (odds: number) => left + ((logOdds(Math.min(40, Math.max(1.05, odds))) - domainMin) / (domainMax - domainMin)) * plotWidth;
  const ticks = [1.2, 1.5, 2, 3, 5, 10, 20, 40].filter((tick) => logOdds(tick) <= domainMax + 0.001);

  return (
    <div className="analysis-chart-frame">
      <svg aria-label="Distribution des cotes choisies par joueur" role="img" viewBox={`0 0 ${width} ${height}`}>
        <g className="chart-axis">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={xFor(tick)} x2={xFor(tick)} y1={top - 12} y2={height - bottom + 8} />
              <text x={xFor(tick)} y={height - 12}>
                x{tick}
              </text>
            </g>
          ))}
        </g>
        {activeRows.map((row, rowIndex) => {
          const baseline = top + rowIndex * rowHeight + rowHeight * 0.72;
          const values = densities[rowIndex] ?? [];
          const areaPoints = grid
            .map((x, index) => {
              const px = left + ((x - domainMin) / (domainMax - domainMin)) * plotWidth;
              const py = baseline - ((values[index] ?? 0) / maxDensity) * 42;
              return `${px.toFixed(1)},${py.toFixed(1)}`;
            })
            .join(" ");
          const fillPath = `${left},${baseline} ${areaPoints} ${left + plotWidth},${baseline}`;
          const color = palette[rowIndex % palette.length];

          return (
            <g key={row.name}>
              <text className="ridge-name" x={18} y={baseline - 10}>
                {row.name}
              </text>
              <text className="ridge-meta" x={18} y={baseline + 8}>
                moy. x{row.average?.toFixed(2)} · {Math.round(row.highRiskShare * 100)}% ≥ x4
              </text>
              <line className="ridge-baseline" x1={left} x2={left + plotWidth} y1={baseline} y2={baseline} />
              <polygon fill={color} fillOpacity={0.28} points={fillPath} />
              <polyline fill="none" points={areaPoints} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} />
              <circle cx={xFor(row.average ?? 1)} cy={baseline} fill={color} r={4.5} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
