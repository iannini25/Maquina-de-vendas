"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, hasAiCredential, MissingAiCredentialError } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { formatBRL, parseBRLToCents } from "@/lib/format";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace } from "@/lib/session";

import { getCampaignDetail } from "./queries";
import { scheduleLiveReminders } from "./reminders";

/** Server Actions do módulo Campanhas: criar, editar, pausar e sugestão da IA. */

const campaignFormSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(120),
  type: z.enum(["STANDARD", "LAUNCH_LIVE"]),
  productOfferId: z.string().min(1, "Escolha um produto"),
  objective: z.string().trim().min(1, "Escolha um objetivo").max(80),
  channel: z.string().trim().min(1, "Escolha um canal").max(80),
  landingPageId: z.string().nullable().optional(),
  budgetRaw: z.string().max(30).optional(),
  cplTargetRaw: z.string().max(30).optional(),
  /** Valor de <input type="datetime-local"> (obrigatório em LAUNCH_LIVE). */
  liveAt: z.string().max(30).optional(),
  warmupEnabled: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
});

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

export interface CampaignActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** Sucesso parcial (ex.: fila de lembretes indisponível). */
  warning?: string;
}

interface ParsedCampaignForm {
  name: string;
  type: "STANDARD" | "LAUNCH_LIVE";
  productOfferId: string;
  objective: string;
  channel: string;
  landingPageId: string | null;
  budgetCents: number | null;
  cplTargetCents: number | null;
  liveAt: Date | null;
  warmupEnabled: boolean;
  remindersEnabled: boolean;
}

function parseForm(
  input: CampaignFormInput,
): { ok: true; data: ParsedCampaignForm } | { ok: false; error: string } {
  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const data = parsed.data;

  let liveAt: Date | null = null;
  if (data.type === "LAUNCH_LIVE") {
    if (!data.liveAt) return { ok: false, error: "Informe a data da live" };
    liveAt = new Date(data.liveAt);
    if (Number.isNaN(liveAt.getTime())) return { ok: false, error: "Data da live inválida" };
  }

  let budgetCents: number | null = null;
  if (data.budgetRaw && data.budgetRaw.trim() !== "") {
    budgetCents = parseBRLToCents(data.budgetRaw);
    if (budgetCents === null) return { ok: false, error: "Orçamento previsto inválido" };
  }

  let cplTargetCents: number | null = null;
  if (data.cplTargetRaw && data.cplTargetRaw.trim() !== "") {
    cplTargetCents = parseBRLToCents(data.cplTargetRaw);
    if (cplTargetCents === null) return { ok: false, error: "CPL alvo inválido" };
  }

  return {
    ok: true,
    data: {
      name: data.name,
      type: data.type,
      productOfferId: data.productOfferId,
      objective: data.objective,
      channel: data.channel,
      landingPageId: data.landingPageId ?? null,
      budgetCents,
      cplTargetCents,
      liveAt,
      warmupEnabled: data.warmupEnabled ?? false,
      remindersEnabled: data.remindersEnabled ?? false,
    },
  };
}

export async function createCampaign(input: CampaignFormInput): Promise<CampaignActionResult> {
  const ctx = await requireWorkspace();
  const parsed = parseForm(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const form = parsed.data;

  const product = await ctx.db.productOffer.findUnique({
    where: { id: form.productOfferId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Produto inválido" };

  if (form.landingPageId) {
    const landing = await ctx.db.landingPage.findUnique({
      where: { id: form.landingPageId },
      select: { id: true },
    });
    if (!landing) return { ok: false, error: "Landing page inválida" };
  }

  const campaign = await ctx.db.campaign.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: form.name,
      type: form.type,
      objective: form.objective,
      channel: form.channel,
      productOfferId: form.productOfferId,
      landingPageId: form.landingPageId,
      budgetCents: form.budgetCents,
      cplTargetCents: form.cplTargetCents,
      liveAt: form.liveAt,
      warmupEnabled: form.type === "LAUNCH_LIVE" ? form.warmupEnabled : false,
      remindersEnabled: form.type === "LAUNCH_LIVE" ? form.remindersEnabled : false,
      status: "ACTIVE",
      startsAt: new Date(),
    },
  });

  let warning: string | undefined;
  if (form.type === "LAUNCH_LIVE" && form.remindersEnabled) {
    try {
      await scheduleLiveReminders({
        workspaceId: ctx.workspaceId,
        campaignId: campaign.id,
        liveAt: form.liveAt,
        enabled: true,
      });
    } catch {
      warning = "Campanha criada, mas os lembretes não puderam ser agendados (fila indisponível).";
    }
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "campaign.created",
    entity: "Campaign",
    entityId: campaign.id,
    data: { name: form.name, type: form.type },
    notify: ["notify"],
  });

  revalidatePath("/campanhas");
  return { ok: true, id: campaign.id, warning };
}

