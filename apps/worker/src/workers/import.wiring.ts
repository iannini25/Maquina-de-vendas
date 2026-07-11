import { prisma, type Prisma } from "@vendaflow/db";

import { createSsePublisher, publishSse, type RedisPublisher } from "../redis.js";
import { getObject as s3GetObject, s3ConfigFromEnv } from "../services/storage.js";
import type {
  ImportDb,
  ImportDeps,
  ImportEvent,
  NewLeadInput,
  NewProspectInput,
} from "./import.js";

/**
 * Wiring real do handler import: MinIO para o CSV, prisma para leads e
 * prospects e SSE notify para avisar a UI que o import terminou.
 */

// Conexão dedicada a SSE, criada sob demanda (o processor pode nunca precisar).
let publisher: RedisPublisher | undefined;

function getPublisher(): RedisPublisher {
  publisher ??= createSsePublisher(process.env.REDIS_URL ?? "redis://localhost:6379");
  return publisher;
}

/** Monta as dependências reais usadas por createImportProcessor. */
export function createImportWiring(): Omit<ImportDeps, "log"> {
  return {
    db: importDb,
    getObject: async (key) => Buffer.from(await s3GetObject(s3ConfigFromEnv(), key)),
    publishNotify: (workspaceId, payload) =>
      publishSse(getPublisher(), workspaceId, "notify", payload),
  };
}

const importDb: ImportDb = {
  async getNewStageId(workspaceId: string): Promise<string | null> {
    const stage =
      (await prisma.pipelineStage.findFirst({
        where: { workspaceId, systemKey: "NEW" },
        select: { id: true },
      })) ??
      (await prisma.pipelineStage.findFirst({
        where: { workspaceId },
        orderBy: { order: "asc" },
        select: { id: true },
      }));
    return stage?.id ?? null;
  },

  async findExistingLeadPhones(
    workspaceId: string,
    phones: readonly string[],
  ): Promise<string[]> {
    if (phones.length === 0) return [];
    const leads = await prisma.lead.findMany({
      where: { workspaceId, phone: { in: [...phones] } },
      select: { phone: true },
    });
    return leads.map((lead) => lead.phone);
  },

  async createLeadWithConversation(input: NewLeadInput): Promise<void> {
    await prisma.lead.create({
      data: {
        workspaceId: input.workspaceId,
        stageId: input.stageId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        source: input.source,
        valueCents: input.valueCents,
        tags: input.tags,
        conversations: {
          create: { workspaceId: input.workspaceId, channel: "WHATSAPP", state: "BOT" },
        },
      },
    });
  },

  async prospectListBelongsToWorkspace(workspaceId: string, listId: string): Promise<boolean> {
    const lista = await prisma.prospectList.findFirst({
      where: { id: listId, workspaceId },
      select: { id: true },
    });
    return lista !== null;
  },

  async findExistingProspectPhones(listId: string): Promise<string[]> {
    const prospects = await prisma.prospect.findMany({
      where: { listId, phone: { not: null } },
      select: { phone: true },
    });
    return prospects.flatMap((prospect) => (prospect.phone ? [prospect.phone] : []));
  },

  async createProspect(input: NewProspectInput): Promise<void> {
    await prisma.prospect.create({
      data: {
        listId: input.listId,
        name: input.name,
        company: input.company,
        role: input.role,
        phone: input.phone,
        email: input.email,
      },
    });
  },

  async logEvent(event: ImportEvent): Promise<void> {
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
};
