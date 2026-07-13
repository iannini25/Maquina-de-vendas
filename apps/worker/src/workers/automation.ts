import {
  advance,
  defaultCadenceFlow,
  flowDefinitionSchema,
  type FlowDefinition,
  type RunContext,
  type StepAction,
} from "@sales4u/automation";
import type { ActiveHours, Autonomy, CadenceConfig } from "@sales4u/core";
import { NotImplementedYetError } from "../errors.js";
import {
  AUTOMATION_JOBS,
  automationJobSchema,
  type AutomationJobPayload,
  type EmailJobPayload,
  type OutboundJobPayload,
} from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "automation" — motor de AutomationRuns.
 * Lógica pura com dependências injetadas (testável com fakes); o wiring real
 * (prisma, filas BullMQ, SSE) está em automation.wiring.ts e é carregado sob
 * demanda apenas quando nenhuma dependência é injetada.
 *
 * O laço do flow acontece VIA FILA: cada passo executa, regrava o cursor e
 * re-enfileira o próximo job (delay 0 ou o delay do sleep) — nunca while
 * infinito dentro do processo.
 */

// ── Contratos das dependências ─────────────────────────────────────────────

/** Estados possíveis do AutomationRun (espelha RunState do prisma). */
export type AutomationRunState = "RUNNING" | "PAUSED" | "DONE" | "CANCELLED";

/** Visão do run + flow + lead carregada num único acesso ao banco. */
export interface AutomationRunSnapshot {
  run: {
    id: string;
    cursor: number;
    state: AutomationRunState;
    createdAt: Date;
    /** Âncora do "lead respondeu desde o passo atual" (fallback: createdAt). */
    updatedAt: Date | null;
  };
  flow: {
    id: string;
    name: string;
    isActive: boolean;
    trigger: unknown;
    steps: unknown;
  };
  lead: {
    id: string;
    name: string;
    email: string | null;
    optedOut: boolean;
    aiStatus: "RUNNING" | "WAITING_HUMAN" | "PAUSED";
    stageId: string;
  };
}

/** Campos regraváveis do AutomationRun ao fim de um passo. */
export interface RunUpdate {
  cursor?: number;
  state?: AutomationRunState;
  nextRunAt?: Date | null;
  pausedReason?: string | null;
}

/** Política do estágio atual do lead (playbook + persona). */
export interface StagePolicy {
  autonomy: Autonomy;
  activeHours: ActiveHours;
}

export interface AutomationDeps {
  log: Log;
  /** Relógio injetável (testes); padrão: new Date(). */
  now?: () => Date;
  loadRun(workspaceId: string, runId: string): Promise<AutomationRunSnapshot | null>;
  loadStagePolicy(workspaceId: string, stageId: string): Promise<StagePolicy>;
  /** Existe Message IN do lead criada depois de `since`? */
  hasLeadRepliedSince(workspaceId: string, leadId: string, since: Date): Promise<boolean>;
  /** Vars reais de template: {nome},{produto},{valor},{link_acesso}. */
  buildVars(workspaceId: string, leadId: string): Promise<Record<string, string>>;
  /**
   * Cria a Message OUT (AI, QUEUED) na conversa WhatsApp do lead.
   * Retorna null quando não há conversa utilizável (ex.: em atendimento HUMAN).
   */
  createWhatsAppMessage(
    workspaceId: string,
    leadId: string,
    text: string,
  ): Promise<{ conversationId: string; messageId: string } | null>;
  enqueueOutbound(payload: OutboundJobPayload): Promise<void>;
  enqueueEmail(payload: EmailJobPayload): Promise<void>;
  createApproval(input: {
    workspaceId: string;
    leadId: string;
    kind: "MESSAGE_DRAFT" | "BULK_OUTREACH";
    payload: Record<string, unknown>;
  }): Promise<void>;
  /** Mudança de estágio canônica (applyStageChange, movedBy AUTOMATION). */
  moveStage(input: { workspaceId: string; leadId: string; stageKey: string }): Promise<void>;
  /** Adiciona tag ao lead com dedupe. */
  addLeadTag(workspaceId: string, leadId: string, tag: string): Promise<void>;
  /** Notifica o humano: SSE notify + EventLog. */
  notifyHuman(input: {
    workspaceId: string;
    leadId: string;
    runId: string;
    message: string;
  }): Promise<void>;
  updateRun(runId: string, update: RunUpdate): Promise<void>;
  enqueueRunStep(payload: AutomationJobPayload, delayMs: number): Promise<void>;
}

