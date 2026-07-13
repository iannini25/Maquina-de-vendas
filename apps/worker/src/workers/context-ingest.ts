import { chunkText, type Embedder } from "@sales4u/brain";

import { NotImplementedYetError } from "../errors.js";
import {
  CONTEXT_INGEST_JOBS,
  contextIngestJobSchema,
  type ContextIngestJobPayload,
} from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "context-ingest": extrai texto (rawText, S3, PDF), faz
 * chunking, gera embeddings Voyage (quando há credencial) e indexa.
 * Lógica pura com deps injetadas; o wiring real (prisma, S3, unpdf, SSE)
 * está em context-ingest.wiring.ts e só é carregado se faltar alguma dep.
 */

export interface ContextFileRecord {
  id: string;
  workspaceId: string;
  name: string;
  rawText: string | null;
  storageKey: string | null;
}

export interface IndexableChunk {
  content: string;
  tokenCount: number;
}

export interface IngestEvent {
  workspaceId: string;
  contextFileId: string;
  type: "context.indexed" | "context.ingest_failed";
  data: Record<string, unknown>;
}

/** Persistência do ContextFile e seus chunks (implementação real: prisma). */
export interface ContextFileStorePort {
  load(workspaceId: string, contextFileId: string): Promise<ContextFileRecord | null>;
  markProcessing(contextFileId: string): Promise<void>;
  markIndexed(contextFileId: string): Promise<void>;
  markError(contextFileId: string, error: string): Promise<void>;
  /** Substitui os chunks do arquivo; retorna os ids criados, na ordem. */
  replaceChunks(contextFileId: string, chunks: readonly IndexableChunk[]): Promise<string[]>;
  saveEmbedding(chunkId: string, vector: number[]): Promise<void>;
  logEvent(event: IngestEvent): Promise<void>;
}

/** Download binário do bucket (implementação real: SigV4 em services/storage). */
export interface ObjectStoragePort {
  getObject(storageKey: string): Promise<Uint8Array>;
}

export interface ContextIngestDeps {
  files: ContextFileStorePort;
  storage: ObjectStoragePort;
  extractPdfText(data: Uint8Array): Promise<string>;
  getEmbedder(workspaceId: string): Promise<Embedder | null>;
  notify(workspaceId: string, payload: Record<string, unknown>): Promise<void>;
  log: Log;
}

/** O index.ts passa só { log }; testes injetam todas as deps fake. */
export type ContextIngestOptions = { log: Log } & Partial<Omit<ContextIngestDeps, "log">>;

/** Lote máximo aceito pela API de embeddings por chamada. */
export const EMBED_BATCH_SIZE = 64;

/** Cria o processor da fila "context-ingest". */
export function createContextIngestProcessor(options: ContextIngestOptions): JobProcessor {
  let resolved: Promise<ContextIngestDeps> | undefined;
  const getDeps = (): Promise<ContextIngestDeps> => (resolved ??= resolveDeps(options));

  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case CONTEXT_INGEST_JOBS.ingestFile: {
        const payload = contextIngestJobSchema.parse(job.data);
        return ingestFile(await getDeps(), payload);
      }
      default:
        throw new NotImplementedYetError("context-ingest", job.name);
    }
  };
}

/** Falha que retry não resolve (arquivo vazio etc.) — marca ERROR e encerra. */
class NonRetryableIngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableIngestError";
  }
}

async function ingestFile(
  deps: ContextIngestDeps,
  payload: ContextIngestJobPayload,
): Promise<void> {
  const file = await deps.files.load(payload.workspaceId, payload.contextFileId);
  if (!file) {
    deps.log.warn(
      { workspaceId: payload.workspaceId, contextFileId: payload.contextFileId },
      "ContextFile não encontrado — ingestão ignorada",
    );
    return;
  }

  await deps.files.markProcessing(file.id);
  try {
    const text = await resolveText(deps, file);
    const chunks = toIndexableChunks(text);
    if (chunks.length === 0) {
      throw new NonRetryableIngestError("arquivo sem texto aproveitável para indexar");
    }

    const chunkIds = await deps.files.replaceChunks(file.id, chunks);
    const embedded = await embedChunks(deps, file.workspaceId, chunkIds, chunks);

    await deps.files.markIndexed(file.id);
    await deps.files.logEvent({
      workspaceId: file.workspaceId,
      contextFileId: file.id,
      type: "context.indexed",
      data: { chunks: chunks.length, embedded },
    });
    await deps.notify(file.workspaceId, {
      kind: "context_indexed",
      contextFileId: file.id,
      status: "INDEXED",
    });
    deps.log.info(
      { contextFileId: file.id, chunks: chunks.length, embedded },
      "ContextFile indexado",
    );
  } catch (error) {
    await registerFailureSafely(deps, file, error);
    // Falha esperada (conteúdo inservível) não gasta retries do BullMQ;
    // falha de rede/API é repropagada para retry.
    if (error instanceof NonRetryableIngestError) return;
    throw error;
  }
}

