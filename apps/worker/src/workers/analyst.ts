import { resolveModel, type LlmClient } from "@sales4u/brain";

import { NotImplementedYetError } from "../errors.js";
import { ANALYST_JOBS, analystJobSchema, type AnalystJobPayload } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "analyst": relatório diário do funil por workspace.
 * Agrega os números do dia, pede UM insight acionável ao modelo classifier
 * (ou gera um determinístico local sem credencial) e grava em EventLog
 * "analyst.insight" — o Dashboard lê o mais recente desse tipo.
 * Lógica pura com deps injetadas; wiring real em analyst.wiring.ts.
 */

export interface ReportWindow {
  /** Data de referência YYYY-MM-DD (UTC). */
  date: string;
  start: Date;
  end: Date;
}

export interface StageCount {
  stageId: string;
  name: string;
  order: number;
  systemKey: string | null;
  leadCount: number;
}

/** Números crus coletados do banco para um workspace no dia. */
export interface CollectedMetrics {
  leadsCreated: number;
  stages: StageCount[];
  /** Conversas distintas com mensagem OUT na janela. */
  conversationsContacted: number;
  /** Conversas distintas com mensagem IN na janela. */
  conversationsReplied: number;
  ordersCount: number;
  revenueCents: number;
  cadencesExhausted: number;
}

export interface Bottleneck {
  fromStage: string;
  toStage: string;
  /** Fração de queda entre os estágios (0..1, 2 casas). */
  dropRate: number;
}

/** Métricas consolidadas gravadas no EventLog junto do insight. */
export interface FunnelMetrics {
  date: string;
  leadsCreated: number;
  stageDistribution: Array<{ stage: string; leads: number }>;
  conversationsContacted: number;
  conversationsReplied: number;
  responseRate: number;
  ordersCount: number;
  revenueCents: number;
  cadencesExhausted: number;
  bottleneck: Bottleneck | null;
}

export interface AiUsageSample {
  workspaceId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AnalystDeps {
  listWorkspaceIds(): Promise<string[]>;
  collectMetrics(workspaceId: string, window: ReportWindow): Promise<CollectedMetrics>;
  /** LlmClient do workspace, ou null sem credencial ANTHROPIC (⇒ insight local). */
  getLlm(workspaceId: string): Promise<LlmClient | null>;
  recordUsage(usage: AiUsageSample): Promise<void>;
  saveInsight(workspaceId: string, insight: string, metrics: FunnelMetrics): Promise<void>;
  notify(workspaceId: string, payload: Record<string, unknown>): Promise<void>;
  now(): Date;
  log: Log;
}

/** O index.ts passa só { log }; testes injetam todas as deps fake. */
export type AnalystOptions = { log: Log } & Partial<Omit<AnalystDeps, "log">>;

/** Cria o processor da fila "analyst". */
export function createAnalystProcessor(options: AnalystOptions): JobProcessor {
  let resolved: Promise<AnalystDeps> | undefined;
  const getDeps = (): Promise<AnalystDeps> => (resolved ??= resolveDeps(options));

  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case ANALYST_JOBS.dailyReport: {
        const payload = analystJobSchema.parse(job.data);
        return runDailyReport(await getDeps(), payload);
      }
      default:
        throw new NotImplementedYetError("analyst", job.name);
    }
  };
}

async function runDailyReport(deps: AnalystDeps, payload: AnalystJobPayload): Promise<void> {
  const window = resolveReportWindow(payload.date, deps.now());
  const targets = await resolveTargetWorkspaces(deps, payload.workspaceId);
  if (targets.length === 0) return;

  const failed: string[] = [];
  for (const workspaceId of targets) {
    try {
      await reportWorkspace(deps, workspaceId, window);
    } catch (error) {
      failed.push(workspaceId);
      deps.log.error(
        { workspaceId, err: error instanceof Error ? error.message : String(error) },
        "falha no relatório do analista",
      );
    }
  }
  // Workspaces com falha inesperada (rede/API/banco) voltam via retry do BullMQ.
  if (failed.length > 0) {
    throw new Error(`relatório do analista falhou para: ${failed.join(", ")}`);
  }
}

