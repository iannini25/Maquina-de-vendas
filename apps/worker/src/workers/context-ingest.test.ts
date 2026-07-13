import type { Embedder } from "@sales4u/brain";
import { describe, expect, it } from "vitest";

import { NotImplementedYetError } from "../errors.js";
import type { Log } from "../types.js";
import {
  createContextIngestProcessor,
  EMBED_BATCH_SIZE,
  isPdf,
  splitInBatches,
  toIndexableChunks,
  type ContextFileRecord,
  type ContextFileStorePort,
  type ContextIngestDeps,
  type IndexableChunk,
  type IngestEvent,
} from "./context-ingest.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

const baseFile: ContextFileRecord = {
  id: "cf_1",
  workspaceId: "ws_1",
  name: "faq.md",
  rawText: "Pergunta: como funciona? Resposta: assim.",
  storageKey: null,
};

interface StoreCalls {
  statuses: string[];
  errors: string[];
  replaced: IndexableChunk[][];
  embeddings: Array<{ chunkId: string; dims: number }>;
  events: IngestEvent[];
}

function makeFakeStore(file: ContextFileRecord | null): {
  store: ContextFileStorePort;
  calls: StoreCalls;
} {
  const calls: StoreCalls = { statuses: [], errors: [], replaced: [], embeddings: [], events: [] };
  const store: ContextFileStorePort = {
    load: async () => file,
    markProcessing: async () => {
      calls.statuses.push("PROCESSING");
    },
    markIndexed: async () => {
      calls.statuses.push("INDEXED");
    },
    markError: async (_id, error) => {
      calls.statuses.push("ERROR");
      calls.errors.push(error);
    },
    replaceChunks: async (_id, chunks) => {
      calls.replaced.push([...chunks]);
      return chunks.map((_, index) => `chunk_${index}`);
    },
    saveEmbedding: async (chunkId, vector) => {
      calls.embeddings.push({ chunkId, dims: vector.length });
    },
    logEvent: async (event) => {
      calls.events.push(event);
    },
  };
  return { store, calls };
}

function makeFakeEmbedder(): { embedder: Embedder; batches: number[] } {
  const batches: number[] = [];
  return {
    batches,
    embedder: {
      dimensions: 3,
      embed: async (texts) => {
        batches.push(texts.length);
        return texts.map(() => [0.1, 0.2, 0.3]);
      },
    },
  };
}

interface Notified {
  workspaceId: string;
  payload: Record<string, unknown>;
}

function makeDeps(
  file: ContextFileRecord | null,
  overrides: Partial<ContextIngestDeps> = {},
): { deps: ContextIngestDeps; calls: StoreCalls; notified: Notified[] } {
  const { store, calls } = makeFakeStore(file);
  const notified: Notified[] = [];
  return {
    calls,
    notified,
    deps: {
      files: store,
      storage: {
        getObject: async () => {
          throw new Error("storage não deveria ser chamado neste teste");
        },
      },
      extractPdfText: async () => {
        throw new Error("extractPdfText não deveria ser chamado neste teste");
      },
      getEmbedder: async () => null,
      notify: async (workspaceId, payload) => {
        notified.push({ workspaceId, payload });
      },
      log: silentLog,
      ...overrides,
    },
  };
}

const job = { name: "ingest-file", data: { workspaceId: "ws_1", contextFileId: "cf_1" } };

