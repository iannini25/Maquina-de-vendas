import { describe, expect, it } from "vitest";

import {
  computeNextTouch,
  DEFAULT_ACTIVE_HOURS,
  isSilentFor,
  isWithinActiveHours,
  nextActiveSlot,
  type CadenceState,
} from "./cadence.js";
import { DEFAULT_CADENCE } from "./stages.js";

// Terça-feira, 14:00 local
const NOW = new Date(2026, 6, 7, 14, 0, 0);

const baseState = (overrides: Partial<CadenceState> = {}): CadenceState => ({
  touchesSent: 0,
  anchorAt: NOW,
  leadOptedOut: false,
  leadRepliedSinceAnchor: false,
  ...overrides,
});

describe("computeNextTouch", () => {
  it("opt-out interrompe imediatamente", () => {
    const result = computeNextTouch(
      DEFAULT_CADENCE,
      baseState({ leadOptedOut: true }),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      NOW,
    );
    expect(result).toEqual({ action: "stop", reason: "opted_out" });
  });

  it("resposta do lead cancela cadência pendente", () => {
    const result = computeNextTouch(
      DEFAULT_CADENCE,
      baseState({ leadRepliedSinceAnchor: true }),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      NOW,
    );
    expect(result).toEqual({ action: "stop", reason: "lead_replied" });
  });

  it("para quando o máximo de toques foi atingido", () => {
    const result = computeNextTouch(
      DEFAULT_CADENCE,
      baseState({ touchesSent: 6 }),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      NOW,
    );
    expect(result).toEqual({ action: "stop", reason: "exhausted" });
  });

  it("T+0 dentro do horário ativo envia direto no modo AUTO", () => {
    const result = computeNextTouch(
      DEFAULT_CADENCE,
      baseState(),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      NOW,
    );
    expect(result).toEqual({ action: "send", mode: "AUTO", touchIndex: 0 });
  });

  it("DRAFT gera rascunho; SEMI gera aprovação", () => {
    expect(
      computeNextTouch(DEFAULT_CADENCE, baseState(), "DRAFT", DEFAULT_ACTIVE_HOURS, NOW),
    ).toMatchObject({ action: "send", mode: "DRAFT" });
    expect(
      computeNextTouch(DEFAULT_CADENCE, baseState(), "SEMI", DEFAULT_ACTIVE_HOURS, NOW),
    ).toMatchObject({ action: "send", mode: "APPROVAL" });
  });

  it("segundo toque espera o intervalo de 20min", () => {
    const result = computeNextTouch(
      DEFAULT_CADENCE,
      baseState({ touchesSent: 1, anchorAt: NOW }),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      NOW,
    );
    expect(result.action).toBe("wait");
    if (result.action === "wait") {
      expect(result.runAt.getTime()).toBe(NOW.getTime() + 20 * 60_000);
    }
  });

  it("toque fora do horário ativo é adiado para a próxima janela", () => {
    const lateNight = new Date(2026, 6, 7, 23, 30, 0);
    const result = computeNextTouch(
      DEFAULT_CADENCE,
      baseState({ anchorAt: lateNight }),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      lateNight,
    );
    expect(result.action).toBe("wait");
    if (result.action === "wait") {
      expect(isWithinActiveHours(result.runAt, DEFAULT_ACTIVE_HOURS)).toBe(true);
      expect(result.runAt.getTime()).toBeGreaterThan(lateNight.getTime());
    }
  });

  it("cadência vazia = sem toques", () => {
    const result = computeNextTouch(
      { intervals: [], maxTouches: 0 },
      baseState(),
      "AUTO",
      DEFAULT_ACTIVE_HOURS,
      NOW,
    );
    expect(result).toEqual({ action: "stop", reason: "no_cadence" });
  });
});

describe("horário ativo", () => {
  it("domingo está fora do horário padrão", () => {
    const sunday = new Date(2026, 6, 5, 10, 0, 0);
    expect(isWithinActiveHours(sunday, DEFAULT_ACTIVE_HOURS)).toBe(false);
    const slot = nextActiveSlot(sunday, DEFAULT_ACTIVE_HOURS);
    expect(slot.getDay()).toBe(1);
  });
});

describe("isSilentFor", () => {
  it("sem interação nunca = silêncio", () => {
    expect(isSilentFor(null, 3, NOW)).toBe(true);
  });
  it("interação recente não é silêncio", () => {
    const yesterday = new Date(NOW.getTime() - 86_400_000);
    expect(isSilentFor(yesterday, 3, NOW)).toBe(false);
    const fourDaysAgo = new Date(NOW.getTime() - 4 * 86_400_000);
    expect(isSilentFor(fourDaysAgo, 3, NOW)).toBe(true);
  });
});