/** rawText direto ou download do bucket (PDF via extractor; senão UTF-8). */
async function resolveText(deps: ContextIngestDeps, file: ContextFileRecord): Promise<string> {
  const raw = file.rawText?.trim();
  if (raw) return raw;
  if (!file.storageKey) {
    throw new NonRetryableIngestError("ContextFile sem rawText e sem storageKey");
  }

  const bytes = await deps.storage.getObject(file.storageKey);
  if (isPdf(bytes)) return deps.extractPdfText(bytes);
  return Buffer.from(bytes).toString("utf8");
}

/** Gera e grava embeddings em lotes; sem credencial Voyage, deixa NULL. */
async function embedChunks(
  deps: ContextIngestDeps,
  workspaceId: string,
  chunkIds: readonly string[],
  chunks: readonly IndexableChunk[],
): Promise<number> {
  const embedder = await deps.getEmbedder(workspaceId);
  if (!embedder) {
    deps.log.info(
      { workspaceId },
      "workspace sem credencial VOYAGE — chunks sem embedding (busca full-text)",
    );
    return 0;
  }

  const entries = chunkIds.map((id, index) => ({
    id,
    content: chunks[index]?.content ?? "",
  }));

  let embedded = 0;
  for (const batch of splitInBatches(entries, EMBED_BATCH_SIZE)) {
    const vectors = await embedder.embed(batch.map((entry) => entry.content));
    for (const [index, entry] of batch.entries()) {
      const vector = vectors[index];
      if (!vector) continue;
      await deps.files.saveEmbedding(entry.id, vector);
      embedded += 1;
    }
  }
  return embedded;
}

/** Marca ERROR, registra evento e notifica sem mascarar o erro original. */
async function registerFailureSafely(
  deps: ContextIngestDeps,
  file: ContextFileRecord,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  deps.log.warn({ contextFileId: file.id, err: message }, "falha na ingestão do ContextFile");
  try {
    await deps.files.markError(file.id, message);
    await deps.files.logEvent({
      workspaceId: file.workspaceId,
      contextFileId: file.id,
      type: "context.ingest_failed",
      data: { error: message },
    });
    await deps.notify(file.workspaceId, {
      kind: "context_indexed",
      contextFileId: file.id,
      status: "ERROR",
    });
  } catch (secondary) {
    deps.log.error(
      {
        contextFileId: file.id,
        err: secondary instanceof Error ? secondary.message : String(secondary),
      },
      "falha ao registrar o erro da ingestão",
    );
  }
}

/** Chunks do texto com contagem aproximada de tokens (~4 chars/token). */
export function toIndexableChunks(text: string): IndexableChunk[] {
  return chunkText(text).map((content) => ({
    content,
    tokenCount: Math.max(1, Math.round(content.length / 4)),
  }));
}

/** Detecta PDF pelos magic bytes %PDF. */
export function isPdf(data: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46]; // %PDF
  return magic.every((byte, index) => data[index] === byte);
}

/** Divide em lotes de no máximo `size` itens, preservando a ordem. */
export function splitInBatches<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}

/** Resolve deps: usa as injetadas e completa faltantes com o wiring real. */
async function resolveDeps(options: ContextIngestOptions): Promise<ContextIngestDeps> {
  const { files, storage, extractPdfText, getEmbedder, notify } = options;
  if (files && storage && extractPdfText && getEmbedder && notify) {
    return { files, storage, extractPdfText, getEmbedder, notify, log: options.log };
  }
  // Import dinâmico: testes com deps completas nunca carregam prisma/redis/S3.
  const { createContextIngestWiring } = await import("./context-ingest.wiring.js");
  const wired = createContextIngestWiring();
  return {
    files: files ?? wired.files,
    storage: storage ?? wired.storage,
    extractPdfText: extractPdfText ?? wired.extractPdfText,
    getEmbedder: getEmbedder ?? wired.getEmbedder,
    notify: notify ?? wired.notify,
    log: options.log,
  };
}
