import { describe, expect, it } from "vitest";
import type { FlowDefinition } from "@vendaflow/automation";
import { NotImplementedYetError } from "../errors.js";
import type { AutomationJobPayload, EmailJobPayload, OutboundJobPayload } from "../payloads.js";
import type { Log } from "../types.js";
import {
  buildCadenceDefinition,
  createAutomationProcessor,
  DEFAULT_CADENCE_TEMPLATES,
  ensureStageAutomation,
  firstName,
  renderTemplate,
  textToHtml,
  type AutomationDeps,
  type AutomationRunSnapshot,
  type EnsureStageAutomationDeps,
  type RunUpdate,
  type StageAutomationSeed,
} from "./automation.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

/** Quarta-feira 12:00 local — dentro do horário ativo padrão (08–21, seg–sáb). */
const NOW = new Date(2026, 6, 8, 12, 0, 0);

/** Domingo 12:00 local — fora do horário ativo padrão. */
const SUNDAY = new Date(2026, 6, 12, 12, 0, 0);

const PAYLOAD = { workspaceId: "ws_1", runId: "run_1" };

const FLOW_DEFINITION: FlowDefinition = {
  name: "Fluxo teste",
  trigger: { kind: "stage_entered" },
  steps: [
    { kind: "send_message", channel: "WHATSAPP", template: "Oi, {nome}! Conheça o {produto}." },
    { kind: "wait", minutes: 60 },
    { kind: "send_message", channel: "WHATSAPP", template: "Follow-up, {nome}" },
    { kind: "end" },
  ],
};

function makeSnapshot(partial?: {
  cursor?: number;
  state?: AutomationRunSnapshot["run"]["state"];
  lead?: Partial<AutomationRunSnapshot["lead"]>;
  definition?: FlowDefinition;
}): AutomationRunSnapshot {
  const definition = partial?.definition ?? FLOW_DEFINITION;
  return {
    run: {
      id: "run_1",
      cursor: partial?.cursor ?? 0,
      state: partial?.state ?? "RUNNING",
      createdAt: new Date(NOW.getTime() - 3_600_000),
      updatedAt: new Date(NOW.getTime() - 600_000),
    },
    flow: {
      id: "flow_1",
      name: definition.name,
      isActive: true,
      trigger: definition.trigger,
      steps: definition.steps,
    },
    lead: {
      id: "lead_1",
      name: "Ana Souza",
      email: null,
      optedOut: false,
      aiStatus: "RUNNING",
      stageId: "stage_1",
      ...partial?.lead,
    },
  };
}

interface Recorded {
  runUpdates: Array<{ runId: string; update: RunUpdate }>;
  outbound: OutboundJobPayload[];
  emails: EmailJobPayload[];
  approvals: Array<{ kind: string; payload: Record<string, unknown> }>;
  stageMoves: Array<{ stageKey: string }>;
  tags: string[];
  notifications: Array<{ message: string }>;
  enqueued: Array<{ payload: AutomationJobPayload; delayMs: number }>;
  createdMessages: string[];
}

function makeDeps(
  snapshot: AutomationRunSnapshot | null,
  overrides?: Partial<AutomationDeps>,
): { deps: AutomationDeps; recorded: Recorded } {
  const recorded: Recorded = {
    runUpdates: [],
    outbound: [],
    emails: [],
    approvals: [],
    stageMoves: [],
    tags: [],
    notifications: [],
    enqueued: [],
    createdMessages: [],
  };
  const deps: AutomationDeps = {
    log: silentLog,
    now: () => NOW,
    loadRun: async () => snapshot,
    loadStagePolicy: async () => ({
      autonomy: "AUTO",
      activeHours: { start: "08:00", end: "21:00", days: [1, 2, 3, 4, 5, 6] },
    }),
    hasLeadRepliedSince: async () => false,
    buildVars: async () => ({ produto: "Curso X", valor: "R$ 100,00", link_acesso: "" }),
    createWhatsAppMessage: async (_ws, _lead, text) => {
      recorded.createdMessages.push(text);
      return { conversationId: "conv_1", messageId: `msg_${recorded.createdMessages.length}` };
    },
    enqueueOutbound: async (payload) => {
      recorded.outbound.push(payload);
    },
    enqueueEmail: async (payload) => {
      recorded.emails.push(payload);
    },
    createApproval: async (input) => {
      recorded.approvals.push({ kind: input.kind, payload: input.payload });
    },
    moveStage: async (input) => {
      recorded.stageMoves.push({ stageKey: input.stageKey });
    },
    addLeadTag: async (_ws, _lead, tag) => {
      recorded.tags.push(tag);
    },
    notifyHuman: async (input) => {
      recorded.notifications.push({ message: input.message });
    },
    updateRun: async (runId, update) => {
      recorded.runUpdates.push({ runId, update });
    },
    enqueueRunStep: async (payload, delayMs) => {
      recorded.enqueued.push({ payload, delayMs });
    },
    ...overrides,
  };
  return { deps, recorded };
}

