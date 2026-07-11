"use server";

import { z } from "zod";

import { requireWorkspace } from "@/lib/session";

/** Busca global (⌘K): leads, campanhas e landing pages do workspace. */

export interface SearchHit {
  kind: "lead" | "campaign" | "landing";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function globalSearch(rawQuery: string): Promise<SearchHit[]> {
  const query = z.string().min(1).max(80).parse(rawQuery.trim());
  const ctx = await requireWorkspace();
  const contains = { contains: query, mode: "insensitive" as const };

  const [leads, campaigns, landings] = await Promise.all([
    ctx.db.lead.findMany({
      where: { OR: [{ name: contains }, { phone: { contains: query } }, { email: contains }] },
      select: { id: true, name: true, phone: true, stage: { select: { name: true } } },
      take: 6,
      orderBy: { lastInteractionAt: "desc" },
    }),
    ctx.db.campaign.findMany({
      where: { name: contains },
      select: { id: true, name: true, status: true },
      take: 4,
    }),
    ctx.db.landingPage.findMany({
      where: { OR: [{ name: contains }, { slug: contains }] },
      select: { id: true, name: true, slug: true, status: true },
      take: 4,
    }),
  ]);

  return [
    ...leads.map((lead) => ({
      kind: "lead" as const,
      id: lead.id,
      title: lead.name,
      subtitle: `${lead.stage.name} · ${lead.phone}`,
      href: `/leads?lead=${lead.id}`,
    })),
    ...campaigns.map((campaign) => ({
      kind: "campaign" as const,
      id: campaign.id,
      title: campaign.name,
      subtitle: campaign.status === "ACTIVE" ? "Campanha ativa" : "Campanha",
      href: `/campanhas/${campaign.id}`,
    })),
    ...landings.map((landing) => ({
      kind: "landing" as const,
      id: landing.id,
      title: landing.name,
      subtitle: `/p/${landing.slug} · ${landing.status === "PUBLISHED" ? "publicada" : "rascunho"}`,
      href: `/landing-pages/${landing.id}`,
    })),
  ];
}

/** Notificações do sino: eventos recentes relevantes + aprovações pendentes. */

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  at: string;
  tone: "brand" | "warn" | "danger" | "success";
}

const NOTIFIABLE_TYPES = [
  "approval.requested",
  "conversation.handoff_triggered",
  "credential.failed",
  "context.missing",
  "import.finished",
  "analyst.insight",
  "order.paid",
  "setup.completed",
];

export async function getNotifications(): Promise<{
  items: NotificationItem[];
  pendingApprovals: number;
}> {
  const ctx = await requireWorkspace();

  const [events, pendingApprovals] = await Promise.all([
    ctx.db.eventLog.findMany({
      where: { type: { in: NOTIFIABLE_TYPES } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    ctx.db.approval.count({ where: { status: "PENDING" } }),
  ]);

  const items = events.map((event) => {
    const data = (event.data ?? {}) as Record<string, unknown>;
    switch (event.type) {
      case "approval.requested":
        return {
          id: event.id,
          title: "Aprovação pendente",
          detail: "A IA precisa do seu OK para uma ação sensível.",
          href: "/inbox",
          at: event.createdAt.toISOString(),
          tone: "warn" as const,
        };
      case "conversation.handoff_triggered":
        return {
          id: event.id,
          title: "Lead pediu um humano",
          detail: String(data.reason ?? "Palavra-gatilho detectada na conversa."),
          href: "/inbox",
          at: event.createdAt.toISOString(),
          tone: "warn" as const,
        };
      case "credential.failed":
        return {
          id: event.id,
          title: "Credencial com problema",
          detail: `${String(data.provider ?? "")}: ${String(data.error ?? "falha na verificação")}`,
          href: "/configuracoes",
          at: event.createdAt.toISOString(),
          tone: "danger" as const,
        };
      case "context.missing":
        return {
          id: event.id,
          title: "A IA precisou de contexto",
          detail: String(data.question ?? "Pergunta sem resposta no contexto."),
          href: "/contexto",
          at: event.createdAt.toISOString(),
          tone: "brand" as const,
        };
      case "import.finished":
        return {
          id: event.id,
          title: "Importação concluída",
          detail: `${String(data.criados ?? "?")} criados · ${String(data.pulados ?? 0)} pulados`,
          href: "/pipeline",
          at: event.createdAt.toISOString(),
          tone: "success" as const,
        };
      case "analyst.insight":
        return {
          id: event.id,
          title: "Insight do analista de funil",
          detail: String(data.insight ?? ""),
          href: "/dashboard",
          at: event.createdAt.toISOString(),
          tone: "brand" as const,
        };
      case "order.paid":
        return {
          id: event.id,
          title: "Venda registrada 🎉",
          detail: "Nova venda entrou no ROI.",
          href: "/financas",
          at: event.createdAt.toISOString(),
          tone: "success" as const,
        };
      default:
        return {
          id: event.id,
          title: "Sistema liberado",
          detail: "Setup concluído — bora vender.",
          href: "/dashboard",
          at: event.createdAt.toISOString(),
          tone: "success" as const,
        };
    }
  });

  return { items, pendingApprovals };
}