export async function updateCampaign(
  id: string,
  input: CampaignFormInput,
): Promise<CampaignActionResult> {
  const ctx = await requireWorkspace();
  const parsed = parseForm(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const form = parsed.data;

  const existing = await ctx.db.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Campanha não encontrada" };

  const product = await ctx.db.productOffer.findUnique({
    where: { id: form.productOfferId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Produto inválido" };

  if (form.landingPageId) {
    const landing = await ctx.db.landingPage.findUnique({
      where: { id: form.landingPageId },
      select: { id: true },
    });
    if (!landing) return { ok: false, error: "Landing page inválida" };
  }

  await ctx.db.campaign.update({
    where: { id },
    data: {
      name: form.name,
      type: form.type,
      objective: form.objective,
      channel: form.channel,
      productOfferId: form.productOfferId,
      landingPageId: form.landingPageId,
      budgetCents: form.budgetCents,
      cplTargetCents: form.cplTargetCents,
      liveAt: form.type === "LAUNCH_LIVE" ? form.liveAt : null,
      warmupEnabled: form.type === "LAUNCH_LIVE" ? form.warmupEnabled : false,
      remindersEnabled: form.type === "LAUNCH_LIVE" ? form.remindersEnabled : false,
    },
  });

  let warning: string | undefined;
  try {
    await scheduleLiveReminders({
      workspaceId: ctx.workspaceId,
      campaignId: id,
      liveAt: form.liveAt,
      enabled: form.type === "LAUNCH_LIVE" && form.remindersEnabled,
    });
  } catch {
    warning =
      "Campanha atualizada, mas os lembretes não puderam ser reagendados (fila indisponível).";
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "campaign.updated",
    entity: "Campaign",
    entityId: id,
    data: { name: form.name, type: form.type },
  });

  revalidatePath("/campanhas");
  revalidatePath(`/campanhas/${id}`);
  return { ok: true, id, warning };
}

export interface ToggleStatusResult {
  ok: boolean;
  status?: "ACTIVE" | "PAUSED";
  error?: string;
}

/** Pausar ↔ Reativar (rascunhos também são ativados por aqui). */
export async function toggleCampaignStatus(id: string): Promise<ToggleStatusResult> {
  const ctx = await requireWorkspace();

  const campaign = await ctx.db.campaign.findUnique({
    where: { id },
    select: { id: true, status: true, name: true },
  });
  if (!campaign) return { ok: false, error: "Campanha não encontrada" };

  const next = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  await ctx.db.campaign.update({ where: { id }, data: { status: next } });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: next === "PAUSED" ? "campaign.paused" : "campaign.activated",
    entity: "Campaign",
    entityId: id,
    data: { name: campaign.name, status: next },
  });

  revalidatePath("/campanhas");
  revalidatePath(`/campanhas/${id}`);
  return { ok: true, status: next };
}

export interface SuggestionResult {
  ok: boolean;
  text?: string;
  error?: string;
  missingKey?: boolean;
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Gera 1 insight acionável da IA com as métricas reais da campanha. */
export async function generateCampaignSuggestion(id: string): Promise<SuggestionResult> {
  const ctx = await requireWorkspace();

  if (!(await hasAiCredential(ctx.workspaceId))) {
    return {
      ok: false,
      missingKey: true,
      error: "Configure sua chave da Anthropic em Configurações para usar a IA.",
    };
  }

  const limit = await rateLimit(
    `ai:campaign-suggestion:${ctx.workspaceId}`,
    RATE_LIMITS.aiGeneration.max,
    RATE_LIMITS.aiGeneration.windowSeconds,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Muitas gerações seguidas — tente de novo em ${limit.resetInSeconds}s.`,
    };
  }

  const detail = await getCampaignDetail(ctx.db, id);
  if (!detail) return { ok: false, error: "Campanha não encontrada" };

  const revenueCents =
    detail.revenueSeries.length > 0
      ? (detail.revenueSeries[detail.revenueSeries.length - 1]?.cumulativeCents ?? 0)
      : 0;

  const lines = [
    `Campanha: ${detail.name} (${detail.type === "LAUNCH_LIVE" ? "Lançamento/Live" : "Padrão"}, status ${detail.status})`,
    `Canal: ${detail.channel ?? "—"} · Objetivo: ${detail.objective ?? "—"}`,
    `Leads: ${detail.kpis.leads} · Conversões: ${detail.kpis.conversions}`,
    `CPL real: ${detail.kpis.cplCents !== null ? formatBRL(detail.kpis.cplCents) : "—"} · CPL alvo: ${detail.cplTargetCents !== null ? formatBRL(detail.cplTargetCents) : "—"}`,
    `Receita: ${formatBRL(revenueCents)} · ROAS: ${detail.kpis.roas !== null ? detail.kpis.roas.toFixed(1) + "x" : "—"}`,
    `Orçamento previsto: ${detail.budgetCents !== null ? formatBRL(detail.budgetCents) : "—"}`,
    detail.ads.length > 0
      ? `Anúncios: ${detail.ads
          .map(
            (ad) =>
              `"${ad.title}" (CTR ${ad.ctr !== null ? formatPercent(ad.ctr) : "—"}, CPL ${ad.cplCents !== null ? formatBRL(ad.cplCents) : "—"})`,
          )
          .join(" · ")}`
      : "Anúncios: nenhum ainda",
  ];

  try {
    const text = (
      await completeWithUsage({
        workspaceId: ctx.workspaceId,
        feature: "campaign_suggestion",
        tier: "chat",
        system:
          "Você é o analista de tráfego e funil do Sales4U. Responda em pt-BR, sem markdown, " +
          "com EXATAMENTE 1 insight acionável (1 a 2 frases) sobre a campanha a partir das métricas " +
          "reais fornecidas. Seja específico e cite números. Nunca invente dados.",
        messages: [{ role: "user", content: lines.join("\n") }],
        maxTokens: 300,
      })
    ).trim();

    if (!text) return { ok: false, error: "A IA não retornou sugestão. Tente novamente." };

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "AI",
      type: "campaign.suggestion",
      entity: "Campaign",
      entityId: id,
      data: { text },
    });

    revalidatePath(`/campanhas/${id}`);
    return { ok: true, text };
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, missingKey: true, error: error.message };
    }
    return { ok: false, error: "Não foi possível gerar a sugestão agora. Tente novamente." };
  }
}