async function process(deps: AutomationDeps, data: unknown = PAYLOAD): Promise<void> {
  const processor = createAutomationProcessor({ log: silentLog, deps });
  await processor({ name: "run-step", data });
}

describe("automation run-step", () => {
  it("send (AUTO/WHATSAPP): cria Message, enfileira outbound e re-enfileira com delay 0", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ cursor: 0 }));
    await process(deps);

    expect(recorded.createdMessages).toEqual(["Oi, Ana! Conheça o Curso X."]);
    expect(recorded.outbound).toEqual([
      {
        workspaceId: "ws_1",
        conversationId: "conv_1",
        messageId: "msg_1",
        kind: "TEXT",
        payload: { text: "Oi, Ana! Conheça o Curso X." },
      },
    ]);
    expect(recorded.runUpdates).toEqual([{ runId: "run_1", update: { cursor: 1 } }]);
    expect(recorded.enqueued).toEqual([{ payload: PAYLOAD, delayMs: 0 }]);
  });

  it("wait: grava nextRunAt e re-enfileira com o delay do sleep", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ cursor: 1 }));
    await process(deps);

    const expectedAt = new Date(NOW.getTime() + 60 * 60_000);
    expect(recorded.runUpdates).toEqual([
      { runId: "run_1", update: { cursor: 2, nextRunAt: expectedAt } },
    ]);
    expect(recorded.enqueued).toEqual([{ payload: PAYLOAD, delayMs: 60 * 60_000 }]);
    expect(recorded.outbound).toHaveLength(0);
  });

  it("fluxo completo send→wait→send→end avança o cursor a cada tick", async () => {
    // tick no cursor 2: segundo send
    const second = makeDeps(makeSnapshot({ cursor: 2 }));
    await process(second.deps);
    expect(second.recorded.createdMessages).toEqual(["Follow-up, Ana"]);
    expect(second.recorded.runUpdates).toEqual([{ runId: "run_1", update: { cursor: 3 } }]);
    expect(second.recorded.enqueued).toEqual([{ payload: PAYLOAD, delayMs: 0 }]);

    // tick no cursor 3: end → DONE, sem re-enfileirar
    const done = makeDeps(makeSnapshot({ cursor: 3 }));
    await process(done.deps);
    expect(done.recorded.runUpdates).toEqual([
      { runId: "run_1", update: { state: "DONE", cursor: 3, nextRunAt: null } },
    ]);
    expect(done.recorded.enqueued).toHaveLength(0);
  });

  it("send fora do horário ativo dorme até a próxima janela sem avançar o cursor", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ cursor: 0 }), { now: () => SUNDAY });
    await process(deps);

    expect(recorded.outbound).toHaveLength(0);
    expect(recorded.runUpdates).toHaveLength(1);
    const update = recorded.runUpdates[0]?.update;
    expect(update?.cursor).toBe(0);
    expect(update?.nextRunAt).toBeInstanceOf(Date);
    expect(recorded.enqueued[0]?.delayMs).toBeGreaterThan(0);
  });

  it("lead opted-out cancela o run sem executar passo", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ lead: { optedOut: true } }));
    await process(deps);

    expect(recorded.runUpdates).toEqual([
      { runId: "run_1", update: { state: "CANCELLED", pausedReason: "opted_out", nextRunAt: null } },
    ]);
    expect(recorded.outbound).toHaveLength(0);
    expect(recorded.enqueued).toHaveLength(0);
  });

  it("lead com IA pausada pausa o run com pausedReason ai_paused", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ lead: { aiStatus: "PAUSED" } }));
    await process(deps);

    expect(recorded.runUpdates).toEqual([
      { runId: "run_1", update: { state: "PAUSED", pausedReason: "ai_paused", nextRunAt: null } },
    ]);
    expect(recorded.enqueued).toHaveLength(0);
  });

  it("run não-RUNNING encerra sem erro e sem efeitos", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ state: "DONE" }));
    await process(deps);

    expect(recorded.runUpdates).toHaveLength(0);
    expect(recorded.enqueued).toHaveLength(0);
  });

  it("run inexistente encerra sem erro (lead sumiu não gasta retries)", async () => {
    const { deps, recorded } = makeDeps(null);
    await expect(process(deps)).resolves.toBeUndefined();
    expect(recorded.runUpdates).toHaveLength(0);
  });

  it("autonomy DRAFT vira Approval MESSAGE_DRAFT e avança o cursor", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ cursor: 0 }), {
      loadStagePolicy: async () => ({
        autonomy: "DRAFT",
        activeHours: { start: "08:00", end: "21:00", days: [1, 2, 3, 4, 5, 6] },
      }),
    });
    await process(deps);

    expect(recorded.approvals).toHaveLength(1);
    expect(recorded.approvals[0]?.kind).toBe("MESSAGE_DRAFT");
    expect(recorded.approvals[0]?.payload).toMatchObject({
      text: "Oi, Ana! Conheça o Curso X.",
      channel: "WHATSAPP",
    });
    expect(recorded.outbound).toHaveLength(0);
    expect(recorded.runUpdates).toEqual([{ runId: "run_1", update: { cursor: 1 } }]);
    expect(recorded.enqueued).toEqual([{ payload: PAYLOAD, delayMs: 0 }]);
  });

  it("autonomy SEMI vira Approval BULK_OUTREACH", async () => {
    const { deps, recorded } = makeDeps(makeSnapshot({ cursor: 0 }), {
      loadStagePolicy: async () => ({
        autonomy: "SEMI",
        activeHours: { start: "08:00", end: "21:00", days: [1, 2, 3, 4, 5, 6] },
      }),
    });
    await process(deps);

    expect(recorded.approvals[0]?.kind).toBe("BULK_OUTREACH");
  });

  it("send EMAIL sem e-mail do lead pula o passo mas avança o cursor", async () => {
    const definition: FlowDefinition = {
      name: "Fluxo e-mail",
      trigger: { kind: "stage_entered" },
      steps: [
        { kind: "send_message", channel: "EMAIL", template: "Oi, {nome}" },
        { kind: "end" },
      ],
    };
    const { deps, recorded } = makeDeps(makeSnapshot({ definition, lead: { email: null } }));
    await process(deps);

    expect(recorded.emails).toHaveLength(0);
    expect(recorded.runUpdates).toEqual([{ runId: "run_1", update: { cursor: 1 } }]);
    expect(recorded.enqueued).toEqual([{ payload: PAYLOAD, delayMs: 0 }]);
  });

  it("send EMAIL com e-mail enfileira na fila email com HTML renderizado", async () => {
    const definition: FlowDefinition = {
      name: "Fluxo e-mail",
      trigger: { kind: "stage_entered" },
      steps: [
        { kind: "send_message", channel: "EMAIL", template: "Oi, {nome}" },
        { kind: "end" },
      ],
    };
    const { deps, recorded } = makeDeps(
      makeSnapshot({ definition, lead: { email: "ana@exemplo.com" } }),
    );
    await process(deps);

    expect(recorded.emails).toEqual([
      {
        workspaceId: "ws_1",
        to: "ana@exemplo.com",
        subject: "Sobre Curso X",
        html: "<p>Oi, Ana</p>",
      },
    ]);
  });

  it("move_stage, add_tag e notify_human executam efeitos e avançam", async () => {
    const definition: FlowDefinition = {
      name: "Fluxo efeitos",
      trigger: { kind: "stage_entered" },
      steps: [
        { kind: "move_stage", stageKey: "reativar-depois" },
        { kind: "add_tag", tag: "cadencia-fria" },
        { kind: "notify_human", message: "Lead {nome} precisa de atenção" },
        { kind: "end" },
      ],
    };
    const move = makeDeps(makeSnapshot({ definition, cursor: 0 }));
    await process(move.deps);
    expect(move.recorded.stageMoves).toEqual([{ stageKey: "reativar-depois" }]);

    const tag = makeDeps(makeSnapshot({ definition, cursor: 1 }));
    await process(tag.deps);
    expect(tag.recorded.tags).toEqual(["cadencia-fria"]);

    const notify = makeDeps(makeSnapshot({ definition, cursor: 2 }));
    await process(notify.deps);
    expect(notify.recorded.notifications).toEqual([{ message: "Lead Ana precisa de atenção" }]);
  });

  it("definição de flow inválida cancela o run sem relançar", async () => {
    const snapshot = makeSnapshot();
    snapshot.flow.steps = "não é uma lista";
    const { deps, recorded } = makeDeps(snapshot);
    await expect(process(deps)).resolves.toBeUndefined();

    expect(recorded.runUpdates).toEqual([
      {
        runId: "run_1",
        update: { state: "CANCELLED", pausedReason: "definicao_invalida", nextRunAt: null },
      },
    ]);
  });

  it("rejeita payload inválido com erro de validação", async () => {
    const { deps } = makeDeps(makeSnapshot());
    await expect(process(deps, { workspaceId: "ws_1" })).rejects.toThrowError();
  });

  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { deps } = makeDeps(makeSnapshot());
    const processor = createAutomationProcessor({ log: silentLog, deps });
    await expect(processor({ name: "job-inexistente", data: PAYLOAD })).rejects.toBeInstanceOf(
      NotImplementedYetError,
    );
  });
});

