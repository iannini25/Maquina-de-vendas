import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { QUEUES } from "@sales4u/core";
import { prisma } from "@sales4u/db";
import type { Prisma } from "@sales4u/db";

import { AGENT_REPLY_JOBS, OUTBOUND_JOBS, POST_SALE_JOBS } from "../payloads.js";
import { DEFAULT_JOB_OPTIONS } from "../queues.js";
import { publishSse, type RedisPublisher } from "../redis.js";
import { getWorkspaceLlm, recordAiUsage } from "../services/credentials.js";
import { applyStageChange } from "../services/lead-effects.js";
import { retrieveContext } from "../services/rag.js";
import type { Log } from "../types.js";
import type {
  AgentReplyDb,
  AgentReplyDeps,
  StoredConversation,
  StoredMessage,
  StoredOffer,
} from "./agent-reply.js";

/**
 * Wiring real do handler agent-reply: prisma (sempre filtrando por
 * workspaceId), credenciais/uso de IA, RAG, mudança de estágio canônica e
 * filas outbound / post-sale / agent-reply (follow-ups e reagendamentos).
 */

/** Porta mínima de enfileiramento — satisfeita por bullmq.Queue. */
export interface EnqueuePort {
  add(name: string, data: unknown, opts?: { delay?: number }): Promise<unknown>;
}

export interface AgentReplyQueuePorts {
  outbound: EnqueuePort;
  agentReply: EnqueuePort;
  postSale: EnqueuePort;
}

/** Cria as filas usadas pelo handler a partir da conexão BullMQ. */
export function createAgentReplyQueuePorts(connection: Redis): AgentReplyQueuePorts {
  const options = { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS };
  return {
    outbound: new Queue(QUEUES.outbound, options),
    agentReply: new Queue(QUEUES.agentReply, options),
    postSale: new Queue(QUEUES.postSale, options),
  };
}

export interface AgentReplyWiringOptions {
  queues: AgentReplyQueuePorts;
  publisher: RedisPublisher;
  /** env APP_URL — base das landings publicadas ({APP_URL}/p/slug). */
  appUrl: string;
  /** env LANDING_URL opcional — segunda base de landings. */
  landingUrl?: string;
  /** env S3_ENDPOINT/S3_BUCKET — resolução de assetKey do send_image. */
  s3Endpoint: string;
  s3Bucket: string;
  log: Log;
}

/** Monta as dependências reais usadas por createAgentReplyProcessor. */
export function createAgentReplyDeps(options: AgentReplyWiringOptions): AgentReplyDeps {
  return {
    db: createPrismaAgentReplyDb(),
    getLlm: (workspaceId) => getWorkspaceLlm(workspaceId),
    retrieveContext: (workspaceId, query, k) => retrieveContext(workspaceId, query, k),
    enqueueOutbound: async (payload, opts) => {
      await options.queues.outbound.add(OUTBOUND_JOBS.send, payload, { delay: opts.delayMs });
    },
    enqueueAgentReply: async (payload, opts) => {
      const data = opts.followUp ? { ...payload, followUp: true } : payload;
      await options.queues.agentReply.add(AGENT_REPLY_JOBS.reply, data, { delay: opts.delayMs });
    },
    applyStageChange: (input) =>
      applyStageChange({
        ...input,
        movedBy: "AI",
        publisher: options.publisher,
        log: options.log,
        schedulePostSale: async (leadId) => {
          await options.queues.postSale.add(POST_SALE_JOBS.scheduleForLead, {
            workspaceId: input.workspaceId,
            leadId,
          });
        },
      }),
    publish: (workspaceId, kind, payload) =>
      publishSse(options.publisher, workspaceId, kind, payload),
    recordUsage: recordAiUsage,
    urls: {
      appUrl: options.appUrl,
      landingUrl: options.landingUrl,
      s3Endpoint: options.s3Endpoint,
      s3Bucket: options.s3Bucket,
    },
    log: options.log,
  };
}

// ---------------------------------------------------------------------------
// Porta de banco (prisma) — toda query filtra por workspaceId
// ---------------------------------------------------------------------------

