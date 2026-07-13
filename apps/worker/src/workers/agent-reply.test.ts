import { describe, expect, it } from "vitest";
import {
  MAX_TYPING_DELAY_MS,
  MIN_TYPING_DELAY_MS,
  type LlmClient,
  type LlmResponse,
} from "@sales4u/brain";
import type { AgentReplyJobPayload, OutboundJobPayload } from "../payloads.js";
import type { Log } from "../types.js";
import {
  createAgentReplyProcessor,
  OPT_OUT_CONFIRMATION,
  resolveStage,
  type AgentReplyDb,
  type AgentReplyDeps,
  type StoredConversation,
  type StoredMessage,
  type StoredStage,
} from "./agent-reply.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

/** Quarta-feira 15:00 local — dentro do horário ativo default (08–21, seg–sáb). */
const NOW = new Date("2026-07-08T15:00:00");

const basePayload: AgentReplyJobPayload = {
  workspaceId: "ws_1",
  conversationId: "conv_1",
  messageId: "msg_in",
};

const CLASSIFIER_OK: LlmResponse = {
  text: '{"intent":"saber preço","temperature":"WARM","score":55}',
  usage: { inputTokens: 10, outputTokens: 5 },
};

interface WorldState {
  conversation: StoredConversation | null;
  inbound: StoredMessage | null;
  alreadyReplied: boolean;
  outPerMinute: number;
  settings: Record<string, unknown>;
  stages: StoredStage[];
}

interface Recorded {
  leadUpdates: Array<Record<string, unknown>>;
  cancelledRuns: string[];
  outMessages: Array<{ kind: string; content: Record<string, unknown> }>;
  approvals: Array<{ kind: string; payload: Record<string, unknown> }>;
  events: Array<{ type: string; data: Record<string, unknown> }>;
  notes: string[];
  outboundJobs: Array<{ payload: OutboundJobPayload; delayMs: number }>;
  agentReplyJobs: Array<{ payload: AgentReplyJobPayload; delayMs: number; followUp?: boolean }>;
  stageChanges: Array<{ toStageId: string; reason?: string }>;
  published: Array<{ channel: string; payload: Record<string, unknown> }>;
  usage: string[];
  llmCalls: number;
  wonDeals: Array<{ productOfferId: string; valueCents: number }>;
}

function makeState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    conversation: {
      id: "conv_1",
      state: "BOT",
      lead: {
        id: "lead_1",
        name: "João",
        aiStatus: "RUNNING",
        optedOut: false,
        stage: { id: "st_conversa", name: "Em conversa", systemKey: null },
        playbook: {
          objective: "entender a dor do lead",
          instructions: "pergunte uma coisa por vez",
          allowedActions: [
            "send_text",
            "send_link",
            "update_lead",
            "move_stage",
            "schedule_followup",
            "register_objection",
            "escalate_human",
            "register_sale",
            "flag_missing_context",
          ],
          autonomy: "AUTO",
        },
      },
    },
    inbound: {
      id: "msg_in",
      direction: "IN",
      content: { text: "quero saber mais sobre o curso" },
      createdAt: new Date("2026-07-08T14:59:00"),
    },
    alreadyReplied: false,
    outPerMinute: 0,
    settings: {},
    stages: [
      { id: "st_conversa", name: "Em conversa", systemKey: null },
      { id: "st_qualificado", name: "Qualificado", systemKey: null },
      { id: "st_won", name: "Ganho", systemKey: "WON" },
    ],
    ...overrides,
  };
}

function makeFakeLlm(
  responses: LlmResponse[],
  recorded: Recorded,
): LlmClient {
  const pending = [...responses];
  return {
    complete: () => {
      recorded.llmCalls += 1;
      const next = pending.shift();
      if (!next) return Promise.resolve({ text: "", usage: { inputTokens: 0, outputTokens: 0 } });
      return Promise.resolve(next);
    },
  };
}