describe("createContextIngestProcessor", () => {
  it("indexa rawText: chunking, embeddings e status PROCESSING → INDEXED", async () => {
    const { embedder } = makeFakeEmbedder();
    const { deps, calls, notified } = makeDeps(baseFile, { getEmbedder: async () => embedder });

    await createContextIngestProcessor(deps)(job);

    expect(calls.statuses).toEqual(["PROCESSING", "INDEXED"]);
    expect(calls.replaced).toHaveLength(1);
    expect(calls.replaced[0]?.[0]?.content).toContain("como funciona?");
    expect(calls.replaced[0]?.[0]?.tokenCount).toBeGreaterThan(0);
    expect(calls.embeddings).toEqual([{ chunkId: "chunk_0", dims: 3 }]);
    expect(calls.events).toMatchObject([{ type: "context.indexed", contextFileId: "cf_1" }]);
    expect(notified).toEqual([
      {
        workspaceId: "ws_1",
        payload: { kind: "context_indexed", contextFileId: "cf_1", status: "INDEXED" },
      },
    ]);
  });

  it("sem credencial Voyage: indexa mesmo assim, deixando embeddings NULL", async () => {
    const { deps, calls } = makeDeps(baseFile);

    await createContextIngestProcessor(deps)(job);

    expect(calls.statuses).toEqual(["PROCESSING", "INDEXED"]);
    expect(calls.embeddings).toEqual([]);
    expect(calls.events[0]?.data).toMatchObject({ embedded: 0 });
  });

  it("arquivo inexistente: encerra sem relançar e sem tocar em status", async () => {
    const { deps, calls, notified } = makeDeps(null);

    await expect(createContextIngestProcessor(deps)(job)).resolves.toBeUndefined();

    expect(calls.statuses).toEqual([]);
    expect(notified).toEqual([]);
  });

  it("PDF do bucket: detecta magic bytes e usa o extrator", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const file = { ...baseFile, rawText: null, storageKey: "context/guia.pdf" };
    const fetched: string[] = [];
    const { deps, calls } = makeDeps(file, {
      storage: {
        getObject: async (key) => {
          fetched.push(key);
          return pdfBytes;
        },
      },
      extractPdfText: async () => "Texto extraído do PDF sobre a oferta.",
    });

    await createContextIngestProcessor(deps)(job);

    expect(fetched).toEqual(["context/guia.pdf"]);
    expect(calls.replaced[0]?.[0]?.content).toBe("Texto extraído do PDF sobre a oferta.");
    expect(calls.statuses).toEqual(["PROCESSING", "INDEXED"]);
  });

  it("arquivo texto do bucket: decodifica UTF-8", async () => {
    const file = { ...baseFile, rawText: null, storageKey: "context/notas.txt" };
    const { deps, calls } = makeDeps(file, {
      storage: { getObject: async () => Buffer.from("Notas de preço em ação", "utf8") },
    });

    await createContextIngestProcessor(deps)(job);

    expect(calls.replaced[0]?.[0]?.content).toBe("Notas de preço em ação");
  });

  it("sem rawText e sem storageKey: marca ERROR e NÃO relança (retry inútil)", async () => {
    const file = { ...baseFile, rawText: null, storageKey: null };
    const { deps, calls, notified } = makeDeps(file);

    await expect(createContextIngestProcessor(deps)(job)).resolves.toBeUndefined();

    expect(calls.statuses).toEqual(["PROCESSING", "ERROR"]);
    expect(calls.errors[0]).toContain("sem rawText e sem storageKey");
    expect(calls.events).toMatchObject([{ type: "context.ingest_failed" }]);
    expect(notified[0]?.payload).toMatchObject({ status: "ERROR" });
  });

  it("falha de rede no storage: marca ERROR, notifica e relança para retry", async () => {
    const file = { ...baseFile, rawText: null, storageKey: "context/guia.pdf" };
    const { deps, calls, notified } = makeDeps(file, {
      storage: {
        getObject: async () => {
          throw new Error("minio fora do ar");
        },
      },
    });

    await expect(createContextIngestProcessor(deps)(job)).rejects.toThrowError(
      "minio fora do ar",
    );

    expect(calls.statuses).toEqual(["PROCESSING", "ERROR"]);
    expect(calls.errors).toEqual(["minio fora do ar"]);
    expect(notified[0]?.payload).toMatchObject({ status: "ERROR" });
  });

  it("preserva o erro original mesmo se markError também falhar", async () => {
    const file = { ...baseFile, rawText: null, storageKey: "context/x.txt" };
    const { deps } = makeDeps(file, {
      storage: {
        getObject: async () => {
          throw new Error("erro original");
        },
      },
    });
    deps.files.markError = async () => {
      throw new Error("banco caiu");
    };

    await expect(createContextIngestProcessor(deps)(job)).rejects.toThrowError("erro original");
  });

  it("rejeita payload inválido antes de tocar nas deps", async () => {
    const { deps, calls } = makeDeps(baseFile);

    await expect(
      createContextIngestProcessor(deps)({ name: "ingest-file", data: { workspaceId: "ws" } }),
    ).rejects.toThrowError();
    expect(calls.statuses).toEqual([]);
  });

  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { deps } = makeDeps(baseFile);

    await expect(
      createContextIngestProcessor(deps)({ name: "reindex-all", data: {} }),
    ).rejects.toBeInstanceOf(NotImplementedYetError);
  });
});

describe("helpers puros", () => {
  it("isPdf reconhece os magic bytes %PDF", () => {
    expect(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(isPdf(Buffer.from("texto puro", "utf8"))).toBe(false);
    expect(isPdf(new Uint8Array([]))).toBe(false);
  });

  it("splitInBatches respeita o tamanho máximo e preserva a ordem", () => {
    const items = Array.from({ length: EMBED_BATCH_SIZE + 3 }, (_, index) => index);
    const batches = splitInBatches(items, EMBED_BATCH_SIZE);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(EMBED_BATCH_SIZE);
    expect(batches[1]).toEqual([EMBED_BATCH_SIZE, EMBED_BATCH_SIZE + 1, EMBED_BATCH_SIZE + 2]);
  });

  it("toIndexableChunks estima tokens em ~len/4", () => {
    const [chunk] = toIndexableChunks("a".repeat(400));

    expect(chunk).toBeDefined();
    expect(chunk?.tokenCount).toBe(100);
  });
});
