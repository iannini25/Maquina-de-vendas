import type { WorkspaceContext } from "@/lib/session";

/**
 * Agregações do Dashboard — todas via ctx.db (tenantDb).
 * Retorna apenas dados serializáveis (datas como ISO string).
 */

const DAY = 86_400_000;

export interface FunnelBar {
  id: string;
  /** Rótulo curto do protótipo (Novos, Conversa, Qualif., Negoc., Ganho). */
  label: string;
  /** Nome real do estágio (tooltip). */
  name: string;
  count: number;
}

export interface Bottleneck {
  fromName: string;
  toName: string;
  /** % de leads que travam entre os dois estágios (0..100). */
  dropPct: number;
  /** Leads parados no estágio de origem. */
  stuckCount: number;
  /** Estágio de origem — destino do "Resolver agora". */
  stageId: string;
}

export interface DayPoint {
  date: string;
  cents: number;
}

export interface SeriesData {
  /** Últimos 30 dias, um ponto por dia (valores do dia, não acumulados). */
  points: DayPoint[];
  totalCents: number;
  /** Variação % vs 30 dias anteriores; null sem base de comparação. */
  deltaPct: number | null;
}

export interface PendingConversation {
  id: string;
  leadName: string;
  lastText: string;
  lastAt: string | null;
}

export interface OverdueFollowup {
  leadId: string;
  name: string;
  daysSilent: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  paused: boolean;
  leads: number;
}

export interface LandingRow {
  id: string;
  name: string;
  published: boolean;
  /** Conversão SIGNUP/VIEW em % (0..100); null sem visitas registradas. */
  convPct: number | null;
}

export interface DashboardData {
  totalLeads: number;
  activeLeads: number;
  openValueCents: number;
  waitingCount: number;
  bottleneck: Bottleneck | null;
  kpis: {
    leadsDeltaPct: number | null;
    monthRevenueCents: number;
    revenueDeltaPct: number | null;
    /** Taxa de conversão do mês em % (0..100). */
    conversionPct: number;
    /** Delta em pontos percentuais vs mês anterior; null sem base. */
    conversionDeltaPp: number | null;
  };
  funnel: FunnelBar[];
  revenueSeries: SeriesData;
  expenseSeries: SeriesData;
  pendingCount: number;
  pendingConversations: PendingConversation[];
  overdueFollowups: OverdueFollowup[];
  campaigns: CampaignRow[];
  landings: LandingRow[];
}

function messageText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string" && text.length > 0) return text;
  }
  return "[anexo]";
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildSeries(rows: Array<{ at: Date; cents: number }>, now: Date): SeriesData {
  const cutoff30 = new Date(now.getTime() - 30 * DAY);
  const cutoff60 = new Date(now.getTime() - 60 * DAY);
  const byDay = new Map<string, number>();
  let last30 = 0;
  let prev30 = 0;

  for (const row of rows) {
    if (row.at >= cutoff30) {
      last30 += row.cents;
      const key = dayKey(row.at);
      byDay.set(key, (byDay.get(key) ?? 0) + row.cents);
    } else if (row.at >= cutoff60) {
      prev30 += row.cents;
    }
  }

  const points: DayPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(now.getTime() - i * DAY);
    points.push({ date: day.toISOString(), cents: byDay.get(dayKey(day)) ?? 0 });
  }

  return {
    points,
    totalCents: last30,
    deltaPct: prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : null,
  };
}