function makeDeps(
  state: WorldState,
  llmResponses: LlmResponse[],
): { deps: AgentReplyDeps; recorded: Recorded } {
  const recorded: Recorded = {
    leadUpdates: [],
    cancelledRuns: [],
    outMessages: [],
    approvals: [],
    events: [],
    notes: [],
    outboundJobs: [],
    agentReplyJobs: [],
    stageChanges: [],
    published: [],
    usage: [],
    llmCalls: 0,
    wonDeals: [],
  };

  const db: AgentReplyDb = {
    getConversation: async () => state.conversation,
    getInboundMessage: async () => state.inbound,
    hasOutMessageAfter: async () => state.alreadyReplied,
    countOutMessagesSince: async () => state.outPerMinute,
    listRecentMessages: async () => (state.inbound ? [state.inbound] : []),
    createOutMessage: async (input) => {
      recorded.outMessages.push({ kind: input.kind, content: input.content });
      return { id: `out_${recorded.outMessages.length}` };
    },
    updateLead: async (_ws, _leadId, data) => {
      recorded.leadUpdates.push({ ...data });
    },
    cancelAutomationRuns: async (_ws, leadId) => {
      recorded.cancelledRuns.push(leadId);
    },
    createNote: async (_ws, _leadId, text) => {
      recorded.notes.push(text);
    },
    createApproval: async (input) => {
      recorded.approvals.push({ kind: input.kind, payload: input.payload });
    },
    createEventLog: async (input) => {
      recorded.events.push({ type: input.type, data: input.data });
    },
    getPersona: async () => null,
    getActiveMode: async () => null,
    getContextFileText: async () => null,
    getPrimaryOffer: async () => null,
    getOffer: async () => null,
    getWorkspaceSettings: async () => state.settings,
    getPublishedLandingSlugs: async () => [],
    listStages: async () => state.stages,
    createWonDeal: async (input) => {
      recorded.wonDeals.push({ productOfferId: input.productOfferId, valueCents: input.valueCents });
    },
    setConversationLastMessageAt: async () => undefined,
  };

  const deps: AgentReplyDeps = {
    db,
    getLlm: async () => makeFakeLlm(llmResponses, recorded),
    retrieveContext: async () => [],
    enqueueOutbound: async (payload, options) => {
      recorded.outboundJobs.push({ payload, delayMs: options.delayMs });
    },
    enqueueAgentReply: async (payload, options) => {
      recorded.agentReplyJobs.push({
        payload,
        delayMs: options.delayMs,
        followUp: options.followUp,
      });
    },
    applyStageChange: async (input) => {
      recorded.stageChanges.push({ toStageId: input.toStageId, reason: input.reason });
      return { ok: true, toastText: "" };
    },
    publish: async (_ws, kind, payload) => {
      recorded.published.push({ channel: kind, payload });
    },
    recordUsage: async (input) => {
      recorded.usage.push(input.feature);
    },
    urls: {
      appUrl: "https://app.sales4u.test",
      s3Endpoint: "http://minio:9000",
      s3Bucket: "sales4u",
    },
    now: () => NOW,
    log: silentLog,
  };

  return { deps, recorded };
}

function runJob(deps: AgentReplyDeps, data: unknown = basePayload): Promise<void> {
  const processor = createAgentReplyProcessor(deps);
  return processor({ name: "reply", data });
}

describe("agent-reply: guardas", () => {
  it("conversa em HUMAN não responde nem chama o modelo", async () => {
    const state = makeState();
    if (state.conversation) state.conversation.state = "HUMAN";
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.outboundJobs).toHaveLength(0);
    expect(recorded.leadUpdates).toHaveLength(0);
  });

  it("dedupe: mensagem já respondida não responde duas vezes", async () => {
    const state = makeState({ alreadyReplied: true });
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.outboundJobs).toHaveLength(0);
  });

  it("lead com IA pausada encerra sem erro", async () => {
    const state = makeState();
    if (state.conversation) state.conversation.lead.aiStatus = "PAUSED";
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.outboundJobs).toHaveLength(0);
  });

  it("rate limit por conversa encerra sem chamar o modelo", async () => {
    const state = makeState({ outPerMinute: 8 });
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.outboundJobs).toHaveLength(0);
  });

  it("fora do horário ativo reagenda na própria fila e encerra", async () => {
    const state = makeState();
    const { deps, recorded } = makeDeps(state, []);
    deps.now = () => new Date("2026-07-12T15:00:00"); // domingo — fora do default

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.agentReplyJobs).toHaveLength(1);
    expect(recorded.agentReplyJobs[0]?.delayMs).toBeGreaterThan(0);
    expect(recorded.agentReplyJobs[0]?.payload).toEqual(basePayload);
  });
});

