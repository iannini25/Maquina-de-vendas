"use client";

import { useId, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";

import { formatBRLShort, formatNum1 } from "./brl";
import type { SeriesData } from "@/server/dashboard/queries";

type Dataset = "receita" | "despesas";

const WIDTH = 300;
const HEIGHT = 130;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;

/** Caminhos SVG do acumulado dos últimos 30 dias (curva ascendente do protótipo). */
function buildPaths(points: SeriesData["points"]): { line: string; area: string } {
  if (points.length === 0) return { line: "", area: "" };
  let acc = 0;
  const cumulative = points.map((point) => (acc += point.cents));
  const max = Math.max(acc, 1);
  const span = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const coords = cumulative.map((value, index) => {
    const x = points.length === 1 ? WIDTH : (index / (points.length - 1)) * WIDTH;
    const y = HEIGHT - PAD_BOTTOM - (value / max) * span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${coords.join(" L")}`;
  return { line, area: `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z` };
}

/**
 * Card de gráfico de área do Dashboard: segmented Receita | Despesas,
 * SVG próprio com gradiente roxo, total dos últimos 30 dias e variação.
 */
export function AreaChartCard({
  revenue,
  expenses,
  className,
}: {
  revenue: SeriesData;
  expenses: SeriesData;
  className?: string;
}) {
  const [dataset, setDataset] = useState<Dataset>("receita");
  const gradientId = useId();

  const data = dataset === "receita" ? revenue : expenses;
  const paths = useMemo(() => buildPaths(data.points), [data.points]);

  // Receita subindo é bom; despesa subindo é ruim.
  const deltaGood =
    data.deltaPct === null ? true : dataset === "receita" ? data.deltaPct >= 0 : data.deltaPct <= 0;

  return (
    <Card className={className}>
      <div className="flex h-full flex-col">
        <Segmented<Dataset>
          size="sm"
          value={dataset}
          onChange={setDataset}
          options={[
            { value: "receita", label: "Receita" },
            { value: "despesas", label: "Despesas" },
          ]}
        />

        <div
          className="mt-4 flex-1"
          title={`${dataset === "receita" ? "Receita" : "Despesas"} acumulada dos últimos 30 dias`}
        >
          {data.totalCents > 0 ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              className="h-32 w-full"
              aria-hidden
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={paths.area} fill={`url(#${gradientId})`} />
              <path
                d={paths.line}
                fill="none"
                stroke="#B388FF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-hairline px-4 text-center text-[12.5px] text-ink-3">
              {dataset === "receita"
                ? "Nenhuma venda registrada nos últimos 30 dias."
                : "Nenhuma despesa registrada nos últimos 30 dias."}
            </div>
          )}
        </div>

        <p className="font-display tnum mt-3 text-xl font-semibold tracking-tight text-ink">
          {formatBRLShort(data.totalCents)}
        </p>
        {data.deltaPct !== null ? (
          <p className={`text-[12px] font-medium ${deltaGood ? "text-success" : "text-danger"}`}>
            {data.deltaPct >= 0 ? "+" : "-"}
            {formatNum1(Math.abs(data.deltaPct))}% vs. mês anterior
          </p>
        ) : (
          <p className="text-[12px] text-ink-3">sem base de comparação ainda</p>
        )}
      </div>
    </Card>
  );
}
