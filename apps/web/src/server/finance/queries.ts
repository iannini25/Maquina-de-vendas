import { computeFinanceKpis, computeForecast } from "@sales4u/core";
import type { ExpenseCategory } from "@sales4u/db";

import type { WorkspaceContext } from "@/lib/session";

import { EXPENSE_CATEGORIES } from "./categories";
import type { CheckoutProvider } from "./checkout-verify";
import { CHECKOUT_PROVIDER_LABELS, CHECKOUT_PROVIDERS } from "./checkout-verify";
import { readCheckoutMappings } from "./checkout";

/**
 * Queries do módulo ROI & Finanças — todas via ctx.db (tenantDb).
 * Retorna apenas dados serializáveis (datas como ISO string, valores em centavos).
 */

const DAY = 86_400_000;

/** Câmbio aproximado só para exibir o custo das APIs (US$) em R$. */
const USD_BRL_RATE = 5.5;


export interface FinanceKpiCards {
  investedCents: number;
  revenueCents: number;
  profitCents: number;
  /** ROI em % inteiro (-23 = -23%); null sem investimento. */
  roiPct: number | null;
  roas: number | null;
  cacCents: number | null;
  avgTicketCents: number | null;
  marginPct: number | null;
}

export interface ChartDayPoint {
  dateIso: string;
  revenueCents: number;
  expenseCents: number;
}

export interface ForecastCard {
  estimateCents: number;
  /** ROI projetado em % inteiro; null sem base de investimento. */
  projectedRoiPct: number | null;
  /** Valor aberto no pipeline (copy exata do card). */
  pipelineOpenValueCents: number;
}

export interface CampaignRoiRow {
  id: string;
  name: string;
  spentCents: number;
  revenueCents: number;
  roiPct: number | null;
  roas: number | null;
}

export interface ExpenseRow {
  id: string;
  dateIso: string;
  category: ExpenseCategory;
  description: string;
  paidBy: string | null;
  valueCents: number;
  campaignId: string | null;
}

export interface CategorySummary {
  category: ExpenseCategory;
  label: string;
  valueCents: number;
  /** Participação no total (0..100). */
  pct: number;
}

export interface AiCostRow {
  description: string;
  valueCents: number;
}

export interface OrderRow {
  id: string;
  dateIso: string;
  productName: string;
  valueCents: number;
  qty: number;
  source: "MANUAL" | "PIPELINE" | "WEBHOOK";
  provider: string | null;
  channel: string | null;
  status: "PAID" | "REFUNDED" | "CHARGEBACK";
}

export interface CheckoutMappingEntry {
  externalId: string;
  productOfferId: string;
}

export interface CheckoutProviderView {
  provider: CheckoutProvider;
  label: string;
  credentialStatus: "OK" | "ERROR" | "PENDING" | "MISSING";
  webhookUrl: string;
  secretLabel: string;
  secretPlaceholder: string;
  mappings: CheckoutMappingEntry[];
}

export interface ProductOption {
  id: string;
  name: string;
  priceCents: number;
}

export interface CampaignOption {
  id: string;
  name: string;
}

export interface FinancePageData {
  kpis: FinanceKpiCards;
  chart: ChartDayPoint[];
  forecast: ForecastCard;
  campaignRois: CampaignRoiRow[];
  expenses: {
    totalCents: number;
    categories: CategorySummary[];
    rows: ExpenseRow[];
    aiRows: AiCostRow[];
  };
  sales: {
    totalCents: number;
    avgTicketCents: number | null;
    orders: OrderRow[];
  };
  checkout: CheckoutProviderView[];
  products: ProductOption[];
  campaigns: CampaignOption[];
}

const SECRET_FIELD: Record<CheckoutProvider, { label: string; placeholder: string }> = {
  HOTMART: { label: "Hottok (token do webhook)", placeholder: "Hottok da conta Hotmart" },
  KIWIFY: { label: "Token do webhook", placeholder: "Token gerado na Kiwify" },
  EDUZZ: { label: "Chave de assinatura", placeholder: "Chave do webhook Eduzz" },
  STRIPE: { label: "Webhook signing secret", placeholder: "whsec_…" },
};

function formatTokens(total: number): string {
  if (total >= 1_000_000) {
    return `${(total / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`;
  }
  if (total >= 1_000) {
    return `${(total / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`;
  }
  return total.toLocaleString("pt-BR");
}

