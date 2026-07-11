import { resolveModel, type LlmClient, type LlmRequest } from "@vendaflow/brain";
import { describe, expect, it } from "vitest";

import { NotImplementedYetError } from "../errors.js";
import type { Log } from "../types.js";
import {
  buildFunnelMetrics,
  buildLocalInsight,
  createAnalystProcessor,
  findBottleneck,
  resolveReportWindow,
  type AiUsageSample,
  type AnalystDeps,
  type CollectedMetrics,
  type FunnelMetrics,
  type StageCount,
} from "./analyst.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

function stage(name: string, order: number, leadCount: number, systemKey: string | null = null): StageCount {
  return { stageId: `st_${order}`, name, order, systemKey, leadCount };
}

const baseCollected: CollectedMetrics = {
  leadsCreated: 12,
  stages: [
    stage("Novo lead", 0, 10, "NEW"),
    stage("Em conversa", 1, 8),
    stage("Qualificado", 2, 2),
    stage("Ganho", 3, 1, "WON"),
    stage("Perdido", 4, 20, "LOST"),
  ],
  conversationsContacted: 10,
  conversationsReplied: 4,
  ordersCount: 1,
  revenueCents: 19700,
  cadencesExhausted: 3,
};

interface Saved {
  workspaceId: string;
  insight: string;
  metrics: FunnelMetrics;
}

interface Notified {
  workspaceId: string;
  payload: Record<string, unknown>;
}

function makeDeps(overrides: Partial<AnalystDeps> = {}): {
  deps: AnalystDeps;
  saved: Saved[];
  notified: Notified[];
  usages: AiUsageSample[];
} {
  const saved: Saved[] = [];
  const notified: Notified[] = [];
  const usages: AiUsageSample[] = [];
  return {
    saved,
    notified,
    usages,
    deps: {
      listWorkspaceIds: async () => ["ws_1"],
      collectMetrics: async () => baseCollected,
      getLlm: async () => null,
      recordUsage: async (usage) => {
        usages.push(usage);
      },
      saveInsight: async (workspaceId, insight, metrics) => {
        saved.push({ workspaceId, insight, metrics });
      },
      notify: async (workspaceId, payload) => {
        notified.push({ workspaceId, payload });
      },
      now: () => new Date("2026-07-11T09:00:00.000Z"),
      log: silentLog,
      ...overrides,
    },
  };
}

function makeFakeLlm(text: string | undefined): { llm: LlmClient; requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  return {
    requests,
    llm: {
      complete: async (request) => {
        requests.push(request);
        return { text, usage: { inputTokens: 120, outputTokens: 40 } };
      },
    },
  };
}

const job = { name: "daily-report", data: {} };

