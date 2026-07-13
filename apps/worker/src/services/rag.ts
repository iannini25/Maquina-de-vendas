import type { Embedder } from "@sales4u/brain";
import { Prisma, prisma } from "@sales4u/db";

import type { Log } from "../types.js";
import { getWorkspaceEmbedder } from "./credentials.js";

/**
 * Recuperação de contexto (RAG) por workspace.
 * Ordem de busca: similaridade pgvector (credencial VOYAGE) → full-text
 * 'portuguese' → ILIKE por termos → últimos chunks INDEXED (último recurso).
 * PRICING e OBJECTIONS entram SEMPRE, prefixados — a IA nunca alucina preço.
 */

export interface ContextSnippet {
  content: string;
  source: string;
}

export interface CriticalContextFile {
  name: string;
  type: string;
  rawText: string | null;
}

/** Dependências injetáveis (testes usam fakes; produção usa o default prisma). */
export interface RagDeps {
  getEmbedder(workspaceId: string): Promise<Embedder | null>;
  searchChunks(sql: Prisma.Sql): Promise<ContextSnippet[]>;
  findCriticalFiles(workspaceId: string): Promise<CriticalContextFile[]>;
  findDesignSystemText(workspaceId: string): Promise<string | null>;
  log?: Log;
}

const CRITICAL_TYPES = ["PRICING", "OBJECTIONS"] as const;
/** Tamanho máximo do trecho crítico embutido (≈200 tokens). */
const CRITICAL_SNIPPET_MAX_CHARS = 800;

/**
 * Busca os k trechos mais relevantes para a query no contexto do workspace,
 * sempre precedidos dos arquivos críticos (preço/objeções) truncados.
 */
export async function retrieveContext(
  workspaceId: string,
  query: string,
  k = 6,
  deps: RagDeps = defaultRagDeps(),
): Promise<ContextSnippet[]> {
  const [critical, relevant] = await Promise.all([
    loadCriticalSnippets(deps, workspaceId),
    findRelevantChunks(deps, workspaceId, query, k),
  ]);
  return [...critical, ...relevant];
}

/** rawText do ContextFile DESIGN_SYSTEM INDEXED mais recente, ou null. */
export async function getDesignSystemMd(
  workspaceId: string,
  deps: RagDeps = defaultRagDeps(),
): Promise<string | null> {
  return deps.findDesignSystemText(workspaceId);
}

/** Serializa um vetor no literal aceito pelo pgvector: "[0.1,0.2,...]". */
export function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

/** Termos de busca para o fallback ILIKE: palavras ≥ 3 letras, sem repetição. */
export function extractSearchTerms(query: string, maxTerms = 5): string[] {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const unique = [...new Set(words.filter((word) => word.length >= 3))];
  return unique.slice(0, maxTerms).map(escapeLikeTerm);
}

// ---------------------------------------------------------------------------
// Estratégias de busca
// ---------------------------------------------------------------------------

async function findRelevantChunks(
  deps: RagDeps,
  workspaceId: string,
  query: string,
  k: number,
): Promise<ContextSnippet[]> {
  const bySimilarity = await searchBySimilarity(deps, workspaceId, query, k);
  if (bySimilarity) return bySimilarity;
  return searchByText(deps, workspaceId, query, k);
}

/** Busca vetorial; null quando não há embedder ou a Voyage falhou (degrada). */
async function searchBySimilarity(
  deps: RagDeps,
  workspaceId: string,
  query: string,
  k: number,
): Promise<ContextSnippet[] | null> {
  const embedder = await deps.getEmbedder(workspaceId);
  if (!embedder) return null;
  try {
    const [vector] = await embedder.embed([query]);
    if (!vector) return null;
    return await deps.searchChunks(similaritySql(workspaceId, vector, k));
  } catch (error) {
    deps.log?.warn(
      { workspaceId, err: error instanceof Error ? error.message : String(error) },
      "embedding da query falhou — degradando para busca textual",
    );
    return null;
  }
}

