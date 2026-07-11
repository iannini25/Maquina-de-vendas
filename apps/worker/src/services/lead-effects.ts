import { randomBytes } from "node:crypto";

import { computeStageChange, type StageRef } from "@vendaflow/core";
import { prisma } from "@vendaflow/db";

import { publishSse, type RedisPublisher } from "../redis.js";
import type { Log } from "../types.js";

/**
 * Efeitos canônicos de mudança de estágio no worker (usado por move_stage do
 * agente e pela automação): cancela runs, registra evento, publica SSE e,
 * ao ganhar, cria Order + AccessGrant + agenda pós-venda.
 */

export interface StageChangeOutcome {
  ok: boolean;
  toastText: string;
  orderId?: string;
}

export async function applyStageChange(input: {
  workspaceId: string;
  leadId: string;
  toStageId: string;
  movedBy: "AI" | "AUTOMATION";
  reason?: string;
  publisher: RedisPublisher;
  log: Log;
  /** Callback para agendar o fluxo de pós-venda (enfileira job post-sale). */
  schedulePostSale?: (leadId: string) => Promise<void>;
}): Promise<StageChangeOutcome> {
  const { workspaceId, leadId, toStageId, movedBy, reason, publisher, log } = input;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    include: { stage: true },
  });
  if (!lead) return { ok: false, toastText: "" };

  const toStage = await prisma.pipelineStage.findFirst({
    where: { id: toStageId, workspaceId },
  });
  if (!toStage) return { ok: false, toastText: "" };

  const from: StageRef = {
    id: lead.stage.id,
    name: lead.stage.name,
    systemKey: lead.stage.systemKey,
    isFixed: lead.stage.isFixed,
  };
  const to: StageRef = {
    id: toStage.id,
    name: toStage.name,
    systemKey: toStage.systemKey,
    isFixed: toStage.isFixed,
  };

  const { effects, toastText } = computeStageChange({
    leadId,
    from,
    to,
    movedBy,
    reason,
  });
  if (effects.length === 0) return { ok: true, toastText: "" };

  await prisma.lead.update({
    where: { id: leadId },
    data: { stageId: toStageId, lastInteractionAt: new Date() },
  });

  let orderId: string | undefined;

  for (const effect of effects) {
    switch (effect.kind) {
      case "cancel_automation_runs":
        await prisma.automationRun.updateMany({
          where: { leadId, state: { in: ["RUNNING", "PAUSED"] } },
          data: { state: "CANCELLED" },
        });
        break;
      case "emit_event":
        await prisma.eventLog.create({
          data: {
            workspaceId,
            actorType: movedBy === "AI" ? "AI" : "SYSTEM",
            type: effect.event.type,
            entity: "Lead",
            entityId: leadId,
            data: JSON.parse(JSON.stringify(effect.event)),
          },
        });
        break;
      case "publish_sse":
        await publishSse(publisher, workspaceId, effect.channel, effect.payload);
        break;
      case "create_order_from_deal":
        orderId = await createOrderForWonLead(workspaceId, leadId, log);
        break;
      case "grant_access":
        if (orderId) await grantAccess(workspaceId, leadId, orderId);
        break;
      case "schedule_post_sale":
        if (input.schedulePostSale) await input.schedulePostSale(leadId);
        break;
      case "start_stage_automation":
        // A automação do novo estágio é instanciada pelo handler de automação
        // (trigger stage_entered) — ver workers/automation.
        break;
      default:
        break;
    }
  }

  return { ok: true, toastText, orderId };
}

async function createOrderForWonLead(
  workspaceId: string,
  leadId: string,
  log: Log,
): Promise<string | undefined> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId },
    include: { deals: { where: { status: "OPEN" }, take: 1 } },
  });
  if (!lead) return undefined;

  const offer = await prisma.productOffer.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  if (!offer) {
    log.warn({ leadId }, "lead ganho sem ProductOffer no workspace — venda não registrada");
    return undefined;
  }

  const openDeal = lead.deals[0];
  if (openDeal) {
    await prisma.deal.update({
      where: { id: openDeal.id },
      data: { status: "WON", wonAt: new Date() },
    });
  }

  const valueCents = openDeal?.valueCents ?? lead.valueCents ?? offer.priceCents;
  const order = await prisma.order.create({
    data: {
      workspaceId,
      leadId,
      productOfferId: openDeal?.productOfferId ?? offer.id,
      valueCents,
      source: "PIPELINE",
      channel: "whatsapp",
      status: "PAID",
    },
  });

  await prisma.eventLog.create({
    data: {
      workspaceId,
      actorType: "SYSTEM",
      type: "order.paid",
      entity: "Order",
      entityId: order.id,
      data: { leadId, valueCents, source: "PIPELINE" },
    },
  });

  return order.id;
}

async function grantAccess(
  workspaceId: string,
  leadId: string,
  orderId: string,
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, workspaceId },
    include: { productOffer: true },
  });
  if (!order) return;

  const links = order.productOffer.accessLinks as Array<{ label?: string; url?: string }>;
  const url = links?.[0]?.url ?? "";

  await prisma.accessGrant.create({
    data: {
      workspaceId,
      orderId,
      leadId,
      url,
      trackedToken: randomBytes(16).toString("hex"),
    },
  });

  await prisma.eventLog.create({
    data: {
      workspaceId,
      actorType: "SYSTEM",
      type: "access.granted",
      entity: "Lead",
      entityId: leadId,
      data: { orderId },
    },
  });
}