function createPrismaAgentReplyDb(): AgentReplyDb {
  return {
    async getConversation(workspaceId, conversationId): Promise<StoredConversation | null> {
      const row = await prisma.conversation.findFirst({
        where: { id: conversationId, workspaceId },
        include: { lead: { include: { stage: { include: { playbook: true } } } } },
      });
      if (!row) return null;
      return {
        id: row.id,
        state: row.state,
        lead: {
          id: row.lead.id,
          name: row.lead.name,
          aiStatus: row.lead.aiStatus,
          optedOut: row.lead.optedOut,
          stage: {
            id: row.lead.stage.id,
            name: row.lead.stage.name,
            systemKey: row.lead.stage.systemKey,
          },
          playbook: row.lead.stage.playbook
            ? {
                objective: row.lead.stage.playbook.objective,
                instructions: row.lead.stage.playbook.instructions,
                allowedActions: row.lead.stage.playbook.allowedActions,
                autonomy: row.lead.stage.playbook.autonomy,
              }
            : null,
        },
      };
    },

    async getInboundMessage(conversationId, messageId): Promise<StoredMessage | null> {
      const row = await prisma.message.findFirst({
        where: { id: messageId, conversationId },
      });
      if (!row) return null;
      return {
        id: row.id,
        direction: row.direction,
        content: row.content,
        createdAt: row.createdAt,
      };
    },

    async hasOutMessageAfter(conversationId, after) {
      const count = await prisma.message.count({
        where: { conversationId, direction: "OUT", createdAt: { gt: after } },
      });
      return count > 0;
    },

    async countOutMessagesSince(conversationId, since) {
      return prisma.message.count({
        where: { conversationId, direction: "OUT", createdAt: { gte: since } },
      });
    },

    async listRecentMessages(conversationId, limit) {
      const rows = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.reverse().map((row) => ({
        id: row.id,
        direction: row.direction,
        content: row.content,
        createdAt: row.createdAt,
      }));
    },

    async createOutMessage(input) {
      const created = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          direction: "OUT",
          authorType: "AI",
          kind: input.kind,
          content: input.content as Prisma.InputJsonValue,
          status: "QUEUED",
        },
        select: { id: true },
      });
      return { id: created.id };
    },

    async updateLead(workspaceId, leadId, data) {
      await prisma.lead.updateMany({ where: { id: leadId, workspaceId }, data });
    },

    async cancelAutomationRuns(workspaceId, leadId) {
      await prisma.automationRun.updateMany({
        where: { leadId, lead: { workspaceId }, state: { in: ["RUNNING", "PAUSED"] } },
        data: { state: "CANCELLED" },
      });
    },

    async createNote(workspaceId, leadId, text) {
      await prisma.note.create({ data: { workspaceId, leadId, text } });
    },

    async createApproval(input) {
      await prisma.approval.create({
        data: {
          workspaceId: input.workspaceId,
          leadId: input.leadId,
          kind: input.kind,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
    },

    async createEventLog(input) {
      await prisma.eventLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorType: "AI",
          type: input.type,
          entity: input.entity,
          entityId: input.entityId,
          data: input.data as Prisma.InputJsonValue,
        },
      });
    },

    async getPersona(workspaceId) {
      const row = await prisma.agentPersona.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      });
      if (!row) return null;
      return {
        name: row.name,
        speaksAs: row.speaksAs,
        tone: row.tone,
        activeHours: row.activeHours,
        commercialRules: row.commercialRules,
      };
    },

    async getActiveMode(workspaceId) {
      const row = await prisma.agentMode.findFirst({
        where: { workspaceId, isActive: true },
        orderBy: { slot: "asc" },
      });
      if (!row) return null;
      return { name: row.name, configJson: row.configJson, markdownKey: row.markdownKey };
    },

    async getContextFileText(workspaceId, markdownKey) {
      const row = await prisma.contextFile.findFirst({
        where: {
          workspaceId,
          OR: [{ id: markdownKey }, { storageKey: markdownKey }, { name: markdownKey }],
        },
        select: { rawText: true },
      });
      return row?.rawText ?? null;
    },

    async getPrimaryOffer(workspaceId) {
      const row = await prisma.productOffer.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      });
      return row ? toStoredOffer(row) : null;
    },

    async getOffer(workspaceId, offerId) {
      const row = await prisma.productOffer.findFirst({
        where: { id: offerId, workspaceId },
      });
      return row ? toStoredOffer(row) : null;
    },

    async getWorkspaceSettings(workspaceId) {
      const row = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      });
      const settings = row?.settings;
      return typeof settings === "object" && settings !== null && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : {};
    },

    async getPublishedLandingSlugs(workspaceId) {
      const rows = await prisma.landingPage.findMany({
        where: { workspaceId, status: "PUBLISHED" },
        select: { slug: true },
      });
      return rows.map((row) => row.slug);
    },

    async listStages(workspaceId) {
      const rows = await prisma.pipelineStage.findMany({
        where: { workspaceId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, systemKey: true },
      });
      return rows.map((row) => ({ id: row.id, name: row.name, systemKey: row.systemKey }));
    },

    async createWonDeal(input) {
      await prisma.deal.create({
        data: {
          workspaceId: input.workspaceId,
          leadId: input.leadId,
          productOfferId: input.productOfferId,
          valueCents: input.valueCents,
          status: "WON",
          wonAt: new Date(),
        },
      });
    },

    async setConversationLastMessageAt(workspaceId, conversationId, at) {
      await prisma.conversation.updateMany({
        where: { id: conversationId, workspaceId },
        data: { lastMessageAt: at },
      });
    },
  };
}

function toStoredOffer(row: {
  id: string;
  name: string;
  priceCents: number;
  guarantee: string | null;
  bonuses: unknown;
  accessLinks: unknown;
}): StoredOffer {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    guarantee: row.guarantee,
    bonuses: row.bonuses,
    accessLinks: row.accessLinks,
  };
}
