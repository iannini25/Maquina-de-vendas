import { prisma } from "@sales4u/db";

import type { WorkspaceContext } from "@/lib/session";

/**
 * Consultas do Setup Gate e das Configurações — dados serializáveis
 * (datas como ISO string) para os client components.
 */

// ── Domínio & DNS (Workspace.settings.domains) ───────────────────────────

export interface DomainSettings {
  appDomain: string;
  landingDomain: string;
  /** "OK" | "ERROR" | null (nunca verificado). */
  status: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  /** Verificação aprovada pelo ambiente de desenvolvimento. */
  dev: boolean;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseDomainSettings(settings: unknown): DomainSettings {
  const raw =
    settings && typeof settings === "object"
      ? ((settings as Record<string, unknown>).domains ?? {})
      : {};
  const domains = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    appDomain: asString(domains.appDomain),
    landingDomain: asString(domains.landingDomain),
    status: typeof domains.status === "string" ? domains.status : null,
    verifiedAt: typeof domains.verifiedAt === "string" ? domains.verifiedAt : null,
    lastError: typeof domains.lastError === "string" ? domains.lastError : null,
    dev: domains.dev === true,
  };
}

export async function getDomainSettings(workspaceId: string): Promise<DomainSettings> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });
  return parseDomainSettings(workspace?.settings);
}

// ── Uso & Custos das APIs (mês atual) ─────────────────────────────────────

export interface UsageAiRow {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

export interface UsageSummary {
  /** AiUsage do mês agregado por feature/model. */
  aiRows: UsageAiRow[];
  /** Soma de AiUsage.costMicros do mês. */
  totalCostMicros: number;
  /** Mensagens OUT do mês (WhatsApp). */
  whatsappOut: number;
  /** Mensagens OUT do mês em conversas de e-mail. */
  emailsOut: number;
}

export async function getUsageSummary(ctx: WorkspaceContext): Promise<UsageSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [aiUsage, whatsappOut, emailsOut] = await Promise.all([
    ctx.db.aiUsage.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { feature: true, model: true, inputTokens: true, outputTokens: true, costMicros: true },
    }),
    ctx.db.message.count({
      where: {
        direction: "OUT",
        createdAt: { gte: monthStart },
        conversation: { channel: "WHATSAPP" },
      },
    }),
    ctx.db.message.count({
      where: {
        direction: "OUT",
        createdAt: { gte: monthStart },
        conversation: { channel: "EMAIL" },
      },
    }),
  ]);

  const byKey = new Map<string, UsageAiRow>();
  let totalCostMicros = 0;
  for (const row of aiUsage) {
    totalCostMicros += row.costMicros;
    const key = `${row.feature}::${row.model}`;
    const acc = byKey.get(key) ?? {
      feature: row.feature,
      model: row.model,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
    };
    acc.inputTokens += row.inputTokens;
    acc.outputTokens += row.outputTokens;
    acc.costMicros += row.costMicros;
    byKey.set(key, acc);
  }

  const aiRows = [...byKey.values()].sort((a, b) => b.costMicros - a.costMicros);
  return { aiRows, totalCostMicros, whatsappOut, emailsOut };
}

// ── Conta & Equipe ────────────────────────────────────────────────────────

export interface TeamMember {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isYou: boolean;
}

export async function getTeam(ctx: WorkspaceContext): Promise<TeamMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    membershipId: m.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    isYou: m.user.id === ctx.userId,
  }));
}
