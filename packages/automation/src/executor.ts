import {
  isWithinActiveHours,
  nextActiveSlot,
  type ActiveHours,
  type Autonomy,
  type CadenceConfig,
} from "@vendaflow/core";
import type { FlowDefinition, FlowStep, SendChannel } from "./flow-types.js";

/**
 * Executor PURO de flows: dado (definição, cursor, contexto) decide a próxima
 * ação. Não persiste nem agenda nada — o worker aplica a StepAction, regrava
 * o cursor no AutomationRun e agenda o próximo tick.
 */

/** Contexto do run no momento do tick — montado pelo worker a partir do banco. */
export interface RunContext {
  /**
   * Lead respondeu desde a entrada no flow. Sinal monotônico: só muda de
   * false para true — é isso que torna a expansão de branches estável
   * (ver `expandSteps`).
   */
  leadRepliedSinceStepStart: boolean;
  leadOptedOut: boolean;
  aiPaused: boolean;
  autonomy: Autonomy;
  activeHours: ActiveHours;
  now: Date;
}

export type SendMode = "AUTO" | "DRAFT" | "APPROVAL";

/** Ação decidida pelo executor — o chamador executa o efeito. */
export type StepAction =
  | { type: "send"; channel: SendChannel; template: string; mode: SendMode }
  | { type: "sleep_until"; at: Date }
  | { type: "move_stage"; stageKey: string }
  | { type: "add_tag"; tag: string }
  | { type: "notify"; message: string }
  | { type: "done" }
  | { type: "cancelled"; reason: "opted_out" | "ai_paused" };

export interface AdvanceResult {
  action: StepAction;
  /** Cursor a persistir no AutomationRun para o próximo tick. */
  nextCursor: number;
}

/** Passo linear (sem branches), resultado da expansão para um run. */
export type LinearStep = Exclude<FlowStep, { kind: "branch_replied" }>;

/**
 * Deriva o modo de envio da autonomia — mesma regra de `computeNextTouch`
 * do core: AUTO envia, DRAFT gera rascunho, SEMI pede aprovação.
 */
export function sendModeForAutonomy(autonomy: Autonomy): SendMode {
  if (autonomy === "AUTO") return "AUTO";
  if (autonomy === "DRAFT") return "DRAFT";
  return "APPROVAL";
}

/**
 * Expande a árvore de passos numa lista LINEAR para este run — é sobre essa
 * lista que o cursor Int do AutomationRun anda.
 *
 * Semântica do branch (decisão pragmática, documentada):
 * - a decisão do `branch_replied` é tomada quando o cursor chega nele, usando
 *   `leadRepliedSinceStepStart` ("respondeu desde a entrada no flow");
 * - os passos do ramo escolhido SUBSTITUEM o branch na lista efetiva;
 * - como o sinal só muda de false→true, a expansão é estável enquanto o lead
 *   não responde; quando responde, os passos restantes são recalculados sobre
 *   a nova expansão — comportamento desejado (lead respondeu → muda o plano);
 * - branches devem ter no máximo 1 nível de profundidade nos flows do produto
 *   (a expansão até suporta aninhamento, mas ambos os níveis usariam o mesmo
 *   sinal de resposta).
 */
export function expandSteps(definition: FlowDefinition, replied: boolean): LinearStep[] {
  return flattenBranches(definition.steps, replied);
}

function flattenBranches(steps: FlowStep[], replied: boolean): LinearStep[] {
  return steps.flatMap((step) =>
    step.kind === "branch_replied"
      ? flattenBranches(replied ? step.ifReplied : step.ifNot, replied)
      : [step],
  );
}

/**
 * Decide a próxima ação do run. Determinística dado (definition, cursor, ctx).
 *
 * Regras:
 * - opt-out cancela SEMPRE, antes de qualquer passo;
 * - IA pausada cancela com razão própria (o worker pode retomar criando outro run);
 * - `send_message` fora do horário ativo vira `sleep_until` a próxima janela
 *   e o cursor NÃO avança (o mesmo passo reexecuta no acordar);
 * - `wait` soma minutos a partir de `ctx.now`;
 * - `wait_until` agenda a próxima ocorrência da hora local.
 */