describe("createAnalystProcessor", () => {
  it("sem credencial ANTHROPIC: grava insight determinístico local e notifica", async () => {
    const { deps, saved, notified, usages } = makeDeps();

    await createAnalystProcessor(deps)(job);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.workspaceId).toBe("ws_1");
    expect(saved[0]?.insight).toBe(buildLocalInsight(saved[0]!.metrics));
    expect(saved[0]?.metrics.date).toBe("2026-07-10");
    expect(saved[0]?.metrics.bottleneck).toEqual({
      fromStage: "Em conversa",
      toStage: "Qualificado",
      dropRate: 0.75,
    });
    expect(notified[0]?.payload).toMatchObject({ kind: "analyst_insight", date: "2026-07-10" });
    expect(usages).toEqual([]);
  });

  it("com LLM: usa o modelo classifier, grava o insight e registra o uso", async () => {
    const { llm, requests } = makeFakeLlm("  Foque em destravar Qualificado hoje.  ");
    const { deps, saved, usages } = makeDeps({ getLlm: async () => llm });

    await createAnalystProcessor(deps)(job);

    expect(requests[0]?.model).toBe(resolveModel("classifier"));
    expect(requests[0]?.messages[0]?.content).toContain("Leads criados: 12");
    expect(saved[0]?.insight).toBe("Foque em destravar Qualificado hoje.");
    expect(usages).toEqual([
      {
        workspaceId: "ws_1",
        model: resolveModel("classifier"),
        inputTokens: 120,
        outputTokens: 40,
      },
    ]);
  });

  it("LLM devolve texto vazio: cai no insight local", async () => {
    const { llm } = makeFakeLlm(undefined);
    const { deps, saved } = makeDeps({ getLlm: async () => llm });

    await createAnalystProcessor(deps)(job);

    expect(saved[0]?.insight).toBe(buildLocalInsight(saved[0]!.metrics));
  });

  it("sem workspaceId no payload: processa todos os workspaces", async () => {
    const { deps, saved } = makeDeps({ listWorkspaceIds: async () => ["ws_a", "ws_b"] });

    await createAnalystProcessor(deps)(job);

    expect(saved.map((item) => item.workspaceId)).toEqual(["ws_a", "ws_b"]);
  });

  it("usa a data do payload como janela de referência", async () => {
    const windows: string[] = [];
    const { deps } = makeDeps({
      collectMetrics: async (_ws, window) => {
        windows.push(`${window.start.toISOString()}..${window.end.toISOString()}`);
        return baseCollected;
      },
    });

    await createAnalystProcessor(deps)({ name: "daily-report", data: { date: "2026-07-01" } });

    expect(windows).toEqual(["2026-07-01T00:00:00.000Z..2026-07-02T00:00:00.000Z"]);
  });

  it("workspace inexistente no payload: encerra sem gravar nada e sem relançar", async () => {
    const { deps, saved } = makeDeps();

    await expect(
      createAnalystProcessor(deps)({ name: "daily-report", data: { workspaceId: "ws_x" } }),
    ).resolves.toBeUndefined();
    expect(saved).toEqual([]);
  });

  it("falha de API em um workspace: processa os demais e relança no fim", async () => {
    const { llm } = makeFakeLlm("Insight ok.");
    const { deps, saved } = makeDeps({
      listWorkspaceIds: async () => ["ws_ruim", "ws_bom"],
      getLlm: async (workspaceId) => {
        if (workspaceId === "ws_ruim") throw new Error("anthropic 529");
        return llm;
      },
    });

    await expect(createAnalystProcessor(deps)(job)).rejects.toThrowError(
      "relatório do analista falhou para: ws_ruim",
    );
    expect(saved.map((item) => item.workspaceId)).toEqual(["ws_bom"]);
  });

  it("rejeita payload inválido", async () => {
    const { deps } = makeDeps();

    await expect(
      createAnalystProcessor(deps)({ name: "daily-report", data: { date: "10-07-2026" } }),
    ).rejects.toThrowError();
  });

  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { deps } = makeDeps();

    await expect(
      createAnalystProcessor(deps)({ name: "weekly-report", data: {} }),
    ).rejects.toBeInstanceOf(NotImplementedYetError);
  });
});

describe("resolveReportWindow", () => {
  it("com data explícita: janela UTC de 24h daquele dia", () => {
    const window = resolveReportWindow("2026-07-10", new Date("2026-07-11T15:00:00.000Z"));

    expect(window.date).toBe("2026-07-10");
    expect(window.start.toISOString()).toBe("2026-07-10T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-07-11T00:00:00.000Z");
  });

  it("sem data: usa ontem (UTC)", () => {
    const window = resolveReportWindow(undefined, new Date("2026-07-11T00:30:00.000Z"));

    expect(window.date).toBe("2026-07-10");
  });
});

describe("findBottleneck", () => {
  it("aponta o par consecutivo com maior queda, ignorando Perdido", () => {
    expect(findBottleneck(baseCollected.stages)).toEqual({
      fromStage: "Em conversa",
      toStage: "Qualificado",
      dropRate: 0.75,
    });
  });

  it("retorna null quando não há queda", () => {
    expect(
      findBottleneck([stage("Novo", 0, 2, "NEW"), stage("Conversa", 1, 5)]),
    ).toBeNull();
    expect(findBottleneck([])).toBeNull();
  });
});

describe("buildFunnelMetrics", () => {
  it("consolida taxa de resposta e distribuição ordenada por estágio", () => {
    const metrics = buildFunnelMetrics("2026-07-10", baseCollected);

    expect(metrics.responseRate).toBe(0.4);
    expect(metrics.stageDistribution[0]).toEqual({ stage: "Novo lead", leads: 10 });
    expect(metrics.revenueCents).toBe(19700);
  });

  it("taxa de resposta é 0 sem conversas contatadas", () => {
    const metrics = buildFunnelMetrics("2026-07-10", {
      ...baseCollected,
      conversationsContacted: 0,
      conversationsReplied: 0,
    });

    expect(metrics.responseRate).toBe(0);
  });
});

describe("buildLocalInsight", () => {
  it("prioriza o gargalo quando existe", () => {
    const metrics = buildFunnelMetrics("2026-07-10", baseCollected);

    expect(buildLocalInsight(metrics)).toContain('"Em conversa" e "Qualificado"');
    expect(buildLocalInsight(metrics)).toContain("75%");
  });

  it("alerta falta de leads quando não há gargalo nem leads novos", () => {
    const metrics = buildFunnelMetrics("2026-07-10", {
      ...baseCollected,
      leadsCreated: 0,
      stages: [],
    });

    expect(buildLocalInsight(metrics)).toContain("sem combustível");
  });
});
