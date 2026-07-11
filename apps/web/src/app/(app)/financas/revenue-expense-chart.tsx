"use client";

import { useId, useMemo } from "react";

import { cn } from "@/components/ui/cn";
import type { ChartDayPoint } from "@/server/finance/queries";

const WIDTH = 600;
const HEIGHT = 170;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;

function buildPath(values: number[], max: number): { line: string; area: string } {
  if (values.length === 0) return { line: "", area: "" };
  const span = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? WIDTH : (index / (values.length - 1)) * WIDTH;
    const y = HEIGHT - PAD_BOTTOM - (value / max) * span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${coords.join(" L")}`;
  return { line, area: `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z` };
}

/**
 * Gráfico "Receita × Gasto" do protótipo: área roxa (receita acumulada 30d)
 * + linha tracejada rosa (gasto acumulado) + legenda. SVG próprio, sem lib.
 */
export function RevenueExpenseChart({
  points,
  className,
}: {
  points: ChartDayPoint[];
  className?: string;
}) {
  const gradientId = useId();

  const { revenuePaths, expenseLine, hasData } = useMemo(() => {
    let revenueAcc = 0;
    let expenseAcc = 0;
    const revenueCumulative = points.map((point) => (revenueAcc += point.revenueCents));
    const expenseCumulative = points.map((point) => (expenseAcc += point.expenseCents));
    const max = Math.max(revenueAcc, expenseAcc, 1);
    return {
      revenuePaths: buildPath(revenueCumulative, max),
      expenseLine: buildPath(expenseCumulative, max).line,
      hasData: revenueAcc > 0 || expenseAcc > 0,
    };
  }, [points]);

  if (!hasData) {
    return (
      <div className={cn("flex h-44 items-center justify-center rounded-xl border border-dashed border-hairline px-4 text-center text-[12.5px] text-ink-3", className)}>
        Nenhuma venda ou despesa nos últimos 30 dias — lance a primeira para ver a curva.
      </div>
    );
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label="Receita e gasto acumulados dos últimos 30 dias"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={revenuePaths.area} fill={`url(#${gradientId})`} />
        <path
          d={revenuePaths.line}
          fill="none"
          stroke="#B388FF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={expenseLine}
          fill="none"
          stroke="#F472B6"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-3 flex items-center gap-5 text-[12px] text-ink-3">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-[#B388FF]" />
          Receita
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full [background:repeating-linear-gradient(90deg,#F472B6_0_4px,transparent_4px_7px)]" />
          Gasto
        </span>
      </div>
    </div>
  );
}