// ── Factory (mesma assinatura registrada em workers/index.ts) ──────────────

export interface AutomationProcessorOptions {
  log: Log;
  /** Injetável em testes; ausente ⇒ wiring real carregado sob demanda. */
  deps?: AutomationDeps;
}

/** Cria o processor da fila "automation". */
export function createAutomationProcessor(options: AutomationProcessorOptions): JobProcessor {
  let deps = options.deps;
  const resolveDeps = async (): Promise<AutomationDeps> => {
    if (!deps) {
      const wiring = await import("./automation.wiring.js");
      deps = wiring.createAutomationDeps(options.log);
    }
    return deps;
  };

  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case AUTOMATION_JOBS.runStep: {
        const payload = automationJobSchema.parse(job.data);
        return runStep(await resolveDeps(), payload);
      }
      default:
        throw new NotImplementedYetError("automation", job.name);
    }
  };
}

// ── Execução de um passo ───────────────────────────────────────────────────

/** Executa o passo atual do run e agenda o próximo tick via fila. */
export async function runStep(deps: AutomationDeps, payload: AutomationJobPayload): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const snapshot = await deps.loadRun(payload.workspaceId, payload.runId);
  if (!snapshot) {
    deps.log.warn({ ...payload }, "run de automação não encontrado — nada a fazer");
    return;
  }

  const exec: StepExecution = { deps, payload, snapshot, now };
  if (await applyGuards(exec)) return;

  const definition = parseDefinition(snapshot.flow);
  if (!definition) {
    deps.log.error({ ...payload, flowId: snapshot.flow.id }, "definição de flow inválida — run cancelado");
    await deps.updateRun(snapshot.run.id, {
      state: "CANCELLED",
      pausedReason: "definicao_invalida",
      nextRunAt: null,
    });
    return;
  }

  const ctx = await buildRunContext(exec);
  const { action, nextCursor } = advance(definition, snapshot.run.cursor, ctx);
  await executeAction(exec, definition, action, nextCursor);
}

interface StepExecution {
  deps: AutomationDeps;
  payload: AutomationJobPayload;
  snapshot: AutomationRunSnapshot;
  now: Date;
}

/** Guardas que encerram o job sem erro. Retorna true quando o run não deve seguir. */
async function applyGuards(exec: StepExecution): Promise<boolean> {
  const { deps, payload, snapshot } = exec;
  if (snapshot.run.state !== "RUNNING") {
    deps.log.info({ ...payload, state: snapshot.run.state }, "run não está RUNNING — nada a fazer");
    return true;
  }
  if (snapshot.lead.optedOut) {
    await cancelRun(exec, "opted_out");
    return true;
  }
  if (snapshot.lead.aiStatus === "PAUSED") {
    await cancelRun(exec, "ai_paused");
    return true;
  }
  return false;
}

async function buildRunContext(exec: StepExecution): Promise<RunContext> {
  const { deps, payload, snapshot, now } = exec;
  const since = snapshot.run.updatedAt ?? snapshot.run.createdAt;
  const [policy, replied] = await Promise.all([
    deps.loadStagePolicy(payload.workspaceId, snapshot.lead.stageId),
    deps.hasLeadRepliedSince(payload.workspaceId, snapshot.lead.id, since),
  ]);
  return {
    leadRepliedSinceStepStart: replied,
    leadOptedOut: snapshot.lead.optedOut,
    aiPaused: snapshot.lead.aiStatus === "PAUSED",
    autonomy: policy.autonomy,
    activeHours: policy.activeHours,
    now,
  };
}

async function executeAction(
  exec: StepExecution,
  definition: FlowDefinition,
  action: StepAction,
  nextCursor: number,
): Promise<void> {
  const { deps, payload, snapshot, now } = exec;
  switch (action.type) {
    case "send":
      await executeSend(exec, definition, action);
      return continueRun(exec, nextCursor);
    case "sleep_until": {
      await deps.updateRun(snapshot.run.id, { cursor: nextCursor, nextRunAt: action.at });
      await deps.enqueueRunStep(payload, Math.max(0, action.at.getTime() - now.getTime()));
      return;
    }
    case "move_stage":
      await deps.moveStage({
        workspaceId: payload.workspaceId,
        leadId: snapshot.lead.id,
        stageKey: action.stageKey,
      });
      return continueRun(exec, nextCursor);
    case "add_tag":
      await deps.addLeadTag(payload.workspaceId, snapshot.lead.id, action.tag);
      return continueRun(exec, nextCursor);
    case "notify": {
      const vars = await buildVarsWithName(exec);
      await deps.notifyHuman({
        workspaceId: payload.workspaceId,
        leadId: snapshot.lead.id,
        runId: snapshot.run.id,
        message: renderTemplate(action.message, vars),
      });
      return continueRun(exec, nextCursor);
    }
    case "done":
      await deps.updateRun(snapshot.run.id, { state: "DONE", cursor: nextCursor, nextRunAt: null });
      deps.log.info({ ...payload }, "run de automação concluído");
      return;
    case "cancelled":
      return cancelRun(exec, action.reason);
  }
}