async function searchByText(
  deps: RagDeps,
  workspaceId: string,
  query: string,
  k: number,
): Promise<ContextSnippet[]> {
  const byFullText = await deps.searchChunks(fullTextSql(workspaceId, query, k));
  if (byFullText.length > 0) return byFullText;

  const terms = extractSearchTerms(query);
  if (terms.length > 0) {
    const byTerms = await deps.searchChunks(ilikeSql(workspaceId, terms, k));
    if (byTerms.length > 0) return byTerms;
  }

  // Último recurso: se existem chunks INDEXED, devolve os mais recentes.
  return deps.searchChunks(latestChunksSql(workspaceId, k));
}

async function loadCriticalSnippets(
  deps: RagDeps,
  workspaceId: string,
): Promise<ContextSnippet[]> {
  const files = await deps.findCriticalFiles(workspaceId);
  const snippets: ContextSnippet[] = [];
  for (const file of files) {
    const text = file.rawText?.trim();
    if (!text) continue;
    snippets.push({
      content: `[${file.type}] ${truncate(text, CRITICAL_SNIPPET_MAX_CHARS)}`,
      source: file.name,
    });
  }
  return snippets;
}

// ---------------------------------------------------------------------------
// SQL (pgvector + full-text + fallbacks)
// ---------------------------------------------------------------------------

const CHUNK_BASE = Prisma.sql`
  SELECT c.content AS content, f.name AS source
  FROM "ContextChunk" c
  JOIN "ContextFile" f ON f.id = c."contextFileId"
`;

function similaritySql(workspaceId: string, vector: readonly number[], k: number): Prisma.Sql {
  return Prisma.sql`${CHUNK_BASE}
    WHERE f."workspaceId" = ${workspaceId} AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorLiteral(vector)}::vector
    LIMIT ${k}`;
}

function fullTextSql(workspaceId: string, query: string, k: number): Prisma.Sql {
  return Prisma.sql`${CHUNK_BASE}
    WHERE f."workspaceId" = ${workspaceId} AND f.status = 'INDEXED'
      AND to_tsvector('portuguese', c.content) @@ plainto_tsquery('portuguese', ${query})
    ORDER BY ts_rank(to_tsvector('portuguese', c.content), plainto_tsquery('portuguese', ${query})) DESC
    LIMIT ${k}`;
}

function ilikeSql(workspaceId: string, terms: readonly string[], k: number): Prisma.Sql {
  const conditions = Prisma.join(
    terms.map((term) => Prisma.sql`c.content ILIKE ${`%${term}%`}`),
    " OR ",
  );
  return Prisma.sql`${CHUNK_BASE}
    WHERE f."workspaceId" = ${workspaceId} AND f.status = 'INDEXED' AND (${conditions})
    LIMIT ${k}`;
}

function latestChunksSql(workspaceId: string, k: number): Prisma.Sql {
  return Prisma.sql`${CHUNK_BASE}
    WHERE f."workspaceId" = ${workspaceId} AND f.status = 'INDEXED'
    ORDER BY c."createdAt" DESC
    LIMIT ${k}`;
}

// ---------------------------------------------------------------------------
// Deps reais (prisma) e utilitários
// ---------------------------------------------------------------------------

function defaultRagDeps(): RagDeps {
  return {
    getEmbedder: getWorkspaceEmbedder,
    searchChunks: (sql) => prisma.$queryRaw<ContextSnippet[]>(sql),
    findCriticalFiles: (workspaceId) =>
      prisma.contextFile.findMany({
        where: { workspaceId, type: { in: [...CRITICAL_TYPES] }, rawText: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { name: true, type: true, rawText: true },
      }),
    findDesignSystemText: async (workspaceId) => {
      const file = await prisma.contextFile.findFirst({
        where: {
          workspaceId,
          type: "DESIGN_SYSTEM",
          status: "INDEXED",
          rawText: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        select: { rawText: true },
      });
      return file?.rawText ?? null;
    },
  };
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

/** Escapa curingas do LIKE dentro do termo (%, _ e a própria barra). */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