export function advance(
  definition: FlowDefinition,
  cursor: number,
  ctx: RunContext,
): AdvanceResult {
  if (ctx.leadOptedOut) {
    return { action: { type: "cancelled", reason: "opted_out" }, nextCursor: cursor };
  }
  if (ctx.aiPaused) {
    return { action: { type: "cancelled", reason: "ai_paused" }, nextCursor: cursor };
  }

  const steps = expandSteps(definition, ctx.leadRepliedSinceStepStart);
  const step = steps[cursor];
  if (step === undefined || step.kind === "end") {
    return { action: { type: "done" }, nextCursor: cursor };
  }

  switch (step.kind) {
    case "send_message":
      return advanceSendMessage(step, cursor, ctx);
    case "wait":
      return {
        action: { type: "sleep_until", at: addMinutes(ctx.now, step.minutes) },
        nextCursor: cursor + 1,
      };
    case "wait_until":
      return {
        action: { type: "sleep_until", at: nextOccurrenceOfHour(ctx.now, step.hour) },
        nextCursor: cursor + 1,
      };
    case "move_stage":
      return { action: { type: "move_stage", stageKey: step.stageKey }, nextCursor: cursor + 1 };
    case "add_tag":
      return { action: { type: "add_tag", tag: step.tag }, nextCursor: cursor + 1 };
    case "notify_human":
      return { action: { type: "notify", message: step.message }, nextCursor: cursor + 1 };
  }
}

function advanceSendMessage(
  step: Extract<FlowStep, { kind: "send_message" }>,
  cursor: number,
  ctx: RunContext,
): AdvanceResult {
  if (!isWithinActiveHours(ctx.now, ctx.activeHours)) {
    // Fora do horário ativo: dorme até a próxima janela e repete o MESMO passo.
    return {
      action: { type: "sleep_until", at: nextActiveSlot(ctx.now, ctx.activeHours) },
      nextCursor: cursor,
    };
  }
  return {
    action: {
      type: "send",
      channel: step.channel,
      template: step.template,
      mode: sendModeForAutonomy(ctx.autonomy),
    },
    nextCursor: cursor + 1,
  };
}

function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * 60_000);
}

/**
 * Próxima ocorrência da hora local (minuto zero). Se `now` já passou da hora
 * — ou é exatamente a hora cheia — agenda para o dia seguinte.
 */
export function nextOccurrenceOfHour(now: Date, hour: number): Date {
  const at = new Date(now);
  at.setHours(hour, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/** Template usado quando a cadência tem mais toques do que templates. */
export const FALLBACK_CADENCE_TEMPLATE =
  "Oi, {nome}! Passando aqui rapidinho — ficou alguma dúvida que eu possa resolver?";

/**
 * Converte a cadência de um playbook num flow de send/wait alternados.
 * `intervals[i]` são minutos após o toque anterior (0 = envia já); toques
 * além da lista de templates reutilizam o último template disponível.
 */
export function defaultCadenceFlow(cadence: CadenceConfig, templates: string[]): FlowDefinition {
  const touches = Math.min(cadence.maxTouches, cadence.intervals.length);
  const steps: FlowStep[] = [];

  for (let touch = 0; touch < touches; touch++) {
    const interval = cadence.intervals[touch] ?? 0;
    if (interval > 0) steps.push({ kind: "wait", minutes: interval });
    steps.push({
      kind: "send_message",
      channel: "WHATSAPP",
      template: templateForTouch(templates, touch),
    });
  }
  steps.push({ kind: "end" });

  return { name: "Cadência do playbook", trigger: { kind: "stage_entered" }, steps };
}

function templateForTouch(templates: string[], touch: number): string {
  return templates[touch] ?? templates[templates.length - 1] ?? FALLBACK_CADENCE_TEMPLATE;
}
