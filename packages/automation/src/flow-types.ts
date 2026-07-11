import { z } from "zod";

/**
 * Definição de flows de automação — dados puros, serializáveis em JSON.
 * Este pacote só decide "o que fazer agora"; quem persiste e agenda é o
 * worker/web (AutomationFlow.definition guarda um FlowDefinition validado
 * por `flowDefinitionSchema`).
 */

/** Canal suportado pelos passos de envio de mensagem. */
export type SendChannel = "WHATSAPP" | "EMAIL";

/** Gatilho que inicia um flow. */
export type FlowTrigger =
  | { kind: "stage_entered"; stageKey?: string }
  | { kind: "lead_created"; source?: string }
  | { kind: "access_idle" }
  | { kind: "access_active" }
  | { kind: "order_paid" }
  | { kind: "campaign_reminder" };

/**
 * Passo de um flow (union discriminada por `kind`).
 *
 * - `send_message.template` usa variáveis entre chaves ({nome}, {produto}…)
 *   resolvidas pelo chamador na hora do envio.
 * - `wait_until.hour` é a próxima ocorrência da hora LOCAL (0–23).
 * - `branch_replied` ramifica pela resposta do lead; a decisão acontece
 *   quando o cursor chega no branch (ver `expandSteps` em executor.ts).
 */
export type FlowStep =
  | { kind: "send_message"; channel: SendChannel; template: string }
  | { kind: "wait"; minutes: number }
  | { kind: "wait_until"; hour: number }
  | { kind: "move_stage"; stageKey: string }
  | { kind: "add_tag"; tag: string }
  | { kind: "notify_human"; message: string }
  | { kind: "branch_replied"; ifReplied: FlowStep[]; ifNot: FlowStep[] }
  | { kind: "end" };

export interface FlowDefinition {
  name: string;
  trigger: FlowTrigger;
  steps: FlowStep[];
}

export const flowTriggerSchema: z.ZodType<FlowTrigger> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stage_entered"), stageKey: z.string().min(1).optional() }),
  z.object({ kind: z.literal("lead_created"), source: z.string().min(1).optional() }),
  z.object({ kind: z.literal("access_idle") }),
  z.object({ kind: z.literal("access_active") }),
  z.object({ kind: z.literal("order_paid") }),
  z.object({ kind: z.literal("campaign_reminder") }),
]);

/** Schema recursivo: `branch_replied` contém listas de FlowStep (z.lazy). */
export const flowStepSchema: z.ZodType<FlowStep> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("send_message"),
      channel: z.enum(["WHATSAPP", "EMAIL"]),
      template: z.string().min(1),
    }),
    z.object({ kind: z.literal("wait"), minutes: z.number().int().positive() }),
    z.object({ kind: z.literal("wait_until"), hour: z.number().int().min(0).max(23) }),
    z.object({ kind: z.literal("move_stage"), stageKey: z.string().min(1) }),
    z.object({ kind: z.literal("add_tag"), tag: z.string().min(1) }),
    z.object({ kind: z.literal("notify_human"), message: z.string().min(1) }),
    z.object({
      kind: z.literal("branch_replied"),
      ifReplied: z.array(flowStepSchema),
      ifNot: z.array(flowStepSchema),
    }),
    z.object({ kind: z.literal("end") }),
  ]),
);

export const flowDefinitionSchema: z.ZodType<FlowDefinition> = z.object({
  name: z.string().min(1),
  trigger: flowTriggerSchema,
  steps: z.array(flowStepSchema).min(1),
});
