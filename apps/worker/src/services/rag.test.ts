import type { Prisma } from "@sales4u/db";
import { describe, expect, it } from "vitest";

import {
  extractSearchTerms,
  getDesignSystemMd,
  retrieveContext,
  vectorLiteral,
  type ContextSnippet,
  type CriticalContextFile,
  type RagDeps,
} from "./rag.js";

/** Deps fake: responde cada consulta conforme o SQL recebido. */
function makeDeps(config: {
  embedderVector?: number[];
  embedFailure?: Error;
  criticalFiles?: CriticalContextFile[];
  rowsBySql?: (sql: Prisma.Sql) => ContextSnippet[];
  designSystemText?: string | null;
}): { deps: RagDeps; executed: Prisma.Sql[] } {
  const executed: Prisma.Sql[] = [];
  const deps: RagDeps = {
    getEmbedder: async () => {
      if (!config.embedderVector && !config.embedFailure) return null;
      return {
        dimensions: 3,
        embed: async () => {
          if (config.embedFailure) throw config.embedFailure;
          return [config.embedderVector ?? []];
        },
      };
    },
    searchChunks: async (sql) => {
      executed.push(sql);
      return config.rowsBySql?.(sql) ?? [];
    },
    findCriticalFiles: async () => config.criticalFiles ?? [],
    findDesignSystemText: async () => config.designSystemText ?? null,
  };
  return { deps, executed };
}

describe("retrieveContext", () => {
  it("sem Voyage: usa full-text e prefixa os arquivos críticos de preço/objeções", async () => {
    const { deps, executed } = makeDeps({
      criticalFiles: [
        { name: "precos.md", type: "PRICING", rawText: "Plano Pro: R$ 197/mês" },
        { name: "objecoes.md", type: "OBJECTIONS", rawText: "Caro? Compare com o retorno." },
      ],
      rowsBySql: (sql) =>
        sql.sql.includes("plainto_tsquery")
          ? [{ content: "detalhes do plano pro", source: "faq.md" }]
          : [],
    });

    const result = await retrieveContext("ws_1", "quanto custa o plano", 4, deps);

    expect(result).toEqual([
      { content: "[PRICING] Plano Pro: R$ 197/mês", source: "precos.md" },
      { content: "[OBJECTIONS] Caro? Compare com o retorno.", source: "objecoes.md" },
      { content: "detalhes do plano pro", source: "faq.md" },
    ]);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.values).toContain("ws_1");
  });

  it("full-text vazio → tenta ILIKE por termos → último recurso: chunks recentes", async () => {
    const { deps, executed } = makeDeps({
      rowsBySql: (sql) =>
        sql.sql.includes('ORDER BY c."createdAt" DESC')
          ? [{ content: "conteúdo mais recente", source: "base.md" }]
          : [],
    });

    const result = await retrieveContext("ws_1", "consultoria premium", 6, deps);

    expect(result).toEqual([{ content: "conteúdo mais recente", source: "base.md" }]);
    expect(executed.map((sql) => kindOf(sql))).toEqual(["fulltext", "ilike", "latest"]);
    expect(executed[1]?.values).toContain("%consultoria%");
  });

  it("com Voyage: busca por similaridade pgvector com o vetor da query", async () => {
    const { deps, executed } = makeDeps({
      embedderVector: [0.1, 0.2, 0.3],
      rowsBySql: (sql) =>
        sql.sql.includes("<=>") ? [{ content: "trecho similar", source: "guia.pdf" }] : [],
    });

    const result = await retrieveContext("ws_1", "como funciona", 2, deps);

    expect(result).toEqual([{ content: "trecho similar", source: "guia.pdf" }]);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.sql).toContain("c.embedding <=>");
    expect(executed[0]?.values).toContain("[0.1,0.2,0.3]");
  });

  it("Voyage fora do ar: degrada para busca textual sem falhar", async () => {
    const { deps, executed } = makeDeps({
      embedFailure: new Error("voyage 503"),
      rowsBySql: (sql) =>
        sql.sql.includes("plainto_tsquery")
          ? [{ content: "achado por texto", source: "faq.md" }]
          : [],
    });

    const result = await retrieveContext("ws_1", "garantia do produto", 6, deps);

    expect(result).toEqual([{ content: "achado por texto", source: "faq.md" }]);
    expect(executed.every((sql) => !sql.sql.includes("<=>"))).toBe(true);
  });

  it("trunca rawText crítico longo em ~800 caracteres", async () => {
    const longo = "x".repeat(2000);
    const { deps } = makeDeps({
      criticalFiles: [{ name: "precos.md", type: "PRICING", rawText: longo }],
    });

    const [snippet] = await retrieveContext("ws_1", "preço", 6, deps);

    expect(snippet).toBeDefined();
    expect(snippet?.content.length).toBeLessThanOrEqual("[PRICING] ".length + 801);
    expect(snippet?.content.endsWith("…")).toBe(true);
  });

  it("ignora arquivos críticos sem rawText", async () => {
    const { deps } = makeDeps({
      criticalFiles: [{ name: "vazio.md", type: "PRICING", rawText: "   " }],
    });

    const result = await retrieveContext("ws_1", "preço", 6, deps);

    expect(result).toEqual([]);
  });
});

describe("getDesignSystemMd", () => {
  it("retorna o rawText do DESIGN_SYSTEM mais recente, ou null", async () => {
    const { deps } = makeDeps({ designSystemText: "# Design System" });
    expect(await getDesignSystemMd("ws_1", deps)).toBe("# Design System");

    const { deps: semArquivo } = makeDeps({});
    expect(await getDesignSystemMd("ws_1", semArquivo)).toBeNull();
  });
});

describe("vectorLiteral", () => {
  it("serializa no formato pgvector", () => {
    expect(vectorLiteral([1, 2.5, -3])).toBe("[1,2.5,-3]");
  });
});

describe("extractSearchTerms", () => {
  it("filtra palavras curtas, deduplica e escapa curingas do LIKE", () => {
    expect(extractSearchTerms("o plano PLANO pro é 100% top_demais")).toEqual([
      "plano",
      "pro",
      "100",
      "top",
      "demais",
    ]);
    expect(extractSearchTerms("50%_off")).toEqual(["off"]);
  });
});

function kindOf(sql: Prisma.Sql): string {
  if (sql.sql.includes("plainto_tsquery")) return "fulltext";
  if (sql.sql.includes("ILIKE")) return "ilike";
  if (sql.sql.includes('ORDER BY c."createdAt" DESC')) return "latest";
  return "outro";
}