// ── ensureStageAutomation ──────────────────────────────────────────────────

interface EnsureRecorded {
  createdFlows: Array<{ workspaceId: string; definition: FlowDefinition }>;
  createdRuns: Array<{ flowId: string; leadId: string }>;
  enqueued: Array<{ payload: AutomationJobPayload; delayMs: number }>;
}

function makeEnsureDeps(config: {
  existingFlowId?: string;
  hasActiveRun?: boolean;
  seed?: StageAutomationSeed | null;
}): { deps: EnsureStageAutomationDeps; recorded: EnsureRecorded } {
  const recorded: EnsureRecorded = { createdFlows: [], createdRuns: [], enqueued: [] };
  const deps: EnsureStageAutomationDeps = {
    log: silentLog,
    findStageEnteredFlow: async () =>
      config.existingFlowId !== undefined ? { flowId: config.existingFlowId } : null,
    hasActiveRun: async () => config.hasActiveRun ?? false,
    loadCadenceSeed: async () => config.seed ?? null,
    createFlow: async (workspaceId, definition) => {
      recorded.createdFlows.push({ workspaceId, definition });
      return { flowId: "flow_gerado" };
    },
    createRun: async (flowId, leadId) => {
      recorded.createdRuns.push({ flowId, leadId });
      return { runId: "run_novo" };
    },
    enqueueRunStep: async (payload, delayMs) => {
      recorded.enqueued.push({ payload, delayMs });
    },
  };
  return { deps, recorded };
}

