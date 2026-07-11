import { describe, expect, it } from "vitest";

import {
  computeHandback,
  computeHumanTakeover,
  computeStageChange,
  scoreToTemperature,
  type StageRef,
} from "./funnel.js";

const stage = (overrides: Partial<StageRef> & { id: string }): StageRef => ({
  name: overrides.id,
  isFixed: false,
  systemKey: null,
  ...overrides,
});

describe("computeStageChange", () => {
  it("não gera efeito quando origem = destino", () => {
    const s = stage({ id: "a" });
    const result = computeStageChange({ leadId: "l1", from: s, to: s, movedBy: "HUMAN" });
    expect(result.effects).toHaveLength(0);
  });

  it("cancela runs, emite evento, publica SSE e inicia automação do novo estágio", () => {
    const result = computeStageChange({
      leadId: "l1",
      from: stage({ id: "a" }),
      to: stage({ id: "b", toastText: "a IA agora vai qualificar" }),
      movedBy: "HUMAN",
    });
    const kinds = result.effects.map((e) => e.kind);
    expect(kinds).toEqual([
      "cancel_automation_runs",
      "emit_event",
      "publish_sse",
      "start_stage_automation",
    ]);
    expect(result.toastText).toBe("a IA agora vai qualificar");
  });

  it("registra quem moveu (HUMAN | AI | AUTOMATION) no evento", () => {
    for (const movedBy of ["HUMAN", "AI", "AUTOMATION"] as const) {
      const result = computeStageChange({
        leadId: "l1",
        from: stage({ id: "a" }),
        to: stage({ id: "b" }),
        movedBy,
      });
      const emit = result.effects.find((e) => e.kind === "emit_event");
      expect(emit && emit.kind === "emit_event" && emit.event.type === "lead.stage_changed"
        ? emit.event.movedBy
        : null).toBe(movedBy);
    }
  });

  it("mover para Ganho dispara order + acesso + pós-venda e NÃO inicia cadência", () => {
    const result = computeStageChange({
      leadId: "l1",
      from: stage({ id: "a" }),
      to: stage({ id: "won", systemKey: "WON", isFixed: true }),
      movedBy: "AI",
    });
    const kinds = result.effects.map((e) => e.kind);
    expect(kinds).toContain("create_order_from_deal");
    expect(kinds).toContain("grant_access");
    expect(kinds).toContain("schedule_post_sale");
    expect(kinds).not.toContain("start_stage_automation");
  });

  it("mover para Perdido só cancela e registra — sem nova automação", () => {
    const result = computeStageChange({
      leadId: "l1",
      from: stage({ id: "a" }),
      to: stage({ id: "lost", systemKey: "LOST", isFixed: true }),
      movedBy: "HUMAN",
      reason: "sem orçamento",
    });
    const kinds = result.effects.map((e) => e.kind);
    expect(kinds).not.toContain("start_stage_automation");
    expect(kinds).not.toContain("grant_access");
  });

  it("gera toast padrão quando o estágio não define texto", () => {
    const result = computeStageChange({
      leadId: "l1",
      from: stage({ id: "a" }),
      to: stage({ id: "b", name: "Qualificado" }),
      movedBy: "HUMAN",
    });
    expect(result.toastText).toContain("Qualificado");
  });
});

describe("handoff", () => {
  it("takeover pausa automação e publica estado HUMAN", () => {
    const effects = computeHumanTakeover("l1", "c1", "u1");
    expect(effects.map((e) => e.kind)).toEqual([
      "pause_automation_runs",
      "emit_event",
      "publish_sse",
    ]);
  });

  it("handback retoma automação e publica estado BOT", () => {
    const effects = computeHandback("l1", "c1", "u1");
    expect(effects[0]?.kind).toBe("resume_automation_runs");
  });
});

describe("scoreToTemperature", () => {
  it("mapeia score para temperatura", () => {
    expect(scoreToTemperature(0)).toBe("COLD");
    expect(scoreToTemperature(39)).toBe("COLD");
    expect(scoreToTemperature(40)).toBe("WARM");
    expect(scoreToTemperature(69)).toBe("WARM");
    expect(scoreToTemperature(70)).toBe("HOT");
    expect(scoreToTemperature(100)).toBe("HOT");
  });
});
