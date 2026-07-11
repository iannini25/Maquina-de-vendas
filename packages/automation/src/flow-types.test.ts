import { describe, expect, it } from "vitest";
import {
  flowDefinitionSchema,
  flowStepSchema,
  flowTriggerSchema,
  type FlowDefinition,
} from "./flow-types.js";

describe("flowTriggerSchema", () => {
  it("aceita todos os gatilhos, com e sem campos opcionais", () => {
    const validos = [
      { kind: "stage_entered" },
      { kind: "stage_entered", stageKey: "novo-lead" },
      { kind: "lead_created" },
      { kind: "lead_created", source: "instagram" },
      { kind: "access_idle" },
      { kind: "access_active" },
      { kind: "order_paid" },
      { kind: "campaign_reminder" },
    ];
    for (const trigger of validos) {
      expect(flowTriggerSchema.safeParse(trigger).success).toBe(true);
    }
  });

  it("rejeita gatilho desconhecido", () => {
    expect(flowTriggerSchema.safeParse({ kind: "webhook" }).success).toBe(false);
  });
});

describe("flowStepSchema", () => {
  it("rejeita wait com minutos zero, negativos ou fracionados", () => {
    expect(flowStepSchema.safeParse({ kind: "wait", minutes: 0 }).success).toBe(false);
    expect(flowStepSchema.safeParse({ kind: "wait", minutes: -10 }).success).toBe(false);
    expect(flowStepSchema.safeParse({ kind: "wait", minutes: 1.5 }).success).toBe(false);
  });

  it("rejeita wait_until fora do intervalo 0..23", () => {
    expect(flowStepSchema.safeParse({ kind: "wait_until", hour: 24 }).success).toBe(false);
    expect(flowStepSchema.safeParse({ kind: "wait_until", hour: -1 }).success).toBe(false);
    expect(flowStepSchema.safeParse({ kind: "wait_until", hour: 0 }).success).toBe(true);
    expect(flowStepSchema.safeParse({ kind: "wait_until", hour: 23 }).success).toBe(true);
  });

  it("rejeita send_message com template vazio ou canal inválido", () => {
    expect(
      flowStepSchema.safeParse({ kind: "send_message", channel: "WHATSAPP", template: "" })
        .success,
    ).toBe(false);
    expect(
      flowStepSchema.safeParse({ kind: "send_message", channel: "SMS", template: "Oi" }).success,
    ).toBe(false);
  });

  it("valida branch_replied recursivo (branch dentro de branch)", () => {
    const aninhado = {
      kind: "branch_replied",
      ifReplied: [{ kind: "end" }],
      ifNot: [
        {
          kind: "branch_replied",
          ifReplied: [{ kind: "add_tag", tag: "respondeu" }],
          ifNot: [{ kind: "notify_human", message: "sem resposta" }],
        },
      ],
    };
    expect(flowStepSchema.safeParse(aninhado).success).toBe(true);
  });

  it("rejeita branch_replied sem os dois ramos", () => {
    expect(
      flowStepSchema.safeParse({ kind: "branch_replied", ifReplied: [{ kind: "end" }] }).success,
    ).toBe(false);
  });
});

describe("flowDefinitionSchema", () => {
  const definicao: FlowDefinition = {
    name: "Exemplo",
    trigger: { kind: "lead_created", source: "instagram" },
    steps: [
      { kind: "send_message", channel: "WHATSAPP", template: "Oi, {nome}!" },
      { kind: "wait", minutes: 20 },
      {
        kind: "branch_replied",
        ifReplied: [{ kind: "move_stage", stageKey: "em-conversa" }],
        ifNot: [{ kind: "notify_human", message: "Lead {nome} não respondeu" }],
      },
      { kind: "end" },
    ],
  };

  it("faz roundtrip de uma definição válida sem alterar nada", () => {
    expect(flowDefinitionSchema.parse(definicao)).toEqual(definicao);
  });

  it("rejeita definição sem passos ou sem nome", () => {
    expect(
      flowDefinitionSchema.safeParse({ ...definicao, steps: [] }).success,
    ).toBe(false);
    expect(flowDefinitionSchema.safeParse({ ...definicao, name: "" }).success).toBe(false);
  });
});