async function executeSend(
  exec: StepExecution,
  definition: FlowDefinition,
  action: Extract<StepAction, { type: "send" }>,
): Promise<void> {
  const { deps, payload, snapshot } = exec;
  const vars = await buildVarsWithName(exec);
  const text = renderTemplate(action.template, vars);

  if (action.mode !== "AUTO") {
    const kind = action.mode === "DRAFT" ? "MESSAGE_DRAFT" : "BULK_OUTREACH";
    await deps.createApproval({
      workspaceId: payload.workspaceId,
      leadId: snapshot.lead.id,
      kind,
      payload: {
        text,
        channel: action.channel,
        mode: action.mode,
        runId: snapshot.run.id,
        flowName: definition.name,
      },
    });
    return;
  }

  if (action.channel === "EMAIL") return sendEmailStep(exec, definition, text, vars);
  return sendWhatsAppStep(exec, text);
}

async function sendWhatsAppStep(exec: StepExecution, text: string): Promise<void> {
  const { deps, payload, snapshot } = exec;
  const created = await deps.createWhatsAppMessage(payload.workspaceId, snapshot.lead.id, text);
  if (!created) {
    deps.log.info(
      { ...payload, leadId: snapshot.lead.id },
      "sem conversa WhatsApp utilizável — passo de envio pulado",
    );
    return;
  }
  await deps.enqueueOutbound({
    workspaceId: payload.workspaceId,
    conversationId: created.conversationId,
    messageId: created.messageId,
    kind: "TEXT",
    payload: { text },
  });
}

async function sendEmailStep(
  exec: StepExecution,
  definition: FlowDefinition,
  text: string,
  vars: Record<string, string>,
): Promise<void> {
  const { deps, payload, snapshot } = exec;
  if (!snapshot.lead.email) {
    deps.log.info(
      { ...payload, leadId: snapshot.lead.id },
      "lead sem e-mail — passo de e-mail pulado",
    );
    return;
  }
  await deps.enqueueEmail({
    workspaceId: payload.workspaceId,
    to: snapshot.lead.email,
    subject: emailSubject(definition, vars),
    html: textToHtml(text),
  });
}

/** Regrava o cursor e re-enfileira o próximo passo imediatamente (delay 0). */
async function continueRun(exec: StepExecution, nextCursor: number): Promise<void> {
  await exec.deps.updateRun(exec.snapshot.run.id, { cursor: nextCursor });
  await exec.deps.enqueueRunStep(exec.payload, 0);
}

async function cancelRun(exec: StepExecution, reason: "opted_out" | "ai_paused"): Promise<void> {
  const { deps, payload, snapshot } = exec;
  const update: RunUpdate =
    reason === "opted_out"
      ? { state: "CANCELLED", pausedReason: "opted_out", nextRunAt: null }
      : { state: "PAUSED", pausedReason: "ai_paused", nextRunAt: null };
  await deps.updateRun(snapshot.run.id, update);
  deps.log.info({ ...payload, reason }, "run de automação interrompido");
}

async function buildVarsWithName(exec: StepExecution): Promise<Record<string, string>> {
  const vars = await exec.deps.buildVars(exec.payload.workspaceId, exec.snapshot.lead.id);
  return { nome: firstName(exec.snapshot.lead.name), ...vars };
}

function parseDefinition(flow: AutomationRunSnapshot["flow"]): FlowDefinition | null {
  const parsed = flowDefinitionSchema.safeParse({
    name: flow.name,
    trigger: flow.trigger,
    steps: flow.steps,
  });
  return parsed.success ? parsed.data : null;
}

function emailSubject(definition: FlowDefinition, vars: Record<string, string>): string {
  const produto = vars.produto;
  return produto && produto.length > 0 ? `Sobre ${produto}` : definition.name;
}

// ── Instanciação por estágio (trigger stage_entered) ───────────────────────