describe("agent-reply: opt-out", () => {
  it('marca optedOut, cancela automações e confirma com "PARAR"', async () => {
    const state = makeState();
    if (state.inbound) state.inbound.content = { text: "  PARAR  " };
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.leadUpdates).toContainEqual({ optedOut: true });
    expect(recorded.cancelledRuns).toEqual(["lead_1"]);
    expect(recorded.outboundJobs).toHaveLength(1);
    const job = recorded.outboundJobs[0];
    expect(job?.payload.kind).toBe("TEXT");
    expect(job?.payload.payload).toEqual({ text: OPT_OUT_CONFIRMATION });
    expect(recorded.events.map((event) => event.type)).toContain("lead.opted_out");
    expect(recorded.published.some((p) => p.channel === "inbox")).toBe(true);
  });
});

describe("agent-reply: handoff por palavra-chave", () => {
  it("aciona WAITING_HUMAN sem resposta automática (keyword default)", async () => {
    const state = makeState();
    if (state.inbound) state.inbound.content = { text: "quero reembolso agora" };
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.llmCalls).toBe(0);
    expect(recorded.leadUpdates).toContainEqual({ aiStatus: "WAITING_HUMAN" });
    expect(recorded.outboundJobs).toHaveLength(0);
    expect(recorded.events.map((event) => event.type)).toContain(
      "conversation.handoff_triggered",
    );
    const notify = recorded.published.find((p) => p.channel === "notify");
    expect(notify?.payload).toMatchObject({ kind: "handoff", leadId: "lead_1" });
  });

  it("usa as keywords configuradas no workspace", async () => {
    const state = makeState({ settings: { handoffKeywords: ["gerente"] } });
    if (state.inbound) state.inbound.content = { text: "chama o GERENTE por favor" };
    const { deps, recorded } = makeDeps(state, []);

    await runJob(deps);

    expect(recorded.leadUpdates).toContainEqual({ aiStatus: "WAITING_HUMAN" });
    expect(recorded.llmCalls).toBe(0);
  });
});

