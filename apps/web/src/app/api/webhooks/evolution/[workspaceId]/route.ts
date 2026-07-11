import { timingSafeEqual } from "node:crypto";

import { QUEUES } from "@vendaflow/core";
import { prisma } from "@vendaflow/db";
import {
  isEvolutionMessageEvent,
  normalizePhone,
  parseWebhookPayload,
} from "@vendaflow/messaging";
import { NextResponse } from "next/server";

import { publishSse } from "@/lib/events";
import { getQueue } from "@/lib/queues";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Comparação de secret resistente a timing attack. */
function timingSafeSecretEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Webhook de entrada da Evolution API (messages.upsert).
 * URL configurada por workspace: /api/webhooks/evolution/{workspaceId}?secret=…
 * Fluxo: valida secret → dedupe → lead/conversa → Message IN → SSE → agente.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const limit = await rateLimit(
    `webhook:evolution:${workspaceId}`,
    RATE_LIMITS.webhook.max,
    RATE_LIMITS.webhook.windowSeconds,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const secret = new URL(request.url).searchParams.get("secret");
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "EVOLUTION" } },
  });
  if (!endpoint || !secret || !timingSafeSecretEqual(endpoint.secret, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  // Eventos que não são mensagem (status de conexão etc.) são aceitos e ignorados.
  if (!isEvolutionMessageEvent(body)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const inbound = parseWebhookPayload(body);
  if (!inbound) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Dedupe por externalId (Evolution reentrega em reconexões).
  const existing = await prisma.message.findFirst({
    where: { externalId: inbound.externalId, conversation: { workspaceId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicated: true });
  }

  const phone = normalizePhone(inbound.from);

  // Lead: acha por telefone ou cria (origem whatsapp-inbound) no estágio inicial.
  let lead = await prisma.lead.findFirst({
    where: { workspaceId, phone },
  });
  if (!lead) {
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { workspaceId, systemKey: "NEW" },
      orderBy: { order: "asc" },
    });
    const fallbackStage =
      firstStage ??
      (await prisma.pipelineStage.findFirst({
        where: { workspaceId },
        orderBy: { order: "asc" },
      }));
    if (!fallbackStage) {
      return NextResponse.json({ error: "workspace sem estágios" }, { status: 422 });
    }
    lead = await prisma.lead.create({
      data: {
        workspaceId,
        name: inbound.senderName || phone,
        phone,
        source: "whatsapp-inbound",
        stageId: fallbackStage.id,
        lastInteractionAt: new Date(),
      },
    });
    await prisma.eventLog.create({
      data: {
        workspaceId,
        actorType: "WEBHOOK",
        type: "lead.created",
        entity: "Lead",
        entityId: lead.id,
        data: { source: "whatsapp-inbound", phone },
      },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { workspaceId, leadId: lead.id, channel: "WHATSAPP" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        leadId: lead.id,
        channel: "WHATSAPP",
        externalId: inbound.from,
        state: "BOT",
      },
    });
  }

  const kind =
    inbound.kind === "IMAGE" ? "IMAGE" : inbound.kind === "FILE" ? "FILE" : "TEXT";
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "IN",
      authorType: "LEAD",
      kind,
      content: {
        text: inbound.text ?? "",
        mediaUrl: inbound.mediaUrl ?? null,
        mediaMimeType: inbound.mediaMimeType ?? null,
      },
      externalId: inbound.externalId,
      status: "DELIVERED",
      sentAt: inbound.timestamp ? new Date(inbound.timestamp) : new Date(),
    },
  });

  await Promise.all([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: { lastInteractionAt: new Date() },
    }),
    prisma.eventLog.create({
      data: {
        workspaceId,
        actorType: "WEBHOOK",
        type: "message.received",
        entity: "Conversation",
        entityId: conversation.id,
        data: { leadId: lead.id, messageId: message.id },
      },
    }),
  ]);

  await publishSse(workspaceId, "inbox", {
    kind: "message_received",
    conversationId: conversation.id,
    leadId: lead.id,
    messageId: message.id,
    preview: inbound.text?.slice(0, 120) ?? "",
  });

  // IA responde apenas se a conversa está com o bot e o lead não saiu.
  if (conversation.state === "BOT" && !lead.optedOut && lead.aiStatus !== "PAUSED") {
    await getQueue(QUEUES.agentReply).add("reply", {
      workspaceId,
      conversationId: conversation.id,
      messageId: message.id,
    });
  }

  return NextResponse.json({ ok: true });
}
