import type { TenantDb } from "@vendaflow/db";

import { LIVE_REMINDER_STAGES } from "./reminders";

/**
 * Queries do módulo Campanhas (somente server).
 * Client components importam apenas os TIPOS deste arquivo (`import type`).
 */

export type CampaignTypeDto = "STANDARD" | "LAUNCH_LIVE";
export type CampaignStatusDto = "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED";

export interface CampaignCardDto {
  id: string;
  name: string;
  type: CampaignTypeDto;
  status: CampaignStatusDto;
  channel: string | null;
  leads: number;
  conversions: number;
  cplCents: number | null;
  revenueCents: number;
}

export interface CampaignFormOptions {
  products: Array<{ id: string; name: string; priceCents: number }>;
  landings: Array<{ id: string; name: string; slug: string }>;
}

export interface CampaignsHeaderStats {
  activeCount: number;
  avgCplCents: number | null;
}

export interface CampaignsPageData {
  header: CampaignsHeaderStats;
  campaigns: CampaignCardDto[];
  options: CampaignFormOptions;
}

export interface CampaignAdDto {
  id: string;
  title: string;
  angle: string | null;
  channel: string | null;
  ctr: number | null;
  cplCents: number | null;
}

export interface CampaignLeadRowDto {
  id: string;
  name: string;
  stageName: string;
  valueCents: number | null;
  aiStatus: "RUNNING" | "WAITING_HUMAN" | "PAUSED";
}

export interface CampaignReminderDto {
  stage: string;
  label: string;
  atIso: string;
  past: boolean;
}

export interface RevenuePointDto {
  dateIso: string;
  cumulativeCents: number;
}

export interface CampaignDetailDto {
  id: string;
  name: string;
  type: CampaignTypeDto;
  status: CampaignStatusDto;
  objective: string | null;
  channel: string | null;
  budgetCents: number | null;
  cplTargetCents: number | null;
  liveAtIso: string | null;
  warmupEnabled: boolean;
  remindersEnabled: boolean;
  productOfferId: string | null;
  productName: string | null;
  landing: { id: string; name: string; slug: string; externalUrl: string | null } | null;
  kpis: {
    leads: number;
    conversions: number;
    cplCents: number | null;
    roas: number | null;
  };
  revenueSeries: RevenuePointDto[];
  ads: CampaignAdDto[];
  leadRows: CampaignLeadRowDto[];
  reminders: CampaignReminderDto[];
  suggestion: string | null;
}

const DAY = 86_400_000;

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseAdMetrics(metrics: unknown): { ctr: number | null; cplCents: number | null } {
  if (typeof metrics !== "object" || metrics === null || Array.isArray(metrics)) {
    return { ctr: null, cplCents: null };
  }
  const m = metrics as Record<string, unknown>;
  const impressions = typeof m["impressions"] === "number" ? m["impressions"] : null;
  const clicks = typeof m["clicks"] === "number" ? m["clicks"] : null;
  const cplCents = typeof m["cplCents"] === "number" ? Math.round(m["cplCents"]) : null;
  const ctr =
    typeof m["ctr"] === "number"
      ? m["ctr"]
      : impressions !== null && clicks !== null && impressions > 0
        ? clicks / impressions
        : null;
  return { ctr, cplCents };
}

/** "{n} ativas · CPL médio R$ x" — CPL = tráfego pago vinculado / leads de campanhas. */
export async function getCampaignsHeader(db: TenantDb): Promise<CampaignsHeaderStats> {
  const [activeCount, traffic, campaignLeads] = await Promise.all([
    db.campaign.count({ where: { status: "ACTIVE" } }),
    db.expense.aggregate({
      where: { campaignId: { not: null }, category: "PAID_TRAFFIC" },
      _sum: { valueCents: true },
    }),
    db.lead.count({ where: { campaignId: { not: null } } }),
  ]);
  const trafficCents = traffic._sum.valueCents ?? 0;
  return {
    activeCount,
    avgCplCents:
      campaignLeads > 0 && trafficCents > 0 ? Math.round(trafficCents / campaignLeads) : null,
  };
}

