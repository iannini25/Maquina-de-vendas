"use server";

import { randomBytes } from "node:crypto";

import { computeStageChange, formatBRL, STAGE_SEEDS, type StageRef } from "@vendaflow/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, MissingAiCredentialError } from "@/lib/ai";
import { logEvent, publishSse } from "@/lib/events";
import { getQueue, QUEUES } from "@/lib/queues";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace, type WorkspaceContext } from "@/lib/session";

import { textOfContent } from "./queries";
import type { MessageDto } from "./types";

/**
 * Server Actions do Inbox: envio de mensagem, assumir/devolver conversa,
 * sugestão da IA, nova conversa e mover estágio (mesma semântica do worker).
 */

interface Failure {
  ok: false;
  error: string;
  /** True quando a falha é ausência da chave da Anthropic (estado honesto). */
  missingKey?: boolean;
}

const GENERIC_ERROR = "Algo deu errado. Tente de novo em instantes.";

// ── Enviar mensagem ─────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().trim().min(1, "Escreva uma mensagem.").max(4000),
});

export type SendMessageResult = { ok: true; message: MessageDto } | Failure;

export async function sendMessageAction(input: {
  conversationId: string;
  text: string;
}): Promise<SendMessageResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }
  const { conversationId, text } = parsed.data;

  try {
    const ctx = await requireWorkspace();
    const conversation = await ctx.db.conversation.findFirst({
      where: { id: conversationId },
      select: { id: true, leadId: true },
    });
    if (!conversation) return { ok: false, error: "Conversa não encontrada." };

    const limit = RATE_LIMITS.outboundPerConversation;
    const rl = await rateLimit(
      `outbound:${ctx.workspaceId}:${conversationId}`,
      limit.max,
      limit.windowSeconds,
    );
    if (!rl.allowed) {
      return {
        ok: false,
        error: `Muitas mensagens seguidas — aguarde ${rl.resetInSeconds}s e tente de novo.`,
      };
    }

    const message = await ctx.db.message.create({
      data: {
        conversationId,
        direction: "OUT",
        authorType: "HUMAN",
        kind: "TEXT",
        content: { text },
        status: "QUEUED",
      },
    });

    await ctx.db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), unreadCount: 0 },
    });

    await getQueue(QUEUES.outbound).add("send", {
      workspaceId: ctx.workspaceId,
      conversationId,
      messageId: message.id,
      kind: "TEXT",
      payload: { text },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "message.sent",
      entity: "Message",
      entityId: message.id,
      data: { conversationId, leadId: conversation.leadId, authorType: "HUMAN" },
      notify: ["inbox"],
    });

    revalidatePath("/inbox");
    return {
      ok: true,
      message: {
        id: message.id,
        direction: "OUT",
        authorType: "HUMAN",
        text,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Marcar como lida ────────────────────────────────────────────────────────

export async function markConversationReadAction(
  conversationId: string,
): Promise<{ ok: boolean }> {
  try {
    const ctx = await requireWorkspace();
    await ctx.db.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
    revalidatePath("/inbox");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ── Assumir / devolver pra IA ───────────────────────────────────────────────

export type TakeoverResult = { ok: true } | Failure;

export async function takeoverConversationAction(
  conversationId: string,
): Promise<TakeoverResult> {
  try {
    const ctx = await requireWorkspace();
    const conversation = await ctx.db.conversation.findFirst({
      where: { id: conversationId },
      select: { id: true, leadId: true },
    });
    if (!conversation) return { ok: false, error: "Conversa não encontrada." };

    await ctx.db.conversation.update({
      where: { id: conversationId },
      data: { state: "HUMAN" },
    });
    await ctx.db.lead.update({
      where: { id: conversation.leadId },
      data: { aiStatus: "PAUSED" },
    });
    await ctx.db.automationRun.updateMany({
      where: { leadId: conversation.leadId, state: "RUNNING" },
      data: { state: "PAUSED", pausedReason: "human_takeover" },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "conversation.human_takeover",
      entity: "Conversation",
      entityId: conversationId,
      data: { leadId: conversation.leadId, userId: ctx.userId },
      notify: ["inbox"],
    });

    revalidatePath("/inbox");
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function handbackConversationAction(
  conversationId: string,
): Promise<TakeoverResult> {
  try {
    const ctx = await requireWorkspace();
    const conversation = await ctx.db.conversation.findFirst({
      where: { id: conversationId },
      select: { id: true, leadId: true },
    });
    if (!conversation) return { ok: false, error: "Conversa não encontrada." };

    await ctx.db.conversation.update({
      where: { id: conversationId },
      data: { state: "BOT" },
    });
    await ctx.db.lead.update({
      where: { id: conversation.leadId },
      data: { aiStatus: "RUNNING" },
    });
    await ctx.db.automationRun.updateMany({
      where: { leadId: conversation.leadId, state: "PAUSED" },
      data: { state: "RUNNING", pausedReason: null },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "conversation.handback",
      entity: "Conversation",
      entityId: conversationId,
      data: { leadId: conversation.leadId, userId: ctx.userId },
      notify: ["inbox"],
    });

    revalidatePath("/inbox");
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Sugestão da IA ──────────────────────────────────────────────────────────

export type SuggestionResult = { ok: true; text: string } | Failure;

interface SuggestionContext {
  system: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

async function buildSuggestionContext(
  ctx: WorkspaceContext,
  leadId: string,
  conversationId?: string,
): Promise<SuggestionContext | null> {
  const lead = await ctx.db.lead.findFirst({
    where: { id: leadId },
    select: {
      name: true,
      stage: { select: { name: true, playbook: { select: { objective: true, instructions: true } } } },
    },
  });
  if (!lead) return null;

  const [persona, offer] = await Promise.all([
    ctx.db.agentPersona.findFirst({ orderBy: { createdAt: "asc" } }),
    ctx.db.productOffer.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const lines = [
    persona
      ? `Você é ${persona.name}, ${persona.speaksAs}. Tom de voz: ${persona.tone}.`
      : "Você é um(a) SDR humano(a), consultivo(a) e direto(a) ao ponto.",
    `Sua tarefa: escrever a PRÓXIMA mensagem de WhatsApp para o lead ${lead.name}, que está no estágio "${lead.stage.name}" do funil.`,
  ];
  if (lead.stage.playbook?.objective) {
    lines.push(`Objetivo do estágio: ${lead.stage.playbook.objective}.`);
  }
  if (lead.stage.playbook?.instructions) {
    lines.push(`Instruções do playbook: ${lead.stage.playbook.instructions}`);
  }
  if (offer) {
    lines.push(
      `Oferta registrada: ${offer.name} — ${formatBRL(offer.priceCents)}${offer.guarantee ? ` · Garantia: ${offer.guarantee}` : ""}.`,
    );
  }
  lines.push(
    "Regras:",
    "- Responda SOMENTE com o texto da mensagem, sem aspas e sem explicações.",
    "- Mensagem curta (1 a 3 frases), natural, em português do Brasil.",
    "- Não invente preços, bônus, garantias ou links que não estejam acima.",
  );

  let history: SuggestionContext["history"] = [];
  if (conversationId) {
    const raw = await ctx.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { direction: true, content: true },
    });
    for (const message of raw.reverse()) {
      const role = message.direction === "IN" ? "user" : "assistant";
      const text = textOfContent(message.content);
      const last = history[history.length - 1];
      if (last && last.role === role) last.content += `\n${text}`;
      else history.push({ role, content: text });
    }
  }
  if (history.length === 0 || history[0]?.role === "assistant") {
    history = [
      { role: "user", content: "(início da conversa — o lead ainda não respondeu)" },
      ...history,
    ];
  }

  return { system: lines.join("\n"), history };
}

async function runSuggestion(
  ctx: WorkspaceContext,
  context: SuggestionContext,
): Promise<SuggestionResult> {
  const limit = RATE_LIMITS.aiGeneration;
  const rl = await rateLimit(`ai:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
  if (!rl.allowed) {
    return { ok: false, error: `Muitas gerações seguidas — aguarde ${rl.resetInSeconds}s.` };
  }

  try {
    const text = await completeWithUsage({
      workspaceId: ctx.workspaceId,
      feature: "inbox.suggestion",
      tier: "chat",
      system: context.system,
      messages: context.history,
      maxTokens: 512,
    });
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "A IA não retornou sugestão. Tente de novo." };
    return { ok: true, text: trimmed };
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, error: error.message, missingKey: true };
    }
    return { ok: false, error: "Não foi possível gerar a sugestão agora. Tente de novo." };
  }
}

/** Sugestão para a conversa aberta (últimas 10 mensagens de contexto). */
export async function aiSuggestionAction(conversationId: string): Promise<SuggestionResult> {
  try {
    const ctx = await requireWorkspace();
    const conversation = await ctx.db.conversation.findFirst({
      where: { id: conversationId },
      select: { id: true, leadId: true },
    });
    if (!conversation) return { ok: false, error: "Conversa não encontrada." };

    const context = await buildSuggestionContext(ctx, conversation.leadId, conversationId);
    if (!context) return { ok: false, error: "Lead não encontrado." };
    return await runSuggestion(ctx, context);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Sugestão de primeira mensagem no modal Nova conversa. */
export async function openingSuggestionAction(input: {
  leadId?: string;
  name?: string;
}): Promise<SuggestionResult> {
  try {
    const ctx = await requireWorkspace();

    if (input.leadId) {
      const context = await buildSuggestionContext(ctx, input.leadId);
      if (!context) return { ok: false, error: "Lead não encontrado." };
      return await runSuggestion(ctx, context);
    }

    const [persona, offer] = await Promise.all([
      ctx.db.agentPersona.findFirst({ orderBy: { createdAt: "asc" } }),
      ctx.db.productOffer.findFirst({ orderBy: { createdAt: "asc" } }),
    ]);
    const name = input.name?.trim() || "o novo contato";
    const system = [
      persona
        ? `Você é ${persona.name}, ${persona.speaksAs}. Tom de voz: ${persona.tone}.`
        : "Você é um(a) SDR humano(a), consultivo(a) e direto(a) ao ponto.",
      `Sua tarefa: escrever a PRIMEIRA mensagem de WhatsApp para ${name}, abrindo a conversa com leveza e UMA pergunta.`,
      offer ? `Produto: ${offer.name} — ${formatBRL(offer.priceCents)}.` : "",
      "Regras:",
      "- Responda SOMENTE com o texto da mensagem, sem aspas e sem explicações.",
      "- Mensagem curta (1 a 3 frases), natural, em português do Brasil.",
      "- Não fale de preço na primeira mensagem.",
    ]
      .filter(Boolean)
      .join("\n");

    return await runSuggestion(ctx, {
      system,
      history: [{ role: "user", content: "Escreva a primeira mensagem de abordagem." }],
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Nova conversa ───────────────────────────────────────────────────────────

const startConversationSchema = z
  .object({
    recipient: z.enum(["existing", "new"]),
    leadId: z.string().optional(),
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    channel: z.literal("WHATSAPP"),
    firstMessage: z.string().trim().min(1, "Escreva a primeira mensagem.").max(4000),
    aiTakes: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.recipient === "existing" && !value.leadId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione um lead." });
    }
    if (value.recipient === "new") {
      if (!value.name || value.name.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o nome do contato." });
      }
      const digits = value.phone?.replace(/\D/g, "") ?? "";
      if (digits.length < 10) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um WhatsApp válido com DDD." });
      }
    }
  });

export type StartConversationResult = { ok: true; conversationId: string } | Failure;

export async function startConversationAction(input: {
  recipient: "existing" | "new";
  leadId?: string;
  name?: string;
  phone?: string;
  channel: "WHATSAPP";
  firstMessage: string;
  aiTakes: boolean;
}): Promise<StartConversationResult> {
  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  try {
    const ctx = await requireWorkspace();

    // Resolve o lead: existente, mesmo telefone, ou cria em "Novo lead".
    let leadId: string;
    if (data.recipient === "existing") {
      const lead = await ctx.db.lead.findFirst({ where: { id: data.leadId }, select: { id: true } });
      if (!lead) return { ok: false, error: "Lead não encontrado." };
      leadId = lead.id;
    } else {
      const phone = data.phone!.replace(/\D/g, "");
      const existingByPhone = await ctx.db.lead.findFirst({
        where: { phone },
        select: { id: true },
      });
      if (existingByPhone) {
        leadId = existingByPhone.id;
      } else {
        const newStage =
          (await ctx.db.pipelineStage.findFirst({ where: { systemKey: "NEW" }, select: { id: true } })) ??
          (await ctx.db.pipelineStage.findFirst({ orderBy: { order: "asc" }, select: { id: true } }));
        if (!newStage) return { ok: false, error: "Nenhum estágio de funil configurado." };
        const lead = await ctx.db.lead.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: data.name!,
            phone,
            source: "manual",
            stageId: newStage.id,
            aiStatus: data.aiTakes ? "RUNNING" : "PAUSED",
            ownerId: ctx.userId,
          },
        });
        leadId = lead.id;
        await logEvent({
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          type: "lead.created",
          entity: "Lead",
          entityId: lead.id,
          data: { name: data.name, source: "manual" },
          notify: ["pipeline"],
        });
      }
    }

    // Reusa a conversa do lead no canal, se existir; senão cria.
    const state = data.aiTakes ? "BOT" : "HUMAN";
    const existing = await ctx.db.conversation.findFirst({
      where: { leadId, channel: data.channel },
      select: { id: true },
    });
    const conversationId = existing
      ? (await ctx.db.conversation.update({ where: { id: existing.id }, data: { state } })).id
      : (
          await ctx.db.conversation.create({
            data: { workspaceId: ctx.workspaceId, leadId, channel: data.channel, state },
          })
        ).id;

    await ctx.db.lead.update({
      where: { id: leadId },
      data: { aiStatus: data.aiTakes ? "RUNNING" : "PAUSED" },
    });

    const message = await ctx.db.message.create({
      data: {
        conversationId,
        direction: "OUT",
        authorType: "HUMAN",
        kind: "TEXT",
        content: { text: data.firstMessage },
        status: "QUEUED",
      },
    });

    await ctx.db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    await getQueue(QUEUES.outbound).add("send", {
      workspaceId: ctx.workspaceId,
      conversationId,
      messageId: message.id,
      kind: "TEXT",
      payload: { text: data.firstMessage },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "message.sent",
      entity: "Message",
      entityId: message.id,
      data: { conversationId, leadId, authorType: "HUMAN", firstMessage: true },
      notify: ["inbox"],
    });

    revalidatePath("/inbox");
    return { ok: true, conversationId };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Mover estágio (mesma semântica do pipeline/worker) ──────────────────────

const moveStageSchema = z.object({
  leadId: z.string().min(1),
  toStageId: z.string().min(1),
});

export type MoveStageResult = { ok: true; toastText: string } | Failure;

export async function moveLeadStageAction(input: {
  leadId: string;
  toStageId: string;
}): Promise<MoveStageResult> {
  const parsed = moveStageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { leadId, toStageId } = parsed.data;

  try {
    const ctx = await requireWorkspace();
    const lead = await ctx.db.lead.findFirst({
      where: { id: leadId },
      include: { stage: true },
    });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    const toStage = await ctx.db.pipelineStage.findFirst({ where: { id: toStageId } });
    if (!toStage) return { ok: false, error: "Estágio não encontrado." };

    const from: StageRef = {
      id: lead.stage.id,
      name: lead.stage.name,
      systemKey: lead.stage.systemKey,
      isFixed: lead.stage.isFixed,
    };
    const seedToast = STAGE_SEEDS.find((seed) => seed.name === toStage.name)?.playbook.toastText;
    const to: StageRef = {
      id: toStage.id,
      name: toStage.name,
      systemKey: toStage.systemKey,
      isFixed: toStage.isFixed,
      toastText: seedToast,
    };

    const { effects, toastText } = computeStageChange({ leadId, from, to, movedBy: "HUMAN" });
    if (effects.length === 0) return { ok: true, toastText: "" };

    await ctx.db.lead.update({
      where: { id: leadId },
      data: { stageId: toStageId, lastInteractionAt: new Date() },
    });

    let orderId: string | undefined;
    for (const effect of effects) {
      switch (effect.kind) {
        case "cancel_automation_runs":
          await ctx.db.automationRun.updateMany({
            where: { leadId, state: { in: ["RUNNING", "PAUSED"] } },
            data: { state: "CANCELLED" },
          });
          break;
        case "emit_event":
          await logEvent({
            workspaceId: ctx.workspaceId,
            actorType: "USER",
            actorId: ctx.userId,
            type: effect.event.type,
            entity: "Lead",
            entityId: leadId,
            data: JSON.parse(JSON.stringify(effect.event)),
          });
          break;
        case "publish_sse":
          await publishSse(ctx.workspaceId, effect.channel, effect.payload);
          break;
        case "create_order_from_deal":
          orderId = await createOrderForWonLead(ctx, leadId);
          break;
        case "grant_access":
          if (orderId) await grantAccessForOrder(ctx, leadId, orderId);
          break;
        case "schedule_post_sale":
          await getQueue(QUEUES.postSale).add("schedule-for-lead", {
            workspaceId: ctx.workspaceId,
            leadId,
          });
          break;
        case "start_stage_automation":
          // Instanciada pelo worker de automação (trigger stage_entered).
          break;
        default:
          break;
      }
    }

    revalidatePath("/inbox");
    revalidatePath("/pipeline");
    return { ok: true, toastText };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Ao ganhar: fecha o deal aberto (se houver) e registra a Order. */
async function createOrderForWonLead(
  ctx: WorkspaceContext,
  leadId: string,
): Promise<string | undefined> {
  const lead = await ctx.db.lead.findFirst({
    where: { id: leadId },
    include: { deals: { where: { status: "OPEN" }, take: 1 } },
  });
  if (!lead) return undefined;

  const offer = await ctx.db.productOffer.findFirst({ orderBy: { createdAt: "asc" } });
  if (!offer) return undefined;

  const openDeal = lead.deals[0];
  if (openDeal) {
    await ctx.db.deal.update({
      where: { id: openDeal.id },
      data: { status: "WON", wonAt: new Date() },
    });
  }

  const order = await ctx.db.order.create({
    data: {
      workspaceId: ctx.workspaceId,
      leadId,
      productOfferId: openDeal?.productOfferId ?? offer.id,
      valueCents: openDeal?.valueCents ?? lead.valueCents ?? offer.priceCents,
      source: "PIPELINE",
      channel: "whatsapp",
      status: "PAID",
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "SYSTEM",
    type: "order.paid",
    entity: "Order",
    entityId: order.id,
    data: { leadId, valueCents: order.valueCents, source: "PIPELINE" },
  });

  return order.id;
}

/** Ao ganhar: cria o AccessGrant com o primeiro link de acesso da oferta. */
async function grantAccessForOrder(
  ctx: WorkspaceContext,
  leadId: string,
  orderId: string,
): Promise<void> {
  const order = await ctx.db.order.findFirst({
    where: { id: orderId },
    include: { productOffer: true },
  });
  if (!order) return;

  const links = order.productOffer.accessLinks as Array<{ label?: string; url?: string }>;
  const url = links?.[0]?.url ?? "";

  const grant = await ctx.db.accessGrant.create({
    data: {
      workspaceId: ctx.workspaceId,
      orderId,
      leadId,
      url,
      trackedToken: randomBytes(16).toString("hex"),
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "SYSTEM",
    type: "access.granted",
    entity: "Lead",
    entityId: leadId,
    data: { orderId, accessGrantId: grant.id },
  });
}
