import { Queue } from "bullmq";
import { z } from "zod";
import {
  DEFAULT_ACTIVE_HOURS,
  QUEUES,
  STAGE_SEEDS,
  stageSeedByKey,
  type ActiveHours,
  type CadenceConfig,
} from "@vendaflow/core";
import { prisma, type Prisma } from "@vendaflow/db";
import { loadEnv } from "../env.js";
import {
  AUTOMATION_JOBS,
  EMAIL_JOBS,
  OUTBOUND_JOBS,
  POST_SALE_JOBS,
  type AutomationJobPayload,
} from "../payloads.js";
import { DEFAULT_JOB_OPTIONS } from "../queues.js";
import { createBullRedis, createSsePublisher, publishSse, type RedisPublisher } from "../redis.js";
import { applyStageChange } from "../services/lead-effects.js";
import type { Log } from "../types.js";
import {
  ensureStageAutomation as runEnsureStageAutomation,
  type AutomationDeps,
  type AutomationRunSnapshot,
  type EnsureStageAutomationDeps,
  type RunUpdate,
  type StageAutomationSeed,
  type StagePolicy,
} from "./automation.js";

/**
 * Wiring real do handler de automação: prisma, filas BullMQ e SSE.
 * Infra (conexões redis + filas) é criada de forma preguiçosa no primeiro
 * job — testes unitários nunca chegam aqui porque injetam deps fake.
 */

interface AutomationInfra {
  publisher: RedisPublisher;
  automationQueue: Queue;
  outboundQueue: Queue;
  emailQueue: Queue;
  postSaleQueue: Queue;
}

let infra: AutomationInfra | null = null;

function getInfra(): AutomationInfra {
  if (!infra) {
    const env = loadEnv();
    const connection = createBullRedis(env.REDIS_URL);
    const options = { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS };
    infra = {
      publisher: createSsePublisher(env.REDIS_URL),
      automationQueue: new Queue(QUEUES.automation, options),
      outboundQueue: new Queue(QUEUES.outbound, options),
      emailQueue: new Queue(QUEUES.email, options),
      postSaleQueue: new Queue(QUEUES.postSale, options),
    };
  }
  return infra;
}

// ── Deps do processor ──────────────────────────────────────────────────────

/** Monta as dependências reais usadas por createAutomationProcessor. */
export function createAutomationDeps(log: Log): AutomationDeps {
  return {
    log,
    loadRun,
    loadStagePolicy,
    hasLeadRepliedSince,
    buildVars,
    createWhatsAppMessage,
    enqueueOutbound: async (payload) => {
      await getInfra().outboundQueue.add(OUTBOUND_JOBS.send, payload);
    },
    enqueueEmail: async (payload) => {
      await getInfra().emailQueue.add(EMAIL_JOBS.send, payload);
    },
    createApproval,
    moveStage: (input) => moveStage(input, log),
    addLeadTag,
    notifyHuman,
    updateRun,
    enqueueRunStep: async (payload, delayMs) => {
      await getInfra().automationQueue.add(
        AUTOMATION_JOBS.runStep,
        payload,
        delayMs > 0 ? { delay: delayMs } : {},
      );
    },
  };
}

async function loadRun(workspaceId: string, runId: string): Promise<AutomationRunSnapshot | null> {
  const run = await prisma.automationRun.findFirst({
    where: { id: runId, flow: { workspaceId }, lead: { workspaceId } },
    include: { flow: true, lead: true },
  });
  if (!run) return null;
  return {
    run: {
      id: run.id,
      cursor: run.cursor,
      state: run.state,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    },
    flow: {
      id: run.flow.id,
      name: run.flow.name,
      isActive: run.flow.isActive,
      trigger: run.flow.trigger,
      steps: run.flow.steps,
    },
    lead: {
      id: run.lead.id,
      name: run.lead.name,
      email: run.lead.email,
      optedOut: run.lead.optedOut,
      aiStatus: run.lead.aiStatus,
      stageId: run.lead.stageId,
    },
  };
}

const activeHoursSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  days: z.array(z.number().int()),
});

function parseActiveHours(value: unknown): ActiveHours {
  const parsed = activeHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ACTIVE_HOURS;
}

