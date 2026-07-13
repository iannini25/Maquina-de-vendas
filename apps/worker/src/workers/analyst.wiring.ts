import { prisma, type MessageDirection, type Prisma } from "@sales4u/db";
import type { LlmClient } from "@sales4u/brain";
import { Redis } from "ioredis";

import { publishSse, type RedisPublisher } from "../redis.js";
import {
  getWorkspaceLlm,
  MissingCredentialError,
  recordAiUsage,
} from "../services/credentials.js";
import type {
  AnalystDeps,
  CollectedMetrics,
  FunnelMetrics,
  ReportWindow,
} from "./analyst.js";

/**
 * Wiring real do analista: agregações prisma por workspace, LLM por
 * credencial (null sem credencial ⇒ insight local), EventLog e SSE notify.
 */

export function createAnalystWiring(): Omit<AnalystDeps, "log"> {
  return {
    listWorkspaceIds,
    collectMetrics,
    getLlm,
    recordUsage: (usage) => recordAiUsage({ ...usage, feature: "analyst" }),
    saveInsight,
    notify: (workspaceId, payload) =>
      publishSse(getSsePublisher(), workspaceId, "notify", payload),
    now: () => new Date(),
  };
}

async function listWorkspaceIds(): Promise<string[]> {
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  return workspaces.map((workspace) => workspace.id);
}

async function getLlm(workspaceId: string): Promise<LlmClient | null> {
  try {
    return await getWorkspaceLlm(workspaceId);
  } catch (error) {
    if (error instanceof MissingCredentialError) return null;
    throw error;
  }
}

async function collectMetrics(
  workspaceId: string,
  window: ReportWindow,
): Promise<CollectedMetrics> {
  const range = { gte: window.start, lt: window.end };

  const [leadsCreated, stages, contacted, replied, orders, cadencesExhausted] =
    await Promise.all([
      prisma.lead.count({ where: { workspaceId, createdAt: range } }),
      prisma.pipelineStage.findMany({
        where: { workspaceId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          systemKey: true,
          _count: { select: { leads: true } },
        },
      }),
      countDistinctConversations(workspaceId, "OUT", range),
      countDistinctConversations(workspaceId, "IN", range),
      prisma.order.aggregate({
        where: { workspaceId, status: "PAID", paidAt: range },
        _count: { _all: true },
        _sum: { valueCents: true },
      }),
      prisma.eventLog.count({
        where: { workspaceId, type: "cadence.exhausted", createdAt: range },
      }),
    ]);

  return {
    leadsCreated,
    stages: stages.map((stage) => ({
      stageId: stage.id,
      name: stage.name,
      order: stage.order,
      systemKey: stage.systemKey,
      leadCount: stage._count.leads,
    })),
    conversationsContacted: contacted,
    conversationsReplied: replied,
    ordersCount: orders._count._all,
    revenueCents: orders._sum.valueCents ?? 0,
    cadencesExhausted,
  };
}

/** Conversas distintas do workspace com mensagem na direção dada, na janela. */
async function countDistinctConversations(
  workspaceId: string,
  direction: MessageDirection,
  range: { gte: Date; lt: Date },
): Promise<number> {
  const rows = await prisma.message.findMany({
    where: { direction, createdAt: range, conversation: { workspaceId } },
    distinct: ["conversationId"],
    select: { conversationId: true },
  });
  return rows.length;
}

async function saveInsight(
  workspaceId: string,
  insight: string,
  metrics: FunnelMetrics,
): Promise<void> {
  await prisma.eventLog.create({
    data: {
      workspaceId,
      actorType: "AI",
      type: "analyst.insight",
      entity: "Workspace",
      entityId: workspaceId,
      data: JSON.parse(JSON.stringify({ insight, metrics })) as Prisma.InputJsonValue,
    },
  });
}

// ── SSE ─────────────────────────────────────────────────────────────────────

let ssePublisher: RedisPublisher | undefined;

/** Conexão lazy só para publicar SSE (o index.ts não injeta publisher aqui). */
function getSsePublisher(): RedisPublisher {
  if (!ssePublisher) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL ausente — necessária para publicar SSE do analista");
    }
    ssePublisher = new Redis(redisUrl);
  }
  return ssePublisher;
}