const ENSURE_INPUT = { workspaceId: "ws_1", leadId: "lead_1", stageId: "stage_1" };

describe("ensureStageAutomation", () => {
  it("sem flow explícito gera o flow default da cadência do playbook", async () => {
    const seed: StageAutomationSeed = {
      cadence: { intervals: [0, 20], maxTouches: 2 },
      templates: ["Toque 1 para {nome}", "Toque 2 para {nome}"],
      stageKey: "novo-lead",
    };
    const { deps, recorded } = makeEnsureDeps({ seed });

    const result = await ensureStageAutomation(deps, ENSURE_INPUT);

    expect(result).toEqual({ flowId: "flow_gerado", runId: "run_novo" });
    expect(recorded.createdFlows).toHaveLength(1);
    const definition = recorded.createdFlows[0]?.definition;
    expect(definition?.trigger).toEqual({ kind: "stage_entered", stageKey: "novo-lead" });
    expect(definition?.steps).toEqual([
      { kind: "send_message", channel: "WHATSAPP", template: "Toque 1 para {nome}" },
      { kind: "wait", minutes: 20 },
      { kind: "send_message", channel: "WHATSAPP", template: "Toque 2 para {nome}" },
      { kind: "end" },
    ]);
    expect(recorded.createdRuns).toEqual([{ flowId: "flow_gerado", leadId: "lead_1" }]);
    expect(recorded.enqueued).toEqual([
      { payload: { workspaceId: "ws_1", runId: "run_novo" }, delayMs: 0 },
    ]);
  });

  it("usa templates default quando o workspace não define os seus", async () => {
    const seed: StageAutomationSeed = {
      cadence: { intervals: [0], maxTouches: 1 },
      templates: [],
      stageKey: "novo-lead",
    };
    const { deps, recorded } = makeEnsureDeps({ seed });
    await ensureStageAutomation(deps, ENSURE_INPUT);

    expect(recorded.createdFlows[0]?.definition.steps[0]).toEqual({
      kind: "send_message",
      channel: "WHATSAPP",
      template: DEFAULT_CADENCE_TEMPLATES[0],
    });
  });

  it("com flow explícito cria run sem gerar flow novo", async () => {
    const { deps, recorded } = makeEnsureDeps({ existingFlowId: "flow_explicito" });
    const result = await ensureStageAutomation(deps, ENSURE_INPUT);

    expect(result).toEqual({ flowId: "flow_explicito", runId: "run_novo" });
    expect(recorded.createdFlows).toHaveLength(0);
    expect(recorded.createdRuns).toEqual([{ flowId: "flow_explicito", leadId: "lead_1" }]);
  });

  it("não duplica run quando o lead já tem run ativo do flow", async () => {
    const { deps, recorded } = makeEnsureDeps({
      existingFlowId: "flow_explicito",
      hasActiveRun: true,
    });
    const result = await ensureStageAutomation(deps, ENSURE_INPUT);

    expect(result).toBeNull();
    expect(recorded.createdRuns).toHaveLength(0);
    expect(recorded.enqueued).toHaveLength(0);
  });

  it("estágio sem cadência não instancia nada", async () => {
    const { deps, recorded } = makeEnsureDeps({
      seed: { cadence: { intervals: [], maxTouches: 0 }, templates: [] },
    });
    const result = await ensureStageAutomation(deps, ENSURE_INPUT);

    expect(result).toBeNull();
    expect(recorded.createdFlows).toHaveLength(0);
    expect(recorded.createdRuns).toHaveLength(0);
  });
});

// ── utilitários ────────────────────────────────────────────────────────────

describe("utilitários de template", () => {
  it("renderTemplate substitui vars conhecidas e preserva tokens desconhecidos", () => {
    expect(renderTemplate("Oi {nome}, veja {produto} por {valor} — {desconhecida}", {
      nome: "Ana",
      produto: "Curso X",
      valor: "R$ 97,00",
    })).toBe("Oi Ana, veja Curso X por R$ 97,00 — {desconhecida}");
  });

  it("firstName extrai o primeiro nome", () => {
    expect(firstName("Ana Clara Souza")).toBe("Ana");
    expect(firstName("  ")).toBe("");
  });

  it("textToHtml escapa e converte parágrafos/quebras", () => {
    expect(textToHtml("a <b>\n\nc\nd")).toBe("<p>a &lt;b&gt;</p><p>c<br>d</p>");
  });

  it("buildCadenceDefinition monta trigger sem stageKey quando ausente", () => {
    const definition = buildCadenceDefinition({
      cadence: { intervals: [0], maxTouches: 1 },
      templates: ["Oi"],
    });
    expect(definition.trigger).toEqual({ kind: "stage_entered" });
  });
});
