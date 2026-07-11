import type { TransitionEffect } from "./events.js";
import type { StageSystemKey } from "./stages.js";

/**
 * Máquina de estados do funil: computa os efeitos de uma transição de estágio.
 * Pura — não toca banco nem rede; o chamador (web/worker) executa os efeitos.
 */

export interface StageRef {
  id: string;
  name: string;
  systemKey?: StageSystemKey | null;
  isFixed: boolean;
  toastText?: string;
}

export interface StageChangeInput {
  leadId: string;
  from: StageRef;
  to: StageRef;
  movedBy: "HUMAN" | "AI" | "AUTOMATION";
  reason?: string;
  /** Valor do deal aberto do lead, se houver — usado ao ganhar. */
  openDealValueCents?: number;
}

export interface StageChangeResult {
  effects: TransitionEffect[];
  /** Texto do toast a exibir na UI ("a IA agora vai …"). */
  toastText: string;
}

export function computeStageChange(input: StageChangeInput): StageChangeResult {
  const { leadId, from, to, movedBy, reason } = input;

  if (from.id === to.id) {
    return { effects: [], toastText: "" };
  }

  const effects: TransitionEffect[] = [
    { kind: "cancel_automation_runs", leadId },
    {
      kind: "emit_event",
      event: {
        type: "lead.stage_changed",
        leadId,
        fromStageId: from.id,
        toStageId: to.id,
        movedBy,
        reason,
      },
    },
    {
      kind: "publish_sse",
      channel: "pipeline",
      payload: { leadId, fromStageId: from.id, toStageId: to.id, movedBy },
    },
  ];

  const toastText =
    to.toastText ?? `lead movido para ${to.name} — playbook do estágio ativado`;

  if (to.systemKey === "WON") {
    effects.push(
      { kind: "create_order_from_deal", leadId },
      { kind: "grant_access", leadId },
      { kind: "schedule_post_sale", leadId },
    );
    return { effects, toastText };
  }

  if (to.systemKey === "LOST") {
    // Perdido: sem nova automação; cadências já canceladas acima.
    return { effects, toastText };
  }

  effects.push({ kind: "start_stage_automation", leadId, stageId: to.id });
  return { effects, toastText };
}

/** Handoff humano: pausa automação do lead. */
export function computeHumanTakeover(leadId: string, conversationId: string, userId: string): TransitionEffect[] {
  return [
    { kind: "pause_automation_runs", leadId, reason: "human_takeover" },
    {
      kind: "emit_event",
      event: { type: "conversation.human_takeover", leadId, conversationId, userId },
    },
    {
      kind: "publish_sse",
      channel: "inbox",
      payload: { conversationId, state: "HUMAN" },
    },
  ];
}

/** Devolução para a IA: retoma automação. */
export function computeHandback(leadId: string, conversationId: string, userId: string): TransitionEffect[] {
  return [
    { kind: "resume_automation_runs", leadId },
    {
      kind: "emit_event",
      event: { type: "conversation.handback", leadId, conversationId, userId },
    },
    {
      kind: "publish_sse",
      channel: "inbox",
      payload: { conversationId, state: "BOT" },
    },
  ];
}

export function scoreToTemperature(score: number): "COLD" | "WARM" | "HOT" {
  if (score >= 70) return "HOT";
  if (score >= 40) return "WARM";
  return "COLD";
}
