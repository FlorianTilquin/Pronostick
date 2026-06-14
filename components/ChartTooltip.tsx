"use client";

import type { TooltipProps } from "recharts";

type FormatFn = (value: unknown, name: string) => [string, string];

// Tooltip compact partage par les graphes : sur telephone le tooltip recharts
// par defaut empile une ligne par serie et masque les courbes. Ici on resserre
// la typo et on passe en deux colonnes sur petit ecran.
export function CompactTooltip({
  active,
  payload,
  label,
  format,
  skip,
}: TooltipProps<number, string> & { format: FormatFn; skip?: (name: string) => boolean }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((item) => item.value != null && !skip?.(String(item.name)));
  if (!items.length) return null;

  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{String(label)}</div>
      <div className="chart-tip-grid">
        {items.map((item) => {
          const [value, name] = format(item.value, String(item.name));
          return (
            <span className="chart-tip-item" key={String(item.dataKey)}>
              <span className="chart-tip-dot" style={{ background: item.color }} aria-hidden="true" />
              <span className="chart-tip-name">{name}</span>
              <strong>{value}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}
