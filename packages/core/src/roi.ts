/**
 * Cálculo de ROI, KPIs financeiros e previsão.
 * Valores em centavos; taxas em fração (0.25 = 25%).
 */

export interface FinanceInput {
  totalExpensesCents: number;
  totalRevenueCents: number;
  paidTrafficCents: number;
  ordersCount: number;
  newLeadsCount: number;
  wonLeadsCount: number;
}

export interface FinanceKpis {
  investedCents: number;
  revenueCents: number;
  profitCents: number;
  /** (receita - investimento) / investimento; null sem investimento. */
  roi: number | null;
  /** receita / investimento em tráfego; null sem tráfego. */
  roas: number | null;
  /** investimento / clientes ganhos; null sem clientes. */
  cacCents: number | null;
  /** receita / pedidos; null sem pedidos. */
  avgTicketCents: number | null;
  /** lucro / receita; null sem receita. */
  margin: number | null;
  /** custo por lead (tráfego / novos leads); null sem leads. */
  cplCents: number | null;
}

export function computeFinanceKpis(input: FinanceInput): FinanceKpis {
  const invested = input.totalExpensesCents;
  const revenue = input.totalRevenueCents;
  const profit = revenue - invested;

  return {
    investedCents: invested,
    revenueCents: revenue,
    profitCents: profit,
    roi: invested > 0 ? profit / invested : null,
    roas: input.paidTrafficCents > 0 ? revenue / input.paidTrafficCents : null,
    cacCents: input.wonLeadsCount > 0 ? Math.round(invested / input.wonLeadsCount) : null,
    avgTicketCents: input.ordersCount > 0 ? Math.round(revenue / input.ordersCount) : null,
    margin: revenue > 0 ? profit / revenue : null,
    cplCents: input.newLeadsCount > 0 ? Math.round(input.paidTrafficCents / input.newLeadsCount) : null,
  };
}

export interface StagePipelineSnapshot {
  stageId: string;
  /** Soma de valueCents dos leads no estágio. */
  totalValueCents: number;
  /** Conversão histórica estágio → Ganho (0..1). */
  historicalWinRate: number;
}

export interface ForecastInput {
  /** Receita dos últimos 30 dias. */
  revenueLast30dCents: number;
  /** Receita dos 30 dias anteriores a esses. */
  revenuePrev30dCents: number;
  pipeline: StagePipelineSnapshot[];
}

export interface Forecast {
  /** Projeção de tendência para os próximos 30 dias. */
  trendNext30dCents: number;
  /** Valor do pipeline ponderado pela conversão histórica por estágio. */
  weightedPipelineCents: number;
  /** Soma das duas componentes — sempre exibir como estimativa. */
  estimateCents: number;
  isEstimate: true;
}

export function computeForecast(input: ForecastInput): Forecast {
  const { revenueLast30dCents, revenuePrev30dCents } = input;
  const growth =
    revenuePrev30dCents > 0 ? revenueLast30dCents / revenuePrev30dCents : 1;
  // Trava o fator de tendência em [0.5, 2] para não extrapolar loucura com base pequena.
  const clampedGrowth = Math.min(2, Math.max(0.5, growth));
  const trend = Math.round(revenueLast30dCents * clampedGrowth);

  const weighted = input.pipeline.reduce(
    (sum, s) => sum + Math.round(s.totalValueCents * Math.min(1, Math.max(0, s.historicalWinRate))),
    0,
  );

  return {
    trendNext30dCents: trend,
    weightedPipelineCents: weighted,
    estimateCents: trend + weighted,
    isEstimate: true,
  };
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
