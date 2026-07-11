"use client";

import { useId } from "react";

/**
 * Gráfico de área SVG leve (sem lib): linha com gradiente roxo e área
 * preenchida com fade — padrão do card "Receita da campanha" do protótipo.
 */
export function AreaChart({
  values,
  ariaLabel,
  className,
}: {
  values: number[];
  ariaLabel: string;
  className?: string;
}) {
  const gradientId = useId();

  const W = 600;
  const H = 170;
  const PAD = 14;

  const points = values.length === 1 ? [values[0] ?? 0, values[0] ?? 0] : values;
  const max = Math.max(...points, 1);

  const coords = points.map((value, index) => ({
    x: (index / (points.length - 1)) * W,
    y: H - PAD - (value / max) * (H - 2 * PAD),
  }));

  const first = coords[0] ?? { x: 0, y: H - PAD };
  const linePath =
    `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ` +
    coords
      .slice(1)
      .map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className={className ?? "h-44 w-full"}
    >
      <defs>
        <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId}-area)`} />
      <path
        d={linePath}
        fill="none"
        stroke={`url(#${gradientId}-line)`}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