export async function getDashboardData(ctx: WorkspaceContext): Promise<DashboardData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY);
  const twoDaysAgo = new Date(now.getTime() - 2 * DAY);

  const stages = await ctx.db.pipelineStage.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true, isFixed: true, systemKey: true },
  });
  const wonStage = stages.find((s) => s.systemKey === "WON");
  const lostStage = stages.find((s) => s.systemKey === "LOST");
  const closedIds = [wonStage?.id, lostStage?.id].filter((id): id is string => Boolean(id));

  const [
    totalLeads,
    leadsByStage,
    activeAgg,
    waitingCount,
    revenueMonth,
    revenuePrevMonth,
    createdMonth,
    createdPrevMonth,
    wonMonth,
    wonPrevMonth,
    orders60,
    expenses60,
    pendingCount,
    pendingRows,
    overdueRows,
    campaignRows,
    landingRows,
    landingEventGroups,
  ] = await Promise.all([
    ctx.db.lead.count(),
    ctx.db.lead.groupBy({ by: ["stageId"], _count: { _all: true } }),
    ctx.db.lead.aggregate({
      where: { stageId: { notIn: closedIds } },
      _count: { _all: true },
      _sum: { valueCents: true },
    }),
    ctx.db.lead.count({
      where: { aiStatus: "WAITING_HUMAN", stageId: { notIn: closedIds } },
    }),
    ctx.db.order.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { valueCents: true },
    }),
    ctx.db.order.aggregate({
      where: { status: "PAID", paidAt: { gte: prevMonthStart, lt: monthStart } },
      _sum: { valueCents: true },
    }),
    ctx.db.lead.count({ where: { createdAt: { gte: monthStart } } }),
    ctx.db.lead.count({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    wonStage
      ? ctx.db.lead.count({ where: { stageId: wonStage.id, updatedAt: { gte: monthStart } } })
      : Promise.resolve(0),
    wonStage
      ? ctx.db.lead.count({
          where: { stageId: wonStage.id, updatedAt: { gte: prevMonthStart, lt: monthStart } },
        })
      : Promise.resolve(0),
    ctx.db.order.findMany({
      where: { status: "PAID", paidAt: { gte: sixtyDaysAgo } },
      select: { paidAt: true, valueCents: true },
    }),
    ctx.db.expense.findMany({
      where: { date: { gte: sixtyDaysAgo } },
      select: { date: true, valueCents: true },
    }),
    ctx.db.conversation.count({
      where: {
        OR: [{ unreadCount: { gt: 0 } }, { lead: { aiStatus: "WAITING_HUMAN" } }],
      },
    }),
    ctx.db.conversation.findMany({
      where: {
        OR: [{ unreadCount: { gt: 0 } }, { lead: { aiStatus: "WAITING_HUMAN" } }],
      },
      orderBy: { lastMessageAt: "desc" },
      take: 3,
      select: {
        id: true,
        lastMessageAt: true,
        lead: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    }),
    ctx.db.lead.findMany({
      where: {
        aiStatus: { not: "PAUSED" },
        lastInteractionAt: { lt: twoDaysAgo },
        stage: {
          isFixed: false,
          OR: [{ systemKey: null }, { systemKey: { not: "POST_SALE" } }],
        },
      },
      orderBy: { lastInteractionAt: "asc" },
      take: 3,
      select: { id: true, name: true, lastInteractionAt: true },
    }),
    ctx.db.campaign.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 3,
      select: { id: true, name: true, status: true, _count: { select: { leads: true } } },
    }),
    ctx.db.landingPage.findMany({
      orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
      take: 3,
      select: { id: true, name: true, status: true },
    }),
    ctx.db.landingEvent.groupBy({
      by: ["landingPageId", "type"],
      where: { type: { in: ["VIEW", "SIGNUP"] } },
      _count: { _all: true },
    }),
  ]);

  const countByStage = new Map<string, number>(
    leadsByStage.map((group) => [group.stageId, group._count._all]),
  );
  const countOf = (stageId: string | undefined): number =>
    stageId ? (countByStage.get(stageId) ?? 0) : 0;

  // ── Gargalo: maior queda entre estágios consecutivos de progressão ──────
  const progression = stages.filter(
    (s) => !s.isFixed && (s.systemKey === null || s.systemKey === "NEW"),
  );
  let bottleneck: Bottleneck | null = null;
  let worstDrop = 0;
  for (let i = 0; i < progression.length - 1; i++) {
    const from = progression[i];
    const to = progression[i + 1];
    if (!from || !to) continue;
    const fromCount = countOf(from.id);
    if (fromCount === 0) continue;
    const drop = 1 - countOf(to.id) / fromCount;
    if (drop > worstDrop) {
      worstDrop = drop;
      bottleneck = {
        fromName: from.name,
        toName: to.name,
        dropPct: Math.round(drop * 100),
        stuckCount: fromCount,
        stageId: from.id,
      };
    }
  }

  // ── Funil de 5 barras (systemKey/nome, fallback por ordem) ──────────────
  const byNameFragment = (fragment: string) =>
    stages.find((s) => !s.isFixed && s.name.toLowerCase().includes(fragment));
  const funnelStages: Array<{ label: string; stage: (typeof stages)[number] | undefined }> = [
    { label: "Novos", stage: stages.find((s) => s.systemKey === "NEW") ?? progression[0] },
    { label: "Conversa", stage: byNameFragment("convers") ?? progression[1] },
    { label: "Qualif.", stage: byNameFragment("qualific") ?? progression[2] },
    { label: "Negoc.", stage: byNameFragment("negocia") ?? progression[4] ?? progression[3] },
    { label: "Ganho", stage: wonStage },
  ];
  const funnel: FunnelBar[] = funnelStages
    .filter((entry): entry is { label: string; stage: (typeof stages)[number] } =>
      Boolean(entry.stage),
    )
    .map((entry) => ({
      id: entry.stage.id,
      label: entry.label,
      name: entry.stage.name,
      count: countOf(entry.stage.id),
    }));

  // ── KPIs e deltas ────────────────────────────────────────────────────────
  const monthRevenueCents = revenueMonth._sum.valueCents ?? 0;
  const prevRevenueCents = revenuePrevMonth._sum.valueCents ?? 0;
  const conversionRate = createdMonth > 0 ? wonMonth / createdMonth : 0;
  const prevConversionRate = createdPrevMonth > 0 ? wonPrevMonth / createdPrevMonth : null;

  // ── Conversão de landings (SIGNUP / VIEW) ────────────────────────────────
  const viewsByLanding = new Map<string, number>();
  const signupsByLanding = new Map<string, number>();
  for (const group of landingEventGroups) {
    const target = group.type === "VIEW" ? viewsByLanding : signupsByLanding;
    target.set(group.landingPageId, group._count._all);
  }

  return {
    totalLeads,
    activeLeads: activeAgg._count._all,
    openValueCents: activeAgg._sum.valueCents ?? 0,
    waitingCount,
    bottleneck,
    kpis: {
      leadsDeltaPct:
        createdPrevMonth > 0
          ? ((createdMonth - createdPrevMonth) / createdPrevMonth) * 100
          : null,
      monthRevenueCents,
      revenueDeltaPct:
        prevRevenueCents > 0
          ? ((monthRevenueCents - prevRevenueCents) / prevRevenueCents) * 100
          : null,
      conversionPct: conversionRate * 100,
      conversionDeltaPp:
        prevConversionRate !== null ? (conversionRate - prevConversionRate) * 100 : null,
    },
    funnel,
    revenueSeries: buildSeries(
      orders60.map((o) => ({ at: o.paidAt, cents: o.valueCents })),
      now,
    ),
    expenseSeries: buildSeries(
      expenses60.map((e) => ({ at: e.date, cents: e.valueCents })),
      now,
    ),
    pendingCount,
    pendingConversations: pendingRows.map((row) => ({
      id: row.id,
      leadName: row.lead.name,
      lastText: messageText(row.messages[0]?.content),
      lastAt: row.lastMessageAt?.toISOString() ?? null,
    })),
    overdueFollowups: overdueRows.map((lead) => ({
      leadId: lead.id,
      name: lead.name,
      daysSilent: lead.lastInteractionAt
        ? Math.max(2, Math.floor((now.getTime() - lead.lastInteractionAt.getTime()) / DAY))
        : 2,
    })),
    campaigns: campaignRows.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      paused: campaign.status === "PAUSED",
      leads: campaign._count.leads,
    })),
    landings: landingRows.map((landing) => {
      const views = viewsByLanding.get(landing.id) ?? 0;
      const signups = signupsByLanding.get(landing.id) ?? 0;
      return {
        id: landing.id,
        name: landing.name,
        published: landing.status === "PUBLISHED",
        convPct: views > 0 ? (signups / views) * 100 : null,
      };
    }),
  };
}
