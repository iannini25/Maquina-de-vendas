import type { TenantDb } from "@sales4u/db";

import { POST_SALE_FLOWS, resolveFlowSettings, type PostSaleFlowKey } from "./flows";

/**
 * Queries do módulo Pós-venda (somente server).
 * Client components importam apenas os TIPOS deste arquivo (`import type`).
 */

export type AccessUsageDto = "NEVER" | "ACCESSED" | "ACTIVE" | "IDLE";

export interface PostSaleClientRow {
  leadId: string;
  name: string;
  usage: AccessUsageDto | null;
}

export interface PostSaleFlowRow {
  key: PostSaleFlowKey;
  title: string;
  emailPurpose: string;
  enabled: boolean;
}

export interface AccessGrantRow {
  grantId: string;
  leadName: string;
  logged: boolean;
  totalActiveSeconds: number;
  lastActivityIso: string | null;
  status: AccessUsageDto;
}

export interface PostSalePageData {
  /** Clientes com acesso NEVER/IDLE (banner âmbar). */
  inactiveCount: number;
  clients: PostSaleClientRow[];
  flows: PostSaleFlowRow[];
  upsellWindowDays: number;
  accessRows: AccessGrantRow[];
}

export async function getPostSalePageData(
  db: TenantDb,
  workspaceId: string,
): Promise<PostSalePageData> {
  const [clientsRaw, grants, workspace, firstOffer, inactiveLeadIds] = await Promise.all([
    db.lead.findMany({
      where: { orders: { some: { status: "PAID" } } },
      select: {
        id: true,
        name: true,
        accessGrants: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
        orders: {
          where: { status: "PAID" },
          orderBy: { paidAt: "desc" },
          take: 1,
          select: { paidAt: true },
        },
      },
    }),
    db.accessGrant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        firstAccessAt: true,
        lastActivityAt: true,
        totalActiveSeconds: true,
        lead: { select: { name: true } },
      },
    }),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } }),
    db.productOffer.findFirst({
      orderBy: { createdAt: "asc" },
      select: { upsellWindowDays: true },
    }),
    db.accessGrant.findMany({
      where: { status: { in: ["NEVER", "IDLE"] } },
      select: { leadId: true },
      distinct: ["leadId"],
    }),
  ]);

  const flowState = resolveFlowSettings(workspace?.settings);

  const clients = clientsRaw
    .map((lead) => ({
      leadId: lead.id,
      name: lead.name,
      usage: lead.accessGrants[0]?.status ?? null,
      lastPaidAt: lead.orders[0]?.paidAt ?? null,
    }))
    .sort((a, b) => (b.lastPaidAt?.getTime() ?? 0) - (a.lastPaidAt?.getTime() ?? 0))
    .map(({ leadId, name, usage }) => ({ leadId, name, usage }));

  return {
    inactiveCount: inactiveLeadIds.length,
    clients,
    flows: POST_SALE_FLOWS.map((def) => ({
      key: def.key,
      title: def.title,
      emailPurpose: def.emailPurpose,
      enabled: flowState[def.key],
    })),
    upsellWindowDays: firstOffer?.upsellWindowDays ?? 7,
    accessRows: grants.map((grant) => ({
      grantId: grant.id,
      leadName: grant.lead.name,
      logged: grant.firstAccessAt !== null,
      totalActiveSeconds: grant.totalActiveSeconds,
      lastActivityIso: grant.lastActivityAt ? grant.lastActivityAt.toISOString() : null,
      status: grant.status,
    })),
  };
}
