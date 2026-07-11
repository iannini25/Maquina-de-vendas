import type { Autonomy, CadenceConfig } from "./stages.js";

/**
 * Regras de cadência ("encher o saco" com respeito):
 * - intervalos em minutos a partir da entrada no estágio/último toque
 * - máximo de toques
 * - só dentro do horário ativo da persona
 * - opt-out interrompe imediatamente
 * - autonomia DRAFT/SEMI vira rascunho/Approval em vez de envio
 */

export interface ActiveHours {
  /** "08:00" */
  start: string;
  /** "21:00" */
  end: string;
  /** 0=domingo … 6=sábado */
  days: number[];
}

export interface CadenceState {
  touchesSent: number;
  /** Momento do último toque (ou entrada no estágio se nenhum). */
  anchorAt: Date;
  leadOptedOut: boolean;
  /** Lead respondeu depois do último toque — cadência pendente é cancelada. */
  leadRepliedSinceAnchor: boolean;
}

export type NextTouch =
  | { action: "stop"; reason: "opted_out" | "exhausted" | "lead_replied" | "no_cadence" }
  | { action: "wait"; runAt: Date }
  | { action: "send"; mode: "AUTO" | "DRAFT" | "APPROVAL"; touchIndex: number };

function parseHHMM(value: string): { h: number; m: number } {
  const [h = 0, m = 0] = value.split(":").map(Number);
  return { h, m };
}

export function isWithinActiveHours(at: Date, hours: ActiveHours): boolean {
  if (!hours.days.includes(at.getDay())) return false;
  const { h: sh, m: sm } = parseHHMM(hours.start);
  const { h: eh, m: em } = parseHHMM(hours.end);
  const minutes = at.getHours() * 60 + at.getMinutes();
  return minutes >= sh * 60 + sm && minutes <= eh * 60 + em;
}

/** Próxima janela válida dentro do horário ativo (>= at). */
export function nextActiveSlot(at: Date, hours: ActiveHours): Date {
  const candidate = new Date(at);
  for (let i = 0; i < 8 * 24 * 4; i++) {
    if (isWithinActiveHours(candidate, hours)) return candidate;
    candidate.setMinutes(candidate.getMinutes() + 15, 0, 0);
  }
  return at; // horário ativo inválido — não trava o sistema
}

export function computeNextTouch(
  cadence: CadenceConfig,
  state: CadenceState,
  autonomy: Autonomy,
  activeHours: ActiveHours,
  now: Date,
): NextTouch {
  if (state.leadOptedOut) return { action: "stop", reason: "opted_out" };
  if (state.leadRepliedSinceAnchor) return { action: "stop", reason: "lead_replied" };
  if (cadence.intervals.length === 0 || cadence.maxTouches === 0) {
    return { action: "stop", reason: "no_cadence" };
  }
  if (state.touchesSent >= Math.min(cadence.maxTouches, cadence.intervals.length)) {
    return { action: "stop", reason: "exhausted" };
  }

  const intervalMin = cadence.intervals[state.touchesSent];
  if (intervalMin === undefined) return { action: "stop", reason: "exhausted" };

  const dueAt = new Date(state.anchorAt.getTime() + intervalMin * 60_000);
  const runAt = nextActiveSlot(dueAt, activeHours);

  if (runAt.getTime() > now.getTime()) {
    return { action: "wait", runAt };
  }

  const mode = autonomy === "AUTO" ? "AUTO" : autonomy === "DRAFT" ? "DRAFT" : "APPROVAL";
  return { action: "send", mode, touchIndex: state.touchesSent };
}

/** Janela de silêncio: verdade se o lead está sem interação há mais de `days` dias. */
export function isSilentFor(lastInteractionAt: Date | null, days: number, now: Date): boolean {
  if (!lastInteractionAt) return true;
  return now.getTime() - lastInteractionAt.getTime() >= days * 86_400_000;
}

export const DEFAULT_ACTIVE_HOURS: ActiveHours = {
  start: "08:00",
  end: "21:00",
  days: [1, 2, 3, 4, 5, 6],
};
