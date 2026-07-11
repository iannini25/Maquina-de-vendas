import { DEFAULT_ACTIVE_HOURS, DEFAULT_CADENCE } from "@vendaflow/core";
import { describe, expect, it } from "vitest";
import {
  FALLBACK_CADENCE_TEMPLATE,
  advance,
  defaultCadenceFlow,
  expandSteps,
  nextOccurrenceOfHour,
  type RunContext,
} from "./executor.js";
import type { FlowDefinition, FlowStep } from "./flow-types.js";

/** Segunda-feira, 05/01/2026, 10:00 local — dentro do horário ativo padrão. */
const SEGUNDA_10H = new Date(2026, 0, 5, 10, 0, 0, 0);

function contexto(overrides: Partial<RunContext> = {}): RunContext {
  return {
    leadRepliedSinceStepStart: false,
    leadOptedOut: false,
    aiPaused: false,
    autonomy: "AUTO",
    activeHours: DEFAULT_ACTIVE_HOURS,
    now: SEGUNDA_10H,
    ...overrides,
  };
}

function flow(steps: FlowStep[]): FlowDefinition {
  return { name: "Teste", trigger: { kind: "lead_created" }, steps };
}

const FLOW_COM_BRANCH = flow([
  { kind: "send_message", channel: "WHATSAPP", template: "toque 1" },
  {
    kind: "branch_replied",
    ifReplied: [{ kind: "add_tag", tag: "respondeu" }],
    ifNot: [
      { kind: "send_message", channel: "WHATSAPP", template: "follow-up" },
      { kind: "notify_human", message: "sem resposta" },
    ],
  },
  { kind: "end" },
]);

describe("expandSteps", () => {
  it("com replied=false expande o ramo ifNot no lugar do branch", () => {
    expect(expandSteps(FLOW_COM_BRANCH, false).map((s) => s.kind)).toEqual([
      "send_message",
      "send_message",
      "notify_human",
      "end",
    ]);
  });

  it("com replied=true expande o ramo ifReplied no lugar do branch", () => {
    expect(expandSteps(FLOW_COM_BRANCH, true).map((s) => s.kind)).toEqual([
      "send_message",
      "add_tag",
      "end",
    ]);
  });

  it("expande branches aninhados recursivamente", () => {
    const aninhado = flow([
      {
        kind: "branch_replied",
        ifReplied: [{ kind: "end" }],
        ifNot: [
          {
            kind: "branch_replied",
            ifReplied: [{ kind: "end" }],
            ifNot: [{ kind: "add_tag", tag: "frio" }],
          },
        ],
      },
    ]);
    expect(expandSteps(aninhado, false)).toEqual([{ kind: "add_tag", tag: "frio" }]);
  });
});

describe("advance — caminhada completa send → wait → send", () => {
  const definicao = flow([
    { kind: "send_message", channel: "WHATSAPP", template: "toque 1" },
    { kind: "wait", minutes: 30 },
    { kind: "send_message", channel: "EMAIL", template: "toque 2" },
    { kind: "end" },
  ]);

  it("percorre o flow passo a passo até done", () => {
    const ctx = contexto();

    const passo0 = advance(definicao, 0, ctx);
    expect(passo0).toEqual({
      action: { type: "send", channel: "WHATSAPP", template: "toque 1", mode: "AUTO" },
      nextCursor: 1,
    });

    const passo1 = advance(definicao, passo0.nextCursor, ctx);
    expect(passo1.action).toEqual({
      type: "sleep_until",
      at: new Date(2026, 0, 5, 10, 30, 0, 0),
    });
    expect(passo1.nextCursor).toBe(2);

    const passo2 = advance(definicao, passo1.nextCursor, ctx);
    expect(passo2).toEqual({
      action: { type: "send", channel: "EMAIL", template: "toque 2", mode: "AUTO" },
      nextCursor: 3,
    });

    const passo3 = advance(definicao, passo2.nextCursor, ctx);
    expect(passo3).toEqual({ action: { type: "done" }, nextCursor: 3 });
  });

  it("cursor além do fim da lista efetiva vira done", () => {
    expect(advance(definicao, 99, contexto()).action).toEqual({ type: "done" });
  });
});

describe("advance — cancelamentos", () => {
  const definicao = flow([
    { kind: "send_message", channel: "WHATSAPP", template: "toque 1" },
    { kind: "wait", minutes: 30 },
    { kind: "end" },
  ]);

  it("opt-out cancela sempre, em qualquer cursor, sem mover o cursor", () => {
    const ctx = contexto({ leadOptedOut: true });
    expect(advance(definicao, 1, ctx)).toEqual({
      action: { type: "cancelled", reason: "opted_out" },
      nextCursor: 1,
    });
  });

  it("IA pausada cancela com razão ai_paused", () => {
    const ctx = contexto({ aiPaused: true });
    expect(advance(definicao, 0, ctx)).toEqual({
      action: { type: "cancelled", reason: "ai_paused" },
      nextCursor: 0,
    });
  });

  it("opt-out tem precedência sobre IA pausada", () => {
    const ctx = contexto({ leadOptedOut: true, aiPaused: true });
    expect(advance(definicao, 0, ctx).action).toEqual({
      type: "cancelled",
      reason: "opted_out",
    });
  });
});

describe("advance — autonomia define o modo do send", () => {
  const definicao = flow([
    { kind: "send_message", channel: "WHATSAPP", template: "oferta" },
    { kind: "end" },
  ]);

  it("DRAFT gera rascunho", () => {
    const resultado = advance(definicao, 0, contexto({ autonomy: "DRAFT" }));
    expect(resultado.action).toMatchObject({ type: "send", mode: "DRAFT" });
  });

  it("SEMI pede aprovação", () => {
    const resultado = advance(definicao, 0, contexto({ autonomy: "SEMI" }));
    expect(resultado.action).toMatchObject({ type: "send", mode: "APPROVAL" });
  });
});

