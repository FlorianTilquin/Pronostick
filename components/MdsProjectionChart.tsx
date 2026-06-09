"use client";

import type { MdsPoint } from "@/lib/graphStats";

const palette = ["#34d399", "#60a5fa", "#fb7185", "#a78bfa", "#facc15", "#2dd4bf", "#f97316", "#c084fc"];

export function MdsProjectionChart({ points }: { points: MdsPoint[] }) {
  const activePoints = points.filter((point) => point.predictions > 0);
  const width = 760;
  const height = 520;
  const padding = 70;
  const xs = activePoints.map((point) => point.x);
  const ys = activePoints.map((point) => point.y);
  const minX = Math.min(...xs, -0.1);
  const maxX = Math.max(...xs, 0.1);
  const minY = Math.min(...ys, -0.1);
  const maxY = Math.max(...ys, 0.1);
  const xSpan = Math.max(0.001, maxX - minX);
  const ySpan = Math.max(0.001, maxY - minY);
  const xFor = (x: number) => padding + ((x - minX) / xSpan) * (width - padding * 2);
  const yFor = (y: number) => height - padding - ((y - minY) / ySpan) * (height - padding * 2);
  const maxDistance = Math.max(0.001, ...activePoints.map((point) => point.averageDistance));

  return (
    <div className="analysis-chart-frame mds-frame">
      <svg aria-label="Projection MDS de la proximité entre pronostics" role="img" viewBox={`0 0 ${width} ${height}`}>
        <g className="mds-grid">
          <line x1={padding} x2={width - padding} y1={height / 2} y2={height / 2} />
          <line x1={width / 2} x2={width / 2} y1={padding} y2={height - padding} />
          <rect height={height - padding * 2} rx={8} width={width - padding * 2} x={padding} y={padding} />
        </g>
        {activePoints.map((point, index) => {
          const radius = 10 + (point.averageDistance / maxDistance) * 10;
          const color = palette[index % palette.length];
          const x = xFor(point.x);
          const y = yFor(point.y);

          return (
            <g className="mds-point" key={point.name}>
              <circle cx={x} cy={y} fill={color} fillOpacity={0.2} r={radius + 8} />
              <circle cx={x} cy={y} fill={color} r={radius} />
              <text x={x + radius + 8} y={y - 3}>
                {point.name}
              </text>
              <text className="mds-meta" x={x + radius + 8} y={y + 13}>
                dist. moy. {point.averageDistance.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
