import { randomUUID } from "node:crypto";

import { prisma, type Prisma } from "@vendaflow/db";
import { Redis } from "ioredis";

import { publishSse, type RedisPublisher } from "../redis.js";
import { getWorkspaceEmbedder } from "../services/credentials.js";
import { vectorLiteral } from "../services/rag.js";
import { getObject, s3ConfigFromEnv, type S3Config } from "../services/storage.js";
import type {
  ContextFileStorePort,
  ContextIngestDeps,
  IngestEvent,
} from "./context-ingest.js";

/**
 * Wiring real do handler context-ingest: prisma (ContextFile/Chunk/EventLog),
 * MinIO via SigV4, unpdf para PDF, embedder Voyage por credencial e SSE notify.
 */

export function createContextIngestWiring(): Omit<ContextIngestDeps, "log"> {
  return {
    files: prismaContextFileStore,
    storage: { getObject: fetchFromS3 },
    extractPdfText,
    getEmbedder: getWorkspaceEmbedder,
    notify: (workspaceId, payload) =>
      publishSse(getSsePublisher(), workspaceId, "notify", payload),
  };
}

// ── S3 / PDF ────────────────────────────────────────────────────────────────

let cachedS3Config: S3Config | undefined;

async function fetchFromS3(storageKey: string): Promise<Uint8Array> {
  cachedS3Config ??= s3ConfigFromEnv();
  return getObject(cachedS3Config, storageKey);
}

/** unpdf carregado sob demanda — só quando chega um PDF de verdade. */
async function extractPdfText(data: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(data, { mergePages: true });
  // Defensivo: versões antigas do unpdf devolvem string[] mesmo com mergePages.
  return typeof text === "string" ? text : text.join("\n\n");
}

// ── Persistência (prisma) ───────────────────────────────────────────────────

const prismaContextFileStore: ContextFileStorePort = {
  async load(workspaceId, contextFileId) {
    return prisma.contextFile.findFirst({
      where: { id: contextFileId, workspaceId },
      select: { id: true, workspaceId: true, name: true, rawText: true, storageKey: true },
    });
  },

  async markProcessing(contextFileId) {
    await prisma.contextFile.update({
      where: { id: contextFileId },
      data: { status: "PROCESSING", error: null },
    });
  },

  async markIndexed(contextFileId) {
    await prisma.contextFile.update({
      where: { id: contextFileId },
      data: { status: "INDEXED", error: null },
    });
  },

  async markError(contextFileId, error) {
    await prisma.contextFile.update({
      where: { id: contextFileId },
      data: { status: "ERROR", error },
    });
  },

  async replaceChunks(contextFileId, chunks) {
    const rows = chunks.map((chunk) => ({
      id: randomUUID(),
      contextFileId,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
    }));
    await prisma.$transaction([
      prisma.contextChunk.deleteMany({ where: { contextFileId } }),
      prisma.contextChunk.createMany({ data: rows }),
    ]);
    return rows.map((row) => row.id);
  },

  async saveEmbedding(chunkId, vector) {
    await prisma.$executeRaw`
      UPDATE "ContextChunk"
      SET embedding = ${vectorLiteral(vector)}::vector
      WHERE id = ${chunkId}`;
  },

  async logEvent(event: IngestEvent) {
    await prisma.eventLog.create({
      data: {
        workspaceId: event.workspaceId,
        actorType: "SYSTEM",
        type: event.type,
        entity: "ContextFile",
        entityId: event.contextFileId,
        data: event.data as Prisma.InputJsonValue,
      },
    });
  },
};

// ── SSE ─────────────────────────────────────────────────────────────────────

let ssePublisher: RedisPublisher | undefined;

/** Conexão lazy só para publicar SSE (o index.ts não injeta publisher aqui). */
function getSsePublisher(): RedisPublisher {
  if (!ssePublisher) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL ausente — necessária para publicar SSE da ingestão");
    }
    ssePublisher = new Redis(redisUrl);
  }
  return ssePublisher;
}
