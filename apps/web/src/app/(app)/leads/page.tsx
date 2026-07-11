import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import type { LeadRowDto, LeadsStatsDto } from "@/server/pipeline/types";

import { LeadsClient } from "./leads-client";

export const metadata: Metadata = { title: "Leads" };

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  EMAIL: "E-mail",
};

export default async function LeadsPage() {
  const ctx = await requireWorkspace();

  const leads = await ctx.db.lead.findMany({
    orderBy: { name: "asc" },
    include: {
      stage: { select: { name: true } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: { channel: true },
      },
    },
  });

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const stats: LeadsStatsDto = {
    total: leads.length,
    novos: leads.filter((l) => l.createdAt.getTime() >= sevenDaysAgo).length,
    emNegociacao: leads.filter((l) => l.stage.name === "Em negociação").length,
    quentes: leads.filter((l) => l.temperature === "HOT").length,
  };

  const rows: LeadRowDto[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    stageName: l.stage.name,
    temperature: l.temperature,
    channel: CHANNEL_LABELS[l.conversations[0]?.channel ?? "WHATSAPP"] ?? "WhatsApp",
    score: l.score,
    aiStatus: l.aiStatus,
  }));

  return <LeadsClient rows={rows} stats={stats} />;
}
