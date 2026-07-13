import { Queue } from "bullmq";

import { QUEUES } from "@sales4u/core";
import { prisma, type Prisma } from "@sales4u/db";
import type { EmailStructure } from "@sales4u/emails";

import { EMAIL_JOBS, OUTBOUND_JOBS } from "../payloads.js";
import { DEFAULT_JOB_OPTIONS } from "../queues.js";
import { createBullRedis } from "../redis.js";
import {
  resolvePostSaleToggles,
  type EmailPurposePostSale,
  type EmailTemplateRecord,
  type GrantRecord,
  type LeadContext,
  type OrderRecord,
  type OutMessageRef,
  type PostSaleAutonomy,
  type PostSaleDb,
  type PostSaleEvent,
  type PostSaleWiring,
  type UpsellApprovalInput,
} from "./post-sale.js";

/**
 * Wiring real do handler post-sale: prisma para os dados, filas BullMQ
 * outbound/email para os envios e env para links/segredos.
 */

// Filas produtoras compartilham uma única conexão redis (criada sob demanda).
let filas: { outbound: Queue; email: Queue } | undefined;

function getFilas(): { outbound: Queue; email: Queue } {
  if (!filas) {
    const connection = createBullRedis(process.env.REDIS_URL ?? "redis://localhost:6379");
    filas = {
      outbound: new Queue(QUEUES.outbound, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
      email: new Queue(QUEUES.email, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    };
  }
  return filas;
}

/** Monta as dependências reais usadas por createPostSaleProcessor. */
export function createPostSaleWiring(): PostSaleWiring {
  return {
    db: postSaleDb,
    enqueueOutbound: async (payload) => {
      await getFilas().outbound.add(OUTBOUND_JOBS.send, payload);
    },
    enqueueEmail: async (payload) => {
      await getFilas().email.add(EMAIL_JOBS.send, payload);
    },
    appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    optoutSecret: process.env.AUTH_SECRET ?? process.env.APP_ENCRYPTION_KEY ?? "",
  };
}

const postSaleDb: PostSaleDb = {
  async getLeadContext(workspaceId: string, leadId: string): Promise<LeadContext | null> {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: {
        workspace: { select: { settings: true } },
        accessGrants: { orderBy: { createdAt: "desc" }, take: 1 },
        orders: {
          where: { status: "PAID" },
          orderBy: { paidAt: "desc" },
          take: 1,
          include: { productOffer: { select: { name: true } } },
        },
      },
    });
    if (!lead) return null;

    const grant = lead.accessGrants[0];
    const order = lead.orders[0];
    return {
      lead: { id: lead.id, name: lead.name, email: lead.email, optedOut: lead.optedOut },
      toggles: resolvePostSaleToggles(lead.workspace.settings),
      grant: grant ? { trackedToken: grant.trackedToken } : null,
      order: order ? { valueCents: order.valueCents, productName: order.productOffer.name } : null,
    };
  },

  async hasEventSince(
    workspaceId: string,
    type: string,
    entityId: string,
    since?: Date,
  ): Promise<boolean> {
    const encontrado = await prisma.eventLog.findFirst({
      where: {
        workspaceId,
        type,
        entityId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { id: true },
    });
    return encontrado !== null;
  },

  async logEvent(event: PostSaleEvent): Promise<void> {
    await prisma.eventLog.create({
      data: {
        workspaceId: event.workspaceId,
        actorType: "SYSTEM",
        type: event.type,
        entity: event.entity,
        entityId: event.entityId,
        data: event.data as Prisma.InputJsonValue,
      },
    });
  },

  async createOutboundMessage(
    workspaceId: string,
    leadId: string,
    text: string,
  ): Promise<OutMessageRef> {
    const conversa =
      (await prisma.conversation.findFirst({
        where: { workspaceId, leadId, channel: "WHATSAPP" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })) ??
      (await prisma.conversation.create({
        data: { workspaceId, leadId, channel: "WHATSAPP" },
        select: { id: true },
      }));

    const mensagem = await prisma.message.create({
      data: {
        conversationId: conversa.id,
        direction: "OUT",
        authorType: "AI",
        kind: "TEXT",
        content: { text },
        status: "QUEUED",
      },
      select: { id: true },
    });
    return { conversationId: conversa.id, messageId: mensagem.id };
  },

  async getEmailTemplate(
    workspaceId: string,
    purpose: EmailPurposePostSale,
  ): Promise<EmailTemplateRecord | null> {
    const template =
      (await prisma.emailTemplate.findFirst({
        where: { workspaceId, purpose, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      })) ??
      (await prisma.emailTemplate.findFirst({
        where: { workspaceId, purpose },
        orderBy: { updatedAt: "desc" },
      }));
    if (!template) return null;
    return {
      name: template.name,
      structure: template.structure as EmailStructure,
      bodyText: template.bodyText,
    };
  },

  async listGrants(workspaceId?: string): Promise<GrantRecord[]> {
    const grants = await prisma.accessGrant.findMany({
      where: workspaceId ? { workspaceId } : {},
      include: {
        lead: { select: { id: true, name: true, email: true, optedOut: true } },
        order: { include: { productOffer: { select: { name: true } } } },
        workspace: { select: { settings: true } },
      },
    });
    return grants.map((grant) => ({
      id: grant.id,
      workspaceId: grant.workspaceId,
      status: grant.status,
      createdAt: grant.createdAt,
      firstAccessAt: grant.firstAccessAt,
      lastActivityAt: grant.lastActivityAt,
      idleThresholdDays: grant.idleThresholdDays,
      trackedToken: grant.trackedToken,
      productName: grant.order.productOffer.name,
      lead: grant.lead,
      toggles: resolvePostSaleToggles(grant.workspace.settings),
    }));
  },

  async listPaidOrders(workspaceId?: string): Promise<OrderRecord[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: "PAID",
        leadId: { not: null },
        ...(workspaceId ? { workspaceId } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, email: true, optedOut: true } },
        productOffer: { select: { name: true, upsellWindowDays: true } },
        accessGrants: { orderBy: { createdAt: "desc" }, take: 1, select: { trackedToken: true } },
        workspace: { select: { settings: true } },
      },
    });
    return orders.map((order) => ({
      id: order.id,
      workspaceId: order.workspaceId,
      paidAt: order.paidAt,
      valueCents: order.valueCents,
      productName: order.productOffer.name,
      upsellWindowDays: order.productOffer.upsellWindowDays,
      trackedToken: order.accessGrants[0]?.trackedToken ?? null,
      lead: order.lead,
      toggles: resolvePostSaleToggles(order.workspace.settings),
    }));
  },

  async setGrantStatus(grantId: string, status: "ACTIVE" | "IDLE"): Promise<void> {
    await prisma.accessGrant.update({ where: { id: grantId }, data: { status } });
  },

  async getPostSaleAutonomy(workspaceId: string): Promise<PostSaleAutonomy | null> {
    const stage = await prisma.pipelineStage.findFirst({
      where: { workspaceId, systemKey: "POST_SALE" },
      include: { playbook: { select: { autonomy: true } } },
    });
    return stage?.playbook?.autonomy ?? null;
  },

  async createUpsellApproval(input: UpsellApprovalInput): Promise<void> {
    await prisma.approval.create({
      data: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        kind: "MESSAGE_DRAFT",
        payload: {
          text: input.text,
          motivo: "upsell_pos_venda",
          orderId: input.orderId,
          productName: input.productName,
        },
      },
    });
  },
};