export async function getCampaignFormOptions(db: TenantDb): Promise<CampaignFormOptions> {
  const [products, landings] = await Promise.all([
    db.productOffer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
    db.landingPage.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return { products, landings };
}

export async function getCampaignsPageData(db: TenantDb): Promise<CampaignsPageData> {
  const [header, options, campaigns, leadGroups, wonGroups, trafficGroups, orders] =
    await Promise.all([
      getCampaignsHeader(db),
      getCampaignFormOptions(db),
      db.campaign.findMany({ orderBy: { createdAt: "desc" } }),
      db.lead.groupBy({
        by: ["campaignId"],
        where: { campaignId: { not: null } },
        _count: { _all: true },
      }),
      db.lead.groupBy({
        by: ["campaignId"],
        where: { campaignId: { not: null }, stage: { systemKey: "WON" } },
        _count: { _all: true },
      }),
      db.expense.groupBy({
        by: ["campaignId"],
        where: { campaignId: { not: null }, category: "PAID_TRAFFIC" },
        _sum: { valueCents: true },
      }),
      db.order.findMany({
        where: { status: "PAID", lead: { campaignId: { not: null } } },
        select: { valueCents: true, lead: { select: { campaignId: true } } },
      }),
    ]);

  const leadsBy = new Map<string, number>();
  for (const g of leadGroups) if (g.campaignId) leadsBy.set(g.campaignId, g._count._all);

  const wonBy = new Map<string, number>();
  for (const g of wonGroups) if (g.campaignId) wonBy.set(g.campaignId, g._count._all);

  const trafficBy = new Map<string, number>();
  for (const g of trafficGroups) {
    if (g.campaignId) trafficBy.set(g.campaignId, g._sum.valueCents ?? 0);
  }

  const revenueBy = new Map<string, number>();
  for (const order of orders) {
    const campaignId = order.lead?.campaignId;
    if (campaignId) revenueBy.set(campaignId, (revenueBy.get(campaignId) ?? 0) + order.valueCents);
  }

  return {
    header,
    options,
    campaigns: campaigns.map((c) => {
      const leads = leadsBy.get(c.id) ?? 0;
      const traffic = trafficBy.get(c.id) ?? 0;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        channel: c.channel,
        leads,
        conversions: wonBy.get(c.id) ?? 0,
        cplCents: leads > 0 && traffic > 0 ? Math.round(traffic / leads) : null,
        revenueCents: revenueBy.get(c.id) ?? 0,
      };
    }),
  };
}

/** Receita acumulada por dia desde o início da campanha (para o gráfico de área). */
function buildRevenueSeries(
  orders: Array<{ valueCents: number; paidAt: Date }>,
  start: Date,
): RevenuePointDto[] {
  const todayMs = startOfDay(new Date());
  // Limita a janela do gráfico a 120 dias para não gerar séries gigantes.
  const startMs = Math.max(startOfDay(start), todayMs - 120 * DAY);

  const byDay = new Map<number, number>();
  let carriedBefore = 0;
  for (const order of orders) {
    const dayMs = startOfDay(order.paidAt);
    if (dayMs < startMs) {
      carriedBefore += order.valueCents;
      continue;
    }
    byDay.set(dayMs, (byDay.get(dayMs) ?? 0) + order.valueCents);
  }

  const points: RevenuePointDto[] = [];
  let cumulative = carriedBefore;
  for (let dayMs = startMs; dayMs <= todayMs; dayMs += DAY) {
    cumulative += byDay.get(dayMs) ?? 0;
    points.push({ dateIso: new Date(dayMs).toISOString(), cumulativeCents: cumulative });
  }
  return points;
}

export async function getCampaignDetail(
  db: TenantDb,
  id: string,
): Promise<CampaignDetailDto | null> {
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      productOffer: { select: { id: true, name: true } },
      landingPage: { select: { id: true, name: true, slug: true, externalUrl: true } },
      ads: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!campaign) return null;

  const [leads, orders, expensesAgg, trafficAgg, suggestionEvent] = await Promise.all([
    db.lead.findMany({
      where: { campaignId: id },
      select: {
        id: true,
        name: true,
        valueCents: true,
        aiStatus: true,
        stage: { select: { name: true, systemKey: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.order.findMany({
      where: { status: "PAID", lead: { campaignId: id } },
      select: { valueCents: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    }),
    db.expense.aggregate({ where: { campaignId: id }, _sum: { valueCents: true } }),
    db.expense.aggregate({
      where: { campaignId: id, category: "PAID_TRAFFIC" },
      _sum: { valueCents: true },
    }),
    db.eventLog.findFirst({
      where: { type: "campaign.suggestion", entity: "Campaign", entityId: id },
      orderBy: { createdAt: "desc" },
      select: { data: true },
    }),
  ]);

  const revenueCents = orders.reduce((sum, o) => sum + o.valueCents, 0);
  const expensesCents = expensesAgg._sum.valueCents ?? 0;
  const trafficCents = trafficAgg._sum.valueCents ?? 0;
  const leadsCount = leads.length;
  const conversions = leads.filter((l) => l.stage.systemKey === "WON").length;

  const now = Date.now();
  const liveAtMs = campaign.liveAt ? campaign.liveAt.getTime() : null;
  const reminders: CampaignReminderDto[] =
    campaign.type === "LAUNCH_LIVE" && liveAtMs !== null
      ? LIVE_REMINDER_STAGES.map((s) => {
          const atMs = liveAtMs - s.offsetMs;
          return {
            stage: s.stage,
            label: s.label,
            atIso: new Date(atMs).toISOString(),
            past: atMs < now,
          };
        })
      : [];

  const suggestionData = suggestionEvent?.data;
  const suggestion =
    suggestionData &&
    typeof suggestionData === "object" &&
    !Array.isArray(suggestionData) &&
    typeof (suggestionData as Record<string, unknown>)["text"] === "string"
      ? ((suggestionData as Record<string, unknown>)["text"] as string)
      : null;

  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    status: campaign.status,
    objective: campaign.objective,
    channel: campaign.channel,
    budgetCents: campaign.budgetCents,
    cplTargetCents: campaign.cplTargetCents,
    liveAtIso: campaign.liveAt ? campaign.liveAt.toISOString() : null,
    warmupEnabled: campaign.warmupEnabled,
    remindersEnabled: campaign.remindersEnabled,
    productOfferId: campaign.productOffer?.id ?? null,
    productName: campaign.productOffer?.name ?? null,
    landing: campaign.landingPage
      ? {
          id: campaign.landingPage.id,
          name: campaign.landingPage.name,
          slug: campaign.landingPage.slug,
          externalUrl: campaign.landingPage.externalUrl,
        }
      : null,
    kpis: {
      leads: leadsCount,
      conversions,
      cplCents: leadsCount > 0 && trafficCents > 0 ? Math.round(trafficCents / leadsCount) : null,
      roas: expensesCents > 0 ? revenueCents / expensesCents : null,
    },
    revenueSeries: buildRevenueSeries(orders, campaign.startsAt ?? campaign.createdAt),
    ads: campaign.ads.map((ad) => {
      const metrics = parseAdMetrics(ad.metrics);
      return {
        id: ad.id,
        title: ad.hook ?? ad.headline,
        angle: ad.angle,
        channel: ad.channel,
        ctr: metrics.ctr,
        cplCents: metrics.cplCents,
      };
    }),
    leadRows: leads.map((l) => ({
      id: l.id,
      name: l.name,
      stageName: l.stage.name,
      valueCents: l.valueCents,
      aiStatus: l.aiStatus,
    })),
    reminders,
    suggestion,
  };
}
