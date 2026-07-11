import { describe, expect, it } from "vitest";

import { chunkText, VoyageApiError, VoyageEmbedder, VOYAGE_API_URL } from "./embeddings.js";
import type { FetchLike, FetchRequestInit } from "./http.js";

// ---------------------------------------------------------------------------
// chunkText
// ---------------------------------------------------------------------------

/** Gera texto longo com palavras únicas (facilita verificar overlap sem falso positivo). */
function buildLongText(sentences: number, wordsPerSentence = 8): string {
  const parts: string[] = [];
  let counter = 0;
  for (let s = 0; s < sentences; s++) {
    const words: string[] = [];
    for (let w = 0; w < wordsPerSentence; w++) {
      counter += 1;
      words.push(`palavra${counter.toString().padStart(5, "0")}`);
    }
    parts.push(`${words.join(" ")}.`);
  }
  return parts.join(" ");
}

describe("chunkText", () => {
  it("texto curto vira um único chunk", () => {
    expect(chunkText("Um parágrafo curto.")).toEqual(["Um parágrafo curto."]);
  });

  it("texto vazio vira lista vazia", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("texto longo gera chunks perto do alvo", () => {
    const targetTokens = 200; // 800 chars
    const text = buildLongText(120); // ~12k chars
    const chunks = chunkText(text, targetTokens);

    expect(chunks.length).toBeGreaterThan(3);
    const maxChars = targetTokens * 4;
    for (const chunk of chunks) {
      // Alvo aproximado: tolera o overlap somado no início do chunk.
      expect(chunk.length).toBeLessThanOrEqual(maxChars * 1.2);
      expect(chunk.trim()).toBe(chunk);
    }
  });

  it("não corta palavra no meio", () => {
    const text = buildLongText(120);
    const sourceWords = new Set(text.split(/\s+/));
    const chunks = chunkText(text, 200);
    for (const chunk of chunks) {
      for (const word of chunk.split(/\s+/)) {
        expect(sourceWords.has(word)).toBe(true);
      }
    }
  });

  it("chunks consecutivos têm overlap", () => {
    const text = buildLongText(120);
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const head = chunks[i]!.slice(0, 60);
      expect(chunks[i - 1]!.includes(head)).toBe(true);
    }
  });

  it("respeita parágrafos quando cabem no alvo", () => {
    const p1 = "Primeiro parágrafo com conteúdo suficiente para o teste.";
    const p2 = "Segundo parágrafo igualmente pequeno.";
    const chunks = chunkText(`${p1}\n\n${p2}`, 800);
    expect(chunks).toEqual([`${p1}\n\n${p2}`.trim()]);
  });

  it("usa o default de 800 tokens sem quebrar", () => {
    const chunks = chunkText(buildLongText(500));
    expect(chunks.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// VoyageEmbedder
// ---------------------------------------------------------------------------

interface CapturedCall {
  url: string;
  init: FetchRequestInit;
}

function makeFetchMock(status: number, body: unknown): { fetchFn: FetchLike; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const fetchFn: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  };
  return { fetchFn, calls };
}

describe("VoyageEmbedder", () => {
  it("tem 1024 dimensões", () => {
    const embedder = new VoyageEmbedder("vk-teste", makeFetchMock(200, { data: [] }).fetchFn);
    expect(embedder.dimensions).toBe(1024);
  });

  it("envia model voyage-3 com Bearer e devolve embeddings na ordem de entrada", async () => {
    const { fetchFn, calls } = makeFetchMock(200, {
      data: [
        { embedding: [0.3, 0.4], index: 1 },
        { embedding: [0.1, 0.2], index: 0 },
      ],
    });
    const embedder = new VoyageEmbedder("vk-teste", fetchFn);
    const result = await embedder.embed(["primeiro", "segundo"]);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(VOYAGE_API_URL);
    expect(call.init.headers.authorization).toBe("Bearer vk-teste");
    const body = JSON.parse(call.init.body) as Record<string, unknown>;
    expect(body.model).toBe("voyage-3");
    expect(body.input).toEqual(["primeiro", "segundo"]);

    // Ordena por index mesmo que a API devolva fora de ordem.
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it("lista vazia não chama a rede", async () => {
    const { fetchFn, calls } = makeFetchMock(200, { data: [] });
    const embedder = new VoyageEmbedder("vk", fetchFn);
    expect(await embedder.embed([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("erro HTTP vira VoyageApiError com status", async () => {
    const { fetchFn } = makeFetchMock(401, { detail: "unauthorized" });
    const embedder = new VoyageEmbedder("vk-invalida", fetchFn);
    const failure = embedder.embed(["texto"]);
    await expect(failure).rejects.toBeInstanceOf(VoyageApiError);
    await expect(failure).rejects.toMatchObject({ status: 401 });
  });
});