async function resolveTargetWorkspaces(
  deps: AnalystDeps,
  workspaceId: string | undefined,
): Promise<string[]> {
  const all = await deps.listWorkspaceIds();
  if (!workspaceId) return all;
  if (all.includes(workspaceId)) return [workspaceId];
  deps.log.warn({ workspaceId }, "workspace não encontrado — relatório ignorado");
  return [];
}

async function reportWorkspace(
  deps: AnalystDeps,
  workspaceId: string,
  window: ReportWindow,
): Promise<void> {
  const collected = await deps.collectMetrics(workspaceId, window);
  const metrics = buildFunnelMetrics(window.date, collected);
  const insight = await generateInsight(deps, workspaceId, metrics);

  await deps.saveInsight(workspaceId, insight, metrics);
  await deps.notify(workspaceId, { kind: "analyst_insight", date: metrics.date, insight });
  deps.log.info({ workspaceId, date: metrics.date }, "insight do analista registrado");
}

// ---------------------------------------------------------------------------
// Insight (LLM classifier ou determinístico local)
// ---------------------------------------------------------------------------

const ANALYST_SYSTEM_PROMPT =
  "Você é um analista de funil de vendas de um CRM via WhatsApp. " +
  "Seu papel é apontar, em português do Brasil, o próximo passo mais valioso " +
  "para o dono do negócio com base nos números do dia. Seja direto e específico.";

async function generateInsight(
  deps: AnalystDeps,
  workspaceId: string,
  metrics: FunnelMetrics,
): Promise<string> {
  const llm = await deps.getLlm(workspaceId);
  if (!llm) {
    deps.log.info({ workspaceId }, "sem credencial ANTHROPIC — insight determinístico local");
    return buildLocalInsight(metrics);
  }

  const model = resolveModel("classifier");
  const response = await llm.complete({
    model,
    system: ANALYST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildAnalystPrompt(metrics) }],
    maxTokens: 300,
  });
  await deps.recordUsage({
    workspaceId,
    model,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
  });

  const insight = response.text?.trim();
  return insight ? insight : buildLocalInsight(metrics);
}

/** Prompt com o resumo textual dos números do dia. */
export function buildAnalystPrompt(metrics: FunnelMetrics): string {
  const distribution =
    metrics.stageDistribution.map((item) => `${item.stage} (${item.leads})`).join(", ") ||
    "sem estágios";
  const bottleneck = metrics.bottleneck
    ? `"${metrics.bottleneck.fromStage}" → "${metrics.bottleneck.toStage}" ` +
      `(queda de ${formatPercent(metrics.bottleneck.dropRate)})`
    : "nenhum detectado";

  return [
    `Números do funil no dia ${metrics.date}:`,
    `- Leads criados: ${metrics.leadsCreated}`,
    `- Distribuição por estágio: ${distribution}`,
    `- Conversas contatadas: ${metrics.conversationsContacted}; ` +
      `com resposta: ${metrics.conversationsReplied}; ` +
      `taxa de resposta: ${formatPercent(metrics.responseRate)}`,
    `- Vendas: ${metrics.ordersCount} (${formatBrl(metrics.revenueCents)})`,
    `- Cadências exauridas: ${metrics.cadencesExhausted}`,
    `- Gargalo: ${bottleneck}`,
    "",
    "Com base APENAS nesses números, escreva UM insight acionável em 1-2 frases.",
    "Responda somente com o insight, sem preâmbulo.",
  ].join("\n");
}

/** Insight determinístico quando o workspace não tem credencial de IA. */
export function buildLocalInsight(metrics: FunnelMetrics): string {
  if (metrics.bottleneck) {
    return (
      `Maior gargalo do dia ${metrics.date}: queda de ` +
      `${formatPercent(metrics.bottleneck.dropRate)} entre ` +
      `"${metrics.bottleneck.fromStage}" e "${metrics.bottleneck.toStage}". ` +
      "Revise o playbook e a cadência desse estágio para destravar o funil."
    );
  }
  if (metrics.leadsCreated === 0) {
    return (
      `Nenhum lead novo em ${metrics.date} — o funil está sem combustível. ` +
      "Priorize aquisição hoje: reative campanhas ou dispare prospecção."
    );
  }
  return (
    `Dia ${metrics.date}: ${metrics.leadsCreated} leads novos, ` +
    `${metrics.ordersCount} vendas (${formatBrl(metrics.revenueCents)}) e taxa de ` +
    `resposta de ${formatPercent(metrics.responseRate)}. ` +
    "Mantenha o ritmo e acompanhe as conversas ainda sem resposta."
  );
}