/** micros de US$ → centavos de R$ (câmbio aproximado, só exibição). */
function usdMicrosToBrlCents(micros: number): number {
  return Math.round((micros * USD_BRL_RATE) / 10_000);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export async function getFinancePageData(ctx: WorkspaceContext): Promise<FinancePageData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const cutoff30 = new Date(now.getTime() - 30 * DAY);
  const cutoff60 = new Date(now.getTime() - 60 * DAY);

  const [
    expensesAll,
    ordersAll,
    aiUsageMonth,
    stages,
    leadsCount,
    openLeads,
    campaigns,
    products,
    credentials,
    workspace,
  ] = await Promise.all([
    ctx.db.expense.findMany({ orderBy: { date: "desc" } }),
    ctx.db.order.findMany({
      orderBy: { paidAt: "desc" },
      include: {
        productOffer: { select: { name: true } },
        lead: { select: { campaignId: true } },
      },
    }),
    ctx.db.aiUsage.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true, inputTokens: true, outputTokens: true },
    }),
    ctx.db.pipelineStage.findMany({ select: { id: true, systemKey: true } }),
    ctx.db.lead.count(),
    ctx.db.lead.findMany({
      where: {
        // Estágios "abertos": customizados (systemKey null) ou fora de ganho/perda/pós.
        stage: {
          OR: [
            { systemKey: null },
            { systemKey: { notIn: ["WON", "LOST", "POST_SALE"] } },
          ],
        },
        valueCents: { not: null },
      },
      select: { valueCents: true },
    }),
    ctx.db.campaign.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    ctx.db.productOffer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
    ctx.db.credential.findMany({
      where: { provider: { in: [...CHECKOUT_PROVIDERS] } },
      select: { provider: true, status: true },
    }),
    ctx.db.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { settings: true },
    }),
  ]);

  const wonStageIds = new Set(stages.filter((s) => s.systemKey === "WON").map((s) => s.id));
  const lostStageIds = new Set(stages.filter((s) => s.systemKey === "LOST").map((s) => s.id));
  const [wonLeadsCount, lostLeadsCount] = await Promise.all([
    wonStageIds.size > 0
      ? ctx.db.lead.count({ where: { stageId: { in: [...wonStageIds] } } })
      : Promise.resolve(0),
    lostStageIds.size > 0
      ? ctx.db.lead.count({ where: { stageId: { in: [...lostStageIds] } } })
      : Promise.resolve(0),
  ]);

  // ── Custo de IA do mês (linha automática de despesa) ─────────────────────
  const aiCostCents = usdMicrosToBrlCents(aiUsageMonth._sum.costMicros ?? 0);
  const aiTokens = (aiUsageMonth._sum.inputTokens ?? 0) + (aiUsageMonth._sum.outputTokens ?? 0);
  const aiRows: AiCostRow[] =
    aiCostCents > 0 || aiTokens > 0
      ? [{ description: `Claude · Anthropic (${formatTokens(aiTokens)} tokens)`, valueCents: aiCostCents }]
      : [];

  // ── KPIs (tudo em centavos; custo de IA entra no investido) ──────────────
  const paidOrders = ordersAll.filter((order) => order.status === "PAID");
  const expensesTotal = expensesAll.reduce((sum, e) => sum + e.valueCents, 0);
  const investedCents = expensesTotal + aiCostCents;
  const revenueCents = paidOrders.reduce((sum, o) => sum + o.valueCents, 0);
  const paidTrafficCents = expensesAll
    .filter((e) => e.category === "PAID_TRAFFIC")
    .reduce((sum, e) => sum + e.valueCents, 0);
  const unitsSold = paidOrders.reduce((sum, o) => sum + o.qty, 0);

  const kpisRaw = computeFinanceKpis({
    totalExpensesCents: investedCents,
    totalRevenueCents: revenueCents,
    paidTrafficCents,
    ordersCount: unitsSold,
    newLeadsCount: leadsCount,
    wonLeadsCount,
  });

  const kpis: FinanceKpiCards = {
    investedCents: kpisRaw.investedCents,
    revenueCents: kpisRaw.revenueCents,
    profitCents: kpisRaw.profitCents,
    roiPct: kpisRaw.roi === null ? null : Math.round(kpisRaw.roi * 100),
    roas: kpisRaw.roas,
    cacCents: kpisRaw.cacCents,
    avgTicketCents: kpisRaw.avgTicketCents,
    marginPct: kpisRaw.margin === null ? null : Math.round(kpisRaw.margin * 100),
  };

  // ── Gráfico Receita × Gasto (30 dias, um ponto por dia) ──────────────────
  const revenueByDay = new Map<string, number>();
  const expenseByDay = new Map<string, number>();
  let revenueLast30 = 0;
  let revenuePrev30 = 0;
  let expensesLast30 = 0;

  for (const order of paidOrders) {
    if (order.paidAt >= cutoff30) {
      revenueLast30 += order.valueCents;
      const key = dayKey(order.paidAt);
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + order.valueCents);
    } else if (order.paidAt >= cutoff60) {
      revenuePrev30 += order.valueCents;
    }
  }
  for (const expense of expensesAll) {
    if (expense.date >= cutoff30) {
      expensesLast30 += expense.valueCents;
      const key = dayKey(expense.date);
      expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + expense.valueCents);
    }
  }

  const chart: ChartDayPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(now.getTime() - i * DAY);
    const key = dayKey(day);
    chart.push({
      dateIso: day.toISOString(),
      revenueCents: revenueByDay.get(key) ?? 0,
      expenseCents: expenseByDay.get(key) ?? 0,
    });
  }

  // ── Previsão do mês (tendência + pipeline × conversão histórica) ─────────
  const pipelineOpenValueCents = openLeads.reduce((sum, l) => sum + (l.valueCents ?? 0), 0);
  const decidedLeads = wonLeadsCount + lostLeadsCount;
  const historicalWinRate = decidedLeads > 0 ? wonLeadsCount / decidedLeads : 0.2;

  const forecastRaw = computeForecast({
    revenueLast30dCents: revenueLast30,
    revenuePrev30dCents: revenuePrev30,
    pipeline: [
      {
        stageId: "open",
        totalValueCents: pipelineOpenValueCents,
        historicalWinRate,
      },
    ],
  });

  const forecast: ForecastCard = {
    estimateCents: forecastRaw.estimateCents,
    projectedRoiPct:
      expensesLast30 + aiCostCents > 0
        ? Math.round(
            ((forecastRaw.estimateCents - (expensesLast30 + aiCostCents)) /
              (expensesLast30 + aiCostCents)) *
              100,
          )
        : null,
    pipelineOpenValueCents,
  };

  // ── ROI por campanha ──────────────────────────────────────────────────────
  const spentByCampaign = new Map<string, number>();
  for (const expense of expensesAll) {
    if (!expense.campaignId) continue;
    spentByCampaign.set(
      expense.campaignId,
      (spentByCampaign.get(expense.campaignId) ?? 0) + expense.valueCents,
    );
  }
  const revenueByCampaign = new Map<string, number>();
  for (const order of paidOrders) {
    const campaignId = order.lead?.campaignId;
    if (!campaignId) continue;
    revenueByCampaign.set(campaignId, (revenueByCampaign.get(campaignId) ?? 0) + order.valueCents);
  }

  const campaignRois: CampaignRoiRow[] = campaigns
    .map((campaign) => {
      const spentCents = spentByCampaign.get(campaign.id) ?? 0;
      const campaignRevenue = revenueByCampaign.get(campaign.id) ?? 0;
      return {
        id: campaign.id,
        name: campaign.name,
        spentCents,
        revenueCents: campaignRevenue,
        roiPct: spentCents > 0 ? Math.round(((campaignRevenue - spentCents) / spentCents) * 100) : null,
        roas: spentCents > 0 ? campaignRevenue / spentCents : null,
      };
    })
    .filter((row) => row.spentCents > 0 || row.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents);

  // ── Despesas por categoria (inclui custo de IA em "APIs & IA") ────────────
  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of expensesAll) {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.valueCents);
  }
  if (aiCostCents > 0) {
    byCategory.set("OTHER", (byCategory.get("OTHER") ?? 0) + aiCostCents);
  }
  const categories: CategorySummary[] = EXPENSE_CATEGORIES.map(({ value, label }) => {
    const valueCents = byCategory.get(value) ?? 0;
    return {
      category: value,
      label,
      valueCents,
      pct: investedCents > 0 ? Math.round((valueCents / investedCents) * 100) : 0,
    };
  });

  // ── Conectar checkout ─────────────────────────────────────────────────────
  const credentialByProvider = new Map(credentials.map((c) => [c.provider, c.status]));
  const mappings = readCheckoutMappings(workspace?.settings);
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  const checkout: CheckoutProviderView[] = CHECKOUT_PROVIDERS.map((provider) => ({
    provider,
    label: CHECKOUT_PROVIDER_LABELS[provider],
    credentialStatus: credentialByProvider.get(provider) ?? "MISSING",
    webhookUrl: `${baseUrl}/api/webhooks/checkout/${provider.toLowerCase()}/${ctx.workspaceId}`,
    secretLabel: SECRET_FIELD[provider].label,
    secretPlaceholder: SECRET_FIELD[provider].placeholder,
    mappings: Object.entries(mappings[provider] ?? {}).map(([externalId, productOfferId]) => ({
      externalId,
      productOfferId,
    })),
  }));

  return {
    kpis,
    chart,
    forecast,
    campaignRois,
    expenses: {
      totalCents: investedCents,
      categories,
      rows: expensesAll.map((expense) => ({
        id: expense.id,
        dateIso: expense.date.toISOString(),
        category: expense.category,
        description: expense.description,
        paidBy: expense.paidBy,
        valueCents: expense.valueCents,
        campaignId: expense.campaignId,
      })),
      aiRows,
    },
    sales: {
      totalCents: revenueCents,
      avgTicketCents: kpis.avgTicketCents,
      orders: ordersAll.map((order) => ({
        id: order.id,
        dateIso: order.paidAt.toISOString(),
        productName: order.productOffer.name,
        valueCents: order.valueCents,
        qty: order.qty,
        source: order.source,
        provider: order.provider,
        channel: order.channel,
        status: order.status,
      })),
    },
    checkout,
    products,
    campaigns,
  };
}
