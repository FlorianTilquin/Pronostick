"use client";

import type { MdsPoint } from "@/lib/graphStats";

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
  // Meme echelle sur les deux axes : les distances MDS ne sont lisibles
  // qu'a rapport d'aspect 1, sinon le second axe est artificiellement etire.
  const scale = Math.min((width - padding * 2) / xSpan, (height - padding * 2) / ySpan);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const xFor = (x: number) => width / 2 + (x - centerX) * scale;
  const yFor = (y: number) => height / 2 - (y - centerY) * scale;
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
          const color = point.color;
          const x = xFor(point.x);
          const y = yFor(point.y);
          const labelOnLeft = x > width - 150;
          const labelX = labelOnLeft ? x - radius - 8 : x + radius + 8;
          const labelAnchor = labelOnLeft ? "end" : "start";

          return (
            <g className="mds-point" key={point.name}>
              <circle cx={x} cy={y} fill={color} fillOpacity={0.2} r={radius + 8} />
              <circle cx={x} cy={y} fill={color} r={radius} />
              <text textAnchor={labelAnchor} x={labelX} y={y - 3}>
                {point.name}
              </text>
              <text className="mds-meta" textAnchor={labelAnchor} x={labelX} y={y + 13}>
                dist. moy. {point.averageDistance.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