/** Templates default (PT-BR) usados quando o workspace não define os seus. */
export const DEFAULT_CADENCE_TEMPLATES: readonly string[] = [
  "Oi, {nome}! Aqui é do {produto}. Vi seu interesse e quero te ajudar a dar o próximo passo. Posso te contar rapidinho como funciona?",
  "{nome}, ficou alguma dúvida sobre o {produto}? Me manda aqui que eu resolvo com você — sem compromisso.",
  "Passando para não te deixar sem resposta, {nome}. Se fizer sentido retomar sobre o {produto}, é só mandar um oi por aqui.",
];

/** Semente para gerar o flow default de cadência de um estágio. */
export interface StageAutomationSeed {
  cadence: CadenceConfig;
  /** settings.cadenceTemplates do workspace (vazio ⇒ defaults). */
  templates: string[];
  /** Chave do estágio para o trigger do flow gerado (ex.: "novo-lead"). */
  stageKey?: string;
}

export interface EnsureStageAutomationDeps {
  log: Log;
  /** Flow ativo com trigger stage_entered aplicável ao estágio. */
  findStageEnteredFlow(workspaceId: string, stageId: string): Promise<{ flowId: string } | null>;
  /** Lead já tem run RUNNING/PAUSED deste flow? */
  hasActiveRun(flowId: string, leadId: string): Promise<boolean>;
  /** Cadência do playbook + templates do workspace; null quando não há playbook. */
  loadCadenceSeed(workspaceId: string, stageId: string): Promise<StageAutomationSeed | null>;
  createFlow(workspaceId: string, definition: FlowDefinition): Promise<{ flowId: string }>;
  createRun(flowId: string, leadId: string): Promise<{ runId: string }>;
  enqueueRunStep(payload: AutomationJobPayload, delayMs: number): Promise<void>;
}

/**
 * Garante a automação de entrada no estágio para um lead:
 * usa o flow explícito (trigger stage_entered) se existir; senão gera na hora
 * um flow default a partir da cadência do playbook. Cria o AutomationRun
 * RUNNING (cursor 0) e enfileira o primeiro run-step.
 * Retorna null quando não há nada a instanciar (sem cadência ou run já ativo).
 */
export async function ensureStageAutomation(
  deps: EnsureStageAutomationDeps,
  input: { workspaceId: string; leadId: string; stageId: string },
): Promise<{ flowId: string; runId: string } | null> {
  const existing = await deps.findStageEnteredFlow(input.workspaceId, input.stageId);

  let flowId: string;
  if (existing) {
    if (await deps.hasActiveRun(existing.flowId, input.leadId)) {
      deps.log.info(
        { ...input, flowId: existing.flowId },
        "lead já possui run ativo do flow do estágio — nada a instanciar",
      );
      return null;
    }
    flowId = existing.flowId;
  } else {
    const seed = await deps.loadCadenceSeed(input.workspaceId, input.stageId);
    const touches = seed ? Math.min(seed.cadence.maxTouches, seed.cadence.intervals.length) : 0;
    if (!seed || touches === 0) {
      deps.log.info({ ...input }, "estágio sem flow explícito e sem cadência — automação não instanciada");
      return null;
    }
    const created = await deps.createFlow(input.workspaceId, buildCadenceDefinition(seed));
    flowId = created.flowId;
  }

  const { runId } = await deps.createRun(flowId, input.leadId);
  await deps.enqueueRunStep({ workspaceId: input.workspaceId, runId }, 0);
  deps.log.info({ ...input, flowId, runId }, "automação do estágio instanciada");
  return { flowId, runId };
}

/** Converte a semente do playbook num FlowDefinition com trigger do estágio. */
export function buildCadenceDefinition(seed: StageAutomationSeed): FlowDefinition {
  const templates = seed.templates.length > 0 ? seed.templates : [...DEFAULT_CADENCE_TEMPLATES];
  const base = defaultCadenceFlow(seed.cadence, templates);
  return {
    ...base,
    trigger: seed.stageKey
      ? { kind: "stage_entered", stageKey: seed.stageKey }
      : { kind: "stage_entered" },
  };
}

// ── Utilitários de template (também usados por campaign.ts) ────────────────

/** Substitui {chaves} conhecidas; tokens desconhecidos permanecem no texto. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/gi, (token, key: string) => vars[key] ?? token);
}

/** Primeiro nome de um nome completo (para o {nome} das mensagens). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Converte texto plano em HTML simples (parágrafos + quebras), com escape. */
export function textToHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}