async function loadStagePolicy(workspaceId: string, stageId: string): Promise<StagePolicy> {
  const [playbook, persona] = await Promise.all([
    prisma.stagePlaybook.findFirst({ where: { workspaceId, stageId } }),
    prisma.agentPersona.findFirst({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    autonomy: playbook?.autonomy ?? "SEMI",
    activeHours: parseActiveHours(persona?.activeHours),
  };
}

async function hasLeadRepliedSince(
  workspaceId: string,
  leadId: string,
  since: Date,
): Promise<boolean> {
  const message = await prisma.message.findFirst({
    where: {
      direction: "IN",
      createdAt: { gt: since },
      conversation: { leadId, workspaceId },
    },
    select: { id: true },
  });
  return message !== null;
}

async function buildVars(workspaceId: string, leadId: string): Promise<Record<string, string>> {
  const [lead, offer] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: { accessGrants: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.productOffer.findFirst({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
  ]);
  const valueCents = lead?.valueCents ?? offer?.priceCents;
  return {
    nome: lead?.name.trim().split(/\s+/)[0] ?? "",
    produto: offer?.name ?? "",
    valor: valueCents !== undefined && valueCents !== null ? formatBrl(valueCents) : "",
    link_acesso: lead?.accessGrants[0]?.url ?? "",
  };
}

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function createWhatsAppMessage(
  workspaceId: string,
  leadId: string,
  text: string,
): Promise<{ conversationId: string; messageId: string } | null> {
  const existing = await prisma.conversation.findFirst({
    where: { workspaceId, leadId, channel: "WHATSAPP" },
    orderBy: { updatedAt: "desc" },
  });
  if (existing?.state === "HUMAN") return null; // humano no comando — automação não interrompe

  const conversation =
    existing ?? (await prisma.conversation.create({ data: { workspaceId, leadId, channel: "WHATSAPP" } }));

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUT",
      authorType: "AI",
      kind: "TEXT",
      content: { text },
      status: "QUEUED",
    },
  });
  return { conversationId: conversation.id, messageId: message.id };
}

async function createApproval(input: {
  workspaceId: string;
  leadId: string;
  kind: "MESSAGE_DRAFT" | "BULK_OUTREACH";
  payload: Record<string, unknown>;
}): Promise<void> {
  const approval = await prisma.approval.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      kind: input.kind,
      payload: toJson(input.payload),
    },
  });
  await publishSse(getInfra().publisher, input.workspaceId, "notify", {
    type: "approval.requested",
    approvalId: approval.id,
    kind: input.kind,
    leadId: input.leadId,
  });
}

async function moveStage(
  input: { workspaceId: string; leadId: string; stageKey: string },
  log: Log,
): Promise<void> {
  const stage = await resolveStageByKey(input.workspaceId, input.stageKey);
  if (!stage) {
    log.warn({ ...input }, "estágio do move_stage não encontrado — passo ignorado");
    return;
  }
  await applyStageChange({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    toStageId: stage.id,
    movedBy: "AUTOMATION",
    publisher: getInfra().publisher,
    log,
    schedulePostSale: async (leadId) => {
      await getInfra().postSaleQueue.add(POST_SALE_JOBS.scheduleForLead, {
        workspaceId: input.workspaceId,
        leadId,
      });
    },
  });
}

async function resolveStageByKey(
  workspaceId: string,
  stageKey: string,
): Promise<{ id: string } | null> {
  const stages = await prisma.pipelineStage.findMany({ where: { workspaceId } });
  const seed = stageSeedByKey(stageKey);
  return (
    (seed?.systemKey ? stages.find((stage) => stage.systemKey === seed.systemKey) : undefined) ??
    stages.find((stage) => slugify(stage.name) === stageKey) ??
    (seed ? stages.find((stage) => stage.name === seed.name) : undefined) ??
    null
  );
}

async function addLeadTag(workspaceId: string, leadId: string, tag: string): Promise<void> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId }, select: { tags: true } });
  if (!lead || lead.tags.includes(tag)) return;
  await prisma.lead.update({ where: { id: leadId }, data: { tags: [...lead.tags, tag] } });
}

async function notifyHuman(input: {
  workspaceId: string;
  leadId: string;
  runId: string;
  message: string;
}): Promise<void> {
  await prisma.eventLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorType: "SYSTEM",
      type: "automation.notify",
      entity: "Lead",
      entityId: input.leadId,
      data: { runId: input.runId, message: input.message },
    },
  });
  await publishSse(getInfra().publisher, input.workspaceId, "notify", {
    type: "automation.notify",
    leadId: input.leadId,
    runId: input.runId,
    message: input.message,
  });
}

async function updateRun(runId: string, update: RunUpdate): Promise<void> {
  await prisma.automationRun.update({
    where: { id: runId },
    data: {
      ...(update.cursor !== undefined ? { cursor: update.cursor } : {}),
      ...(update.state !== undefined ? { state: update.state } : {}),
      ...(update.nextRunAt !== undefined ? { nextRunAt: update.nextRunAt } : {}),
      ...(update.pausedReason !== undefined ? { pausedReason: update.pausedReason } : {}),
    },
  });
}

