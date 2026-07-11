"use client";

import { Card, Overline } from "@/components/ui/card";
import { CountUp, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import type { FinancePageData } from "@/server/finance/queries";

import { formatBRLShort, formatNum1, formatSignedPct } from "./brl";
import { RevenueExpenseChart } from "./revenue-expense-chart";

/** Card de KPI (8 no total, 2 linhas de 4). */
function StatCard({
  label,
  value,
  format,
  display,
  tone = "default",
}: {
  label: string;
  /** Valor numérico para CountUp (quando display não é passado). */
  value?: number;
  format?: (value: number) => string;
  /** Valor pronto (ex.: "—" quando null). */
  display?: string;
  tone?: "default" | "profit" | "loss" | "brand";
}) {
  return (
    <Card
      className={cn(
        "p-4",
        tone === "profit" && "border-success/30 bg-success/[.05]",
        tone === "loss" && "border-danger/30 bg-danger/[.05]",
        tone === "brand" &&
          "border-brand-3/40 bg-[linear-gradient(140deg,#1A1330,#0D0D13_60%)] shadow-[0_0_0_1px_rgba(139,92,246,.2),0_12px_40px_-16px_rgba(139,92,246,.5)]",
      )}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">{label}</p>
      <p
        className={cn(
          "font-display tnum mt-1.5 text-[22px] font-semibold tracking-tight",
          tone === "profit" && "text-success",
          tone === "loss" && "text-danger",
          tone === "brand" ? "text-accent" : tone === "default" ? "text-ink" : "",
        )}
      >
        {display !== undefined ? display : <CountUp value={value ?? 0} format={format} />}
      </p>
    </Card>
  );
}

/** Aba Visão geral (ROI): 8 KPIs, Receita × Gasto, previsão e ROI por campanha. */
export function OverviewTab({ data }: { data: FinancePageData }) {
  const { kpis, forecast, campaignRois } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Investido" value={kpis.investedCents} format={formatBRLShort} />
        <StatCard label="Faturado" value={kpis.revenueCents} format={formatBRLShort} />
        <StatCard
          label="Lucro"
          value={kpis.profitCents}
          format={formatBRLShort}
          tone={kpis.profitCents >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="ROI"
          tone="brand"
          display={kpis.roiPct === null ? "—" : formatSignedPct(kpis.roiPct)}
        />
        <StatCard label="ROAS" display={kpis.roas === null ? "—" : `${formatNum1(kpis.roas)}x`} />
        <StatCard
          label="CAC"
          display={kpis.cacCents === null ? "—" : formatBRLShort(kpis.cacCents)}
        />
        <StatCard
          label="Ticket médio"
          display={kpis.avgTicketCents === null ? "—" : formatBRLShort(kpis.avgTicketCents)}
        />
        <StatCard label="Margem" display={kpis.marginPct === null ? "—" : `${kpis.marginPct}%`} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8">
          <h3 className="text-sm font-semibold text-ink">Receita × Gasto</h3>
          <RevenueExpenseChart points={data.chart} className="mt-4" />
        </Card>

        <Card className="col-span-12 border-brand-3/40 bg-[linear-gradient(140deg,#1A1330,#0D0D13_60%)] shadow-[0_0_0_1px_rgba(139,92,246,.2),0_16px_48px_-16px_rgba(139,92,246,.45)] xl:col-span-4">
          <Overline>Previsão do mês</Overline>
          <p className="font-display tnum mt-2 text-[28px] font-semibold tracking-tight text-ink">
            <CountUp value={forecast.estimateCents} format={formatBRLShort} />
          </p>
          {forecast.projectedRoiPct !== null && (
            <p className="mt-0.5 text-[13px] text-ink-2">
              ROI projetado:{" "}
              <span className={forecast.projectedRoiPct >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
                {formatSignedPct(forecast.projectedRoiPct)}
              </span>
            </p>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
            Estimativa com base na tendência + {formatBRLShort(forecast.pipelineOpenValueCents)} em
            jogo no pipeline × taxa de conversão histórica. Não é garantia.
          </p>
        </Card>
      </div>

      <Card className="p-0">
        <h3 className="px-5 pt-5 text-sm font-semibold text-ink">ROI por campanha</h3>
        {campaignRois.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhuma campanha com gasto ou receita"
              hint="Vincule despesas a campanhas (aba Despesas) e as vendas dos leads aparecem aqui."
            />
          </div>
        ) : (
          <div className="mt-2">
            <Table className="rounded-none border-0 bg-transparent">
              <THead>
                <TH>Campanha</TH>
                <TH>Gasto</TH>
                <TH>Receita</TH>
                <TH>ROI</TH>
                <TH>ROAS</TH>
              </THead>
              <TBody>
                {campaignRois.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium text-ink">{row.name}</TD>
                    <TD className="tnum">{formatBRLShort(row.spentCents)}</TD>
                    <TD className="tnum">{formatBRLShort(row.revenueCents)}</TD>
                    <TD
                      className={cn(
                        "tnum font-semibold",
                        row.roiPct === null ? "text-ink-3" : row.roiPct >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {row.roiPct === null ? "—" : formatSignedPct(row.roiPct)}
                    </TD>
                    <TD className="tnum">{row.roas === null ? "—" : `${formatNum1(row.roas)}x`}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