describe("advance — horário ativo", () => {
  const definicao = flow([
    { kind: "send_message", channel: "WHATSAPP", template: "toque" },
    { kind: "end" },
  ]);

  it("send fora do horário vira sleep_until a próxima janela, sem avançar o cursor", () => {
    // Segunda 22:00 — depois das 21:00 → dorme até terça 08:00.
    const ctx = contexto({ now: new Date(2026, 0, 5, 22, 0, 0, 0) });
    expect(advance(definicao, 0, ctx)).toEqual({
      action: { type: "sleep_until", at: new Date(2026, 0, 6, 8, 0, 0, 0) },
      nextCursor: 0,
    });
  });

  it("send no domingo (dia inativo) dorme até segunda 08:00", () => {
    // Domingo, 04/01/2026, 10:00 — dia fora de DEFAULT_ACTIVE_HOURS.
    const ctx = contexto({ now: new Date(2026, 0, 4, 10, 0, 0, 0) });
    expect(advance(definicao, 0, ctx).action).toEqual({
      type: "sleep_until",
      at: new Date(2026, 0, 5, 8, 0, 0, 0),
    });
  });
});

describe("advance — wait_until e nextOccurrenceOfHour", () => {
  it("agenda a hora no MESMO dia quando ela ainda não passou", () => {
    const definicao = flow([{ kind: "wait_until", hour: 15 }, { kind: "end" }]);
    expect(advance(definicao, 0, contexto()).action).toEqual({
      type: "sleep_until",
      at: new Date(2026, 0, 5, 15, 0, 0, 0),
    });
  });

  it("agenda para o dia SEGUINTE quando a hora já passou", () => {
    const definicao = flow([{ kind: "wait_until", hour: 8 }, { kind: "end" }]);
    expect(advance(definicao, 0, contexto()).action).toEqual({
      type: "sleep_until",
      at: new Date(2026, 0, 6, 8, 0, 0, 0),
    });
  });

  it("na hora cheia exata, agenda para o dia seguinte", () => {
    const agora = new Date(2026, 0, 5, 15, 0, 0, 0);
    expect(nextOccurrenceOfHour(agora, 15)).toEqual(new Date(2026, 0, 6, 15, 0, 0, 0));
  });
});

describe("advance — branch resolvido no momento da execução", () => {
  it("cursor no branch segue o ramo escolhido pelo contexto", () => {
    const semResposta = advance(FLOW_COM_BRANCH, 1, contexto());
    expect(semResposta.action).toMatchObject({ type: "send", template: "follow-up" });

    const comResposta = advance(FLOW_COM_BRANCH, 1, contexto({ leadRepliedSinceStepStart: true }));
    expect(comResposta.action).toEqual({ type: "add_tag", tag: "respondeu" });
  });

  it("quando o lead responde no meio, o plano restante é recalculado", () => {
    // Sem resposta, o cursor 2 seria o notify_human do ramo ifNot…
    expect(advance(FLOW_COM_BRANCH, 2, contexto()).action).toEqual({
      type: "notify",
      message: "sem resposta",
    });
    // …mas se o lead respondeu, a expansão encurta e o cursor 2 já é o end.
    const ctx = contexto({ leadRepliedSinceStepStart: true });
    expect(advance(FLOW_COM_BRANCH, 2, ctx).action).toEqual({ type: "done" });
  });
});

describe("defaultCadenceFlow", () => {
  it("converte a cadência default em send/wait alternados terminando em end", () => {
    const templates = ["t1", "t2", "t3", "t4", "t5", "t6"];
    const resultado = defaultCadenceFlow(DEFAULT_CADENCE, templates);

    // intervals [0, 20, 180, 1440, 4320, 10080] → 6 sends, 5 waits (o 0 não gera wait) + end.
    expect(resultado.trigger).toEqual({ kind: "stage_entered" });
    expect(resultado.steps.map((s) => s.kind)).toEqual([
      "send_message",
      "wait",
      "send_message",
      "wait",
      "send_message",
      "wait",
      "send_message",
      "wait",
      "send_message",
      "wait",
      "send_message",
      "end",
    ]);
    expect(resultado.steps[0]).toMatchObject({ template: "t1" });
    expect(resultado.steps[1]).toEqual({ kind: "wait", minutes: 20 });
    expect(resultado.steps[10]).toMatchObject({ template: "t6" });
  });

  it("respeita maxTouches menor que a lista de intervalos", () => {
    const resultado = defaultCadenceFlow({ intervals: [0, 20, 180], maxTouches: 2 }, ["t1", "t2"]);
    expect(resultado.steps.map((s) => s.kind)).toEqual([
      "send_message",
      "wait",
      "send_message",
      "end",
    ]);
  });

  it("reutiliza o último template quando há mais toques que templates", () => {
    const resultado = defaultCadenceFlow({ intervals: [0, 20, 40], maxTouches: 3 }, ["t1"]);
    const sends = resultado.steps.filter((s) => s.kind === "send_message");
    expect(sends.map((s) => s.template)).toEqual(["t1", "t1", "t1"]);
  });

  it("usa o template de fallback quando não há template nenhum", () => {
    const resultado = defaultCadenceFlow({ intervals: [0], maxTouches: 1 }, []);
    expect(resultado.steps[0]).toMatchObject({ template: FALLBACK_CADENCE_TEMPLATE });
  });
});