// ── ensureStageAutomation (uso externo: web/efeitos de estágio) ────────────

/** Contrato mínimo de fila para enfileirar run-step (bullmq.Queue satisfaz). */
export interface AutomationEnqueueQueue {
  add(name: string, data: AutomationJobPayload, opts?: { delay?: number }): Promise<unknown>;
}

/**
 * Versão com wiring real de ensureStageAutomation (workers/automation.ts):
 * instancia a automação de entrada do estágio para o lead usando o banco e a
 * fila "automation" fornecida.
 */
export async function ensureStageAutomation(
  workspaceId: string,
  leadId: string,
  stageId: string,
  queues: { automation: AutomationEnqueueQueue },
  log: Log,
): Promise<{ flowId: string; runId: string } | null> {
  return runEnsureStageAutomation(createEnsureStageAutomationDeps(queues, log), {
    workspaceId,
    leadId,
    stageId,
  });
}

/** Monta as dependências reais de ensureStageAutomation. */
export function createEnsureStageAutomationDeps(
  queues: { automation: AutomationEnqueueQueue },
  log: Log,
): EnsureStageAutomationDeps {
  return {
    log,
    findStageEnteredFlow,
    hasActiveRun,
    loadCadenceSeed,
    createFlow: async (workspaceId, definition) => {
      const flow = await prisma.automationFlow.create({
        data: {
          workspaceId,
          name: definition.name,
          trigger: toJson(definition.trigger),
          steps: toJson(definition.steps),
          isActive: true,
        },
      });
      return { flowId: flow.id };
    },
    createRun: async (flowId, leadId) => {
      const run = await prisma.automationRun.create({
        data: { flowId, leadId, cursor: 0, state: "RUNNING" },
      });
      return { runId: run.id };
    },
    enqueueRunStep: async (payload, delayMs) => {
      await queues.automation.add(
        AUTOMATION_JOBS.runStep,
        payload,
        delayMs > 0 ? { delay: delayMs } : {},
      );
    },
  };
}

const stageEnteredTriggerSchema = z.object({
  kind: z.literal("stage_entered"),
  stageKey: z.string().min(1).optional(),
});

async function findStageEnteredFlow(
  workspaceId: string,
  stageId: string,
): Promise<{ flowId: string } | null> {
  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, workspaceId } });
  if (!stage) return null;
  const stageKey = stageKeyFor(stage);

  const flows = await prisma.automationFlow.findMany({ where: { workspaceId, isActive: true } });
  const candidates = flows.map((flow) => {
    const parsed = stageEnteredTriggerSchema.safeParse(flow.trigger);
    return { flow, trigger: parsed.success ? parsed.data : null };
  });
  const match =
    candidates.find((item) => item.trigger?.stageKey === stageKey) ??
    candidates.find((item) => item.trigger !== null && item.trigger.stageKey === undefined);
  return match ? { flowId: match.flow.id } : null;
}

async function hasActiveRun(flowId: string, leadId: string): Promise<boolean> {
  const run = await prisma.automationRun.findFirst({
    where: { flowId, leadId, state: { in: ["RUNNING", "PAUSED"] } },
    select: { id: true },
  });
  return run !== null;
}

const cadenceSchema = z.object({
  intervals: z.array(z.number().nonnegative()),
  maxTouches: z.number().int().nonnegative(),
});

function parseCadence(value: unknown): CadenceConfig {
  const parsed = cadenceSchema.safeParse(value);
  return parsed.success ? parsed.data : { intervals: [], maxTouches: 0 };
}

function parseCadenceTemplates(settings: unknown): string[] {
  if (typeof settings !== "object" || settings === null) return [];
  const raw = (settings as Record<string, unknown>).cadenceTemplates;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function loadCadenceSeed(
  workspaceId: string,
  stageId: string,
): Promise<StageAutomationSeed | null> {
  const [stage, playbook, workspace] = await Promise.all([
    prisma.pipelineStage.findFirst({ where: { id: stageId, workspaceId } }),
    prisma.stagePlaybook.findFirst({ where: { workspaceId, stageId } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } }),
  ]);
  if (!stage || !playbook) return null;
  return {
    cadence: parseCadence(playbook.cadence),
    templates: parseCadenceTemplates(workspace?.settings),
    stageKey: stageKeyFor(stage),
  };
}

// ── Utilitários ────────────────────────────────────────────────────────────

/** Chave canônica do estágio: seed pelo systemKey, senão slug do nome. */
function stageKeyFor(stage: { name: string; systemKey: string | null }): string {
  const seed = stage.systemKey
    ? STAGE_SEEDS.find((item) => item.systemKey === stage.systemKey)
    : undefined;
  return seed?.key ?? slugify(stage.name);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
