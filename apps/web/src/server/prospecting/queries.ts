import type { TenantDb } from "@sales4u/db";

import { hasAiCredential } from "@/lib/ai";

/**
 * Queries do módulo Prospecção (somente server).
 * Client components importam apenas os TIPOS deste arquivo (`import type`).
 */

export type ProspectOriginDto =
  | "VIBE"
  | "LINKEDIN"
  | "IMPORT"
  | "MANUAL"
  | "INERT_CONTACTS"
  | "GHOSTED";

export const ORIGIN_LABELS: Record<ProspectOriginDto, string> = {
  VIBE: "Vibe",
  LINKEDIN: "LinkedIn",
  IMPORT: "Importação",
  MANUAL: "Manual",
  INERT_CONTACTS: "CRM",
  GHOSTED: "CRM",
};

export interface UncontactedProspectDto {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  originLabel: string;
  createdAtIso: string;
}

export interface ProspectListDto {
  id: string;
  name: string;
  sourceLabel: string;
  prospectCount: number;
  /** true = tem abordagem em rascunho/aprovada pendente ("Em abordagem"). */
  inOutreach: boolean;
}

export interface OutreachDraftDto {
  id: string;
  prospectId: string;
  name: string;
  role: string | null;
  company: string | null;
  originLabel: string;
  message: string;
}

export interface ProspectingPageData {
  vibeConnected: boolean;
  hasAi: boolean;
  /** Leads que receberam mensagem e nunca responderam. */
  inertCount: number;
  /** Leads ativos sem interação há mais de 7 dias. */
  ghostedCount: number;
  uncontacted: UncontactedProspectDto[];
  lists: ProspectListDto[];
  drafts: OutreachDraftDto[];
}

const GHOSTED_DAYS = 7;

export function ghostedCutoff(now = new Date()): Date {
  return new Date(now.getTime() - GHOSTED_DAYS * 24 * 60 * 60 * 1000);
}

/** Filtro de leads que receberam mensagem OUT e nunca mandaram uma IN. */
export const INERT_LEADS_WHERE = {
  optedOut: false,
  conversations: { some: { messages: { some: { direction: "OUT" as const } } } },
  NOT: { conversations: { some: { messages: { some: { direction: "IN" as const } } } } },
};

/** Filtro de leads "sumidos": estágio ativo e sem interação há mais de 7 dias. */
export function ghostedLeadsWhere(now = new Date()) {
  return {
    optedOut: false,
    lastInteractionAt: { lt: ghostedCutoff(now) },
    stage: { OR: [{ systemKey: null }, { systemKey: "NEW" as const }] },
  };
}

export async function getProspectingPageData(
  db: TenantDb,
  workspaceId: string,
): Promise<ProspectingPageData> {
  const [credential, hasAi, inertCount, ghostedCount, uncontactedRaw, listsRaw, draftsRaw] =
    await Promise.all([
      db.credential.findFirst({ where: { provider: "EXPLORIUM" }, select: { status: true } }),
      hasAiCredential(workspaceId),
      db.lead.count({ where: INERT_LEADS_WHERE }),
      db.lead.count({ where: ghostedLeadsWhere() }),
      db.prospect.findMany({
        where: { contacted: false },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          company: true,
          role: true,
          phone: true,
          email: true,
          createdAt: true,
          list: { select: { source: true } },
        },
      }),
      db.prospectList.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          source: true,
          _count: { select: { prospects: true } },
          prospects: {
            where: { outreachs: { some: { status: { in: ["DRAFT", "APPROVED"] } } } },
            take: 1,
            select: { id: true },
          },
        },
      }),
      db.outreach.findMany({
        where: { status: "DRAFT" },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          message: true,
          prospect: {
            select: {
              id: true,
              name: true,
              role: true,
              company: true,
              list: { select: { source: true } },
            },
          },
        },
      }),
    ]);

  return {
    vibeConnected: credential?.status === "OK",
    hasAi,
    inertCount,
    ghostedCount,
    uncontacted: uncontactedRaw.map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      company: prospect.company,
      role: prospect.role,
      phone: prospect.phone,
      email: prospect.email,
      originLabel: ORIGIN_LABELS[prospect.list.source],
      createdAtIso: prospect.createdAt.toISOString(),
    })),
    lists: listsRaw.map((list) => ({
      id: list.id,
      name: list.name,
      sourceLabel: ORIGIN_LABELS[list.source],
      prospectCount: list._count.prospects,
      inOutreach: list.prospects.length > 0,
    })),
    drafts: draftsRaw.map((outreach) => ({
      id: outreach.id,
      prospectId: outreach.prospect.id,
      name: outreach.prospect.name,
      role: outreach.prospect.role,
      company: outreach.prospect.company,
      originLabel: ORIGIN_LABELS[outreach.prospect.list.source],
      message: outreach.message,
    })),
  };
}