describe("agent-reply: enforcement e envio", () => {
  it("autonomia DRAFT: send_text vira Approval MESSAGE_DRAFT e nada é enviado", async () => {
    const state = makeState();
    if (state.conversation?.lead.playbook) state.conversation.lead.playbook.autonomy = "DRAFT";
    const { deps, recorded } = makeDeps(state, [
      CLASSIFIER_OK,
      {
        toolCalls: [{ name: "send_text", input: { text: "Oi! Posso te explicar tudo." } }],
        usage: { inputTokens: 100, outputTokens: 20 },
      },
    ]);

    await runJob(deps);

    expect(recorded.outboundJobs).toHaveLength(0);
    expect(recorded.approvals).toHaveLength(1);
    expect(recorded.approvals[0]?.kind).toBe("MESSAGE_DRAFT");
    expect(recorded.approvals[0]?.payload).toMatchObject({ tool: "send_text" });
    const notify = recorded.published.find((p) => p.channel === "notify");
    expect(notify?.payload).toMatchObject({ kind: "approval_pending" });
  });

  it("send_text (AUTO) enfileira outbound com delay humano de 2000–6000ms", async () => {
    const state = makeState();
    const text = "Perfeito! O curso abre turma na semana que vem. Quer os detalhes?";
    const { deps, recorded } = makeDeps(state, [
      CLASSIFIER_OK,
      { toolCalls: [{ name: "send_text", input: { text } }], usage: { inputTokens: 90, outputTokens: 30 } },
    ]);

    await runJob(deps);

    expect(recorded.outMessages).toEqual([{ kind: "TEXT", content: { text } }]);
    expect(recorded.outboundJobs).toHaveLength(1);
    const job = recorded.outboundJobs[0];
    expect(job?.payload).toMatchObject({
      workspaceId: "ws_1",
      conversationId: "conv_1",
      messageId: "out_1",
      kind: "TEXT",
      payload: { text },
    });
    expect(job?.delayMs).toBeGreaterThanOrEqual(MIN_TYPING_DELAY_MS);
    expect(job?.delayMs).toBeLessThanOrEqual(MAX_TYPING_DELAY_MS);

    // classificador atualizou score/temperatura e o uso de IA foi registrado
    expect(recorded.leadUpdates).toContainEqual({ score: 55, temperature: "WARM" });
    expect(recorded.usage).toContain("classifier");
    expect(recorded.usage).toContain("agent-reply");
    const inbox = recorded.published.filter((p) => p.channel === "inbox");
    expect(inbox.at(-1)?.payload).toMatchObject({ conversationId: "conv_1", kind: "agent_replied" });
  });

  it("resposta só texto (sem toolCall) é tratada como send_text", async () => {
    const state = makeState();
    const { deps, recorded } = makeDeps(state, [
      CLASSIFIER_OK,
      { text: "Claro! Te explico rapidinho.", usage: { inputTokens: 50, outputTokens: 10 } },
    ]);

    await runJob(deps);

    expect(recorded.outboundJobs).toHaveLength(1);
    expect(recorded.outboundJobs[0]?.payload.payload).toEqual({
      text: "Claro! Te explico rapidinho.",
    });
  });

  it("move_stage resolve o estágio por nome slugificado e chama applyStageChange", async () => {
    const state = makeState();
    const { deps, recorded } = makeDeps(state, [
      CLASSIFIER_OK,
      {
        toolCalls: [
          { name: "send_text", input: { text: "Show, você tem o perfil certo!" } },
          { name: "move_stage", input: { stageKey: "qualificado", reason: "dor mapeada" } },
        ],
        usage: { inputTokens: 120, outputTokens: 40 },
      },
    ]);

    await runJob(deps);

    expect(recorded.stageChanges).toEqual([{ toStageId: "st_qualificado", reason: "dor mapeada" }]);
    expect(recorded.outboundJobs).toHaveLength(1);
  });

  it("ação fora do playbook é bloqueada e o modelo continua sem ela", async () => {
    const state = makeState();
    if (state.conversation?.lead.playbook) {
      state.conversation.lead.playbook.allowedActions = ["send_text"];
    }
    const { deps, recorded } = makeDeps(state, [
      CLASSIFIER_OK,
      {
        toolCalls: [{ name: "register_sale", input: { offerId: "of_1", valueCents: 1000 } }],
        usage: { inputTokens: 80, outputTokens: 15 },
      },
      {
        toolCalls: [{ name: "send_text", input: { text: "Vou confirmar com o time!" } }],
        usage: { inputTokens: 85, outputTokens: 12 },
      },
    ]);

    await runJob(deps);

    expect(recorded.wonDeals).toHaveLength(0);
    expect(recorded.llmCalls).toBe(3); // classificador + 2 iterações do loop
    expect(recorded.outboundJobs).toHaveLength(1);
  });

  it("schedule_followup reenfileira o job na fila agent-reply com followUp", async () => {
    const state = makeState();
    const { deps, recorded } = makeDeps(state, [
      CLASSIFIER_OK,
      {
        toolCalls: [
          { name: "send_text", input: { text: "Te chamo amanhã então!" } },
          { name: "schedule_followup", input: { minutesFromNow: 120, note: "retomar amanhã" } },
        ],
        usage: { inputTokens: 70, outputTokens: 25 },
      },
    ]);

    await runJob(deps);

    expect(recorded.agentReplyJobs).toEqual([
      { payload: basePayload, delayMs: 120 * 60_000, followUp: true },
    ]);
  });

  it("sem credencial ANTHROPIC registra credential.missing e encerra sem erro", async () => {
    const state = makeState();
    const { deps, recorded } = makeDeps(state, []);
    deps.getLlm = async () => {
      const error = new Error("sem credencial");
      error.name = "MissingCredentialError";
      throw error;
    };

    await expect(runJob(deps)).resolves.toBeUndefined();

    expect(recorded.events.map((event) => event.type)).toContain("credential.missing");
    const notify = recorded.published.find((p) => p.channel === "notify");
    expect(notify?.payload).toMatchObject({ kind: "credential_missing", provider: "ANTHROPIC" });
    expect(recorded.outboundJobs).toHaveLength(0);
  });
});

describe("resolveStage", () => {
  const stages: StoredStage[] = [
    { id: "st_1", name: "Em conversa", systemKey: null },
    { id: "st_2", name: "Não respondeu", systemKey: "NO_REPLY" },
    { id: "st_3", name: "Ganho", systemKey: "WON" },
  ];

  it("resolve por systemKey", () => {
    expect(resolveStage(stages, "won")?.id).toBe("st_3");
  });

  it("resolve por nome slugificado (com acento)", () => {
    expect(resolveStage(stages, "nao-respondeu")?.id).toBe("st_2");
    expect(resolveStage(stages, "Em Conversa")?.id).toBe("st_1");
  });

  it("resolve por id como último recurso", () => {
    expect(resolveStage(stages, "st_1")?.id).toBe("st_1");
  });

  it("retorna undefined para chave desconhecida", () => {
    expect(resolveStage(stages, "inexistente")).toBeUndefined();
  });
});
