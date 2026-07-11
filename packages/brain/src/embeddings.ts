import { z } from "zod";

import { defaultFetch, safeJsonParse, type FetchLike } from "./http.js";

/**
 * Embeddings para RAG: interface injetável + implementação Voyage AI
 * e chunking de texto por parágrafos/frases com overlap.
 */

export interface Embedder {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
export const VOYAGE_MODEL = "voyage-3";
export const VOYAGE_DIMENSIONS = 1024;

/** Erro tipado da API da Voyage. */
export class VoyageApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "VoyageApiError";
    this.status = status;
  }
}

const voyageResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number(),
    }),
  ),
});

/** Embedder da Voyage AI (voyage-3, 1024 dims). Key por parâmetro, nunca de env. */
export class VoyageEmbedder implements Embedder {
  readonly dimensions = VOYAGE_DIMENSIONS;
  private readonly apiKey: string;
  private readonly fetchFn: FetchLike;

  constructor(apiKey: string, fetchFn: FetchLike = defaultFetch()) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.fetchFn(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: VOYAGE_MODEL, input: texts }),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new VoyageApiError(
        response.status,
        `API da Voyage respondeu status ${response.status}`,
      );
    }

    const parsed = voyageResponseSchema.safeParse(safeJsonParse(rawBody));
    if (!parsed.success) {
      throw new VoyageApiError(response.status, "Resposta da API da Voyage em formato inesperado");
    }

    // Garante a ordem de entrada mesmo se a API devolver fora de ordem.
    return parsed.data.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/** Aproximação de tokens: ~4 caracteres por token. */
const APPROX_CHARS_PER_TOKEN = 4;
const OVERLAP_TOKENS = 80;

/**
 * Divide texto em chunks de ~targetTokens, respeitando parágrafos e frases,
 * sem cortar palavra no meio e com overlap de ~80 tokens entre chunks
 * (para não perder contexto na borda). Chunks são unidos por espaço simples.
 */
export function chunkText(text: string, targetTokens = 800): string[] {
  const clean = text.trim();
  if (clean.length === 0) return [];

  const targetChars = Math.max(1, targetTokens) * APPROX_CHARS_PER_TOKEN;
  const overlapChars = Math.min(
    OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN,
    Math.floor(targetChars / 2),
  );
  if (clean.length <= targetChars) return [clean];

  const units = splitIntoUnits(clean, targetChars);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const append = (piece: string) => {
    currentLen = currentLen === 0 ? piece.length : currentLen + 1 + piece.length;
    current.push(piece);
  };

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join(" "));
    current = [];
    currentLen = 0;
  };

  for (const unit of units) {
    const projected = currentLen === 0 ? unit.length : currentLen + 1 + unit.length;
    if (currentLen > 0 && projected > targetChars) {
      const previous = current.join(" ");
      flush();
      const seed = overlapTail(previous, overlapChars);
      if (seed.length > 0) append(seed);
    }
    append(unit);
  }
  flush();

  return chunks;
}

/** Quebra o texto em unidades indivisíveis: parágrafos → frases → grupos de palavras. */
function splitIntoUnits(text: string, maxUnitChars: number): string[] {
  const units: string[] = [];
  for (const rawParagraph of text.split(/\n{2,}/)) {
    const paragraph = rawParagraph.trim();
    if (!paragraph) continue;
    if (paragraph.length <= maxUnitChars) {
      units.push(paragraph);
      continue;
    }
    for (const rawSentence of paragraph.split(/(?<=[.!?…])\s+/)) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      if (sentence.length <= maxUnitChars) {
        units.push(sentence);
        continue;
      }
      units.push(...splitByWords(sentence, maxUnitChars));
    }
  }
  return units;
}

/** Divide uma frase gigante em grupos de palavras de até maxUnitChars. */
function splitByWords(sentence: string, maxUnitChars: number): string[] {
  const parts: string[] = [];
  let buffer: string[] = [];
  let length = 0;

  for (const word of sentence.split(/\s+/)) {
    if (!word) continue;
    const projected = length === 0 ? word.length : length + 1 + word.length;
    if (length > 0 && projected > maxUnitChars) {
      parts.push(buffer.join(" "));
      buffer = [word];
      length = word.length;
      continue;
    }
    buffer.push(word);
    length = projected;
  }
  if (buffer.length > 0) parts.push(buffer.join(" "));
  return parts;
}

/** Cauda do chunk anterior (palavras inteiras) somando ~overlapChars. */
function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0) return "";
  const words = text.split(/\s+/);
  const tail: string[] = [];
  let length = 0;
  for (let i = words.length - 1; i >= 0 && length < overlapChars; i--) {
    const word = words[i];
    if (!word) continue;
    tail.unshift(word);
    length += word.length + 1;
  }
  return tail.join(" ");
}