// ---------------------------------------------------------------------------
// Cálculos puros
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Janela [00:00, 24:00) UTC da data pedida, ou de ontem por padrão. */
export function resolveReportWindow(date: string | undefined, now: Date): ReportWindow {
  const start = date ? new Date(`${date}T00:00:00.000Z`) : new Date(utcMidnight(now) - DAY_MS);
  return {
    date: start.toISOString().slice(0, 10),
    start,
    end: new Date(start.getTime() + DAY_MS),
  };
}

export function buildFunnelMetrics(date: string, collected: CollectedMetrics): FunnelMetrics {
  const responseRate =
    collected.conversationsContacted > 0
      ? round2(collected.conversationsReplied / collected.conversationsContacted)
      : 0;
  const byOrder = [...collected.stages].sort((a, b) => a.order - b.order);

  return {
    date,
    leadsCreated: collected.leadsCreated,
    stageDistribution: byOrder.map((stage) => ({ stage: stage.name, leads: stage.leadCount })),
    conversationsContacted: collected.conversationsContacted,
    conversationsReplied: collected.conversationsReplied,
    responseRate,
    ordersCount: collected.ordersCount,
    revenueCents: collected.revenueCents,
    cadencesExhausted: collected.cadencesExhausted,
    bottleneck: findBottleneck(collected.stages),
  };
}

/** Estágios que participam do fluxo de venda (exclui LOST e estacionamentos). */
const FUNNEL_SYSTEM_KEYS: ReadonlySet<string> = new Set(["NEW", "WON"]);

/**
 * Par de estágios consecutivos do funil com a maior razão de queda na
 * distribuição atual de leads — onde o funil está estrangulado.
 */
export function findBottleneck(stages: readonly StageCount[]): Bottleneck | null {
  const funnel = stages
    .filter((stage) => stage.systemKey === null || FUNNEL_SYSTEM_KEYS.has(stage.systemKey))
    .sort((a, b) => a.order - b.order);

  let worst: Bottleneck | null = null;
  let worstRate = 0;
  for (let index = 0; index < funnel.length - 1; index += 1) {
    const from = funnel[index];
    const to = funnel[index + 1];
    if (!from || !to || from.leadCount === 0) continue;
    const dropRate = (from.leadCount - to.leadCount) / from.leadCount;
    if (dropRate <= worstRate) continue;
    worstRate = dropRate;
    worst = { fromStage: from.name, toStage: to.name, dropRate: round2(dropRate) };
  }
  return worst;
}

function utcMidnight(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// ---------------------------------------------------------------------------
// Resolução de deps (wiring real sob demanda)
// ---------------------------------------------------------------------------

async function resolveDeps(options: AnalystOptions): Promise<AnalystDeps> {
  const { listWorkspaceIds, collectMetrics, getLlm, recordUsage, saveInsight, notify, now } =
    options;
  if (listWorkspaceIds && collectMetrics && getLlm && recordUsage && saveInsight && notify && now) {
    return {
      listWorkspaceIds,
      collectMetrics,
      getLlm,
      recordUsage,
      saveInsight,
      notify,
      now,
      log: options.log,
    };
  }
  // Import dinâmico: testes com deps completas nunca carregam prisma/redis.
  const { createAnalystWiring } = await import("./analyst.wiring.js");
  const wired = createAnalystWiring();
  return {
    listWorkspaceIds: listWorkspaceIds ?? wired.listWorkspaceIds,
    collectMetrics: collectMetrics ?? wired.collectMetrics,
    getLlm: getLlm ?? wired.getLlm,
    recordUsage: recordUsage ?? wired.recordUsage,
    saveInsight: saveInsight ?? wired.saveInsight,
    notify: notify ?? wired.notify,
    now: now ?? wired.now,
    log: options.log,
  };
}
