import {
  AGENT_TOOLS,
  buildAgentMessages,
  buildAgentSystemPrompt,
  buildClassifierPrompt,
  enforceToolCall,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGES_PER_MINUTE,
  parseClassifierResponse,
  resolveModel,
  typingDelayMs,
  type AgentOffer,
  type AgentPersona,
  type ApprovalKindString,
  type ClassifierMessage,
  type ConversationTurn,
  type EnforcementPolicy,
  type LlmClient,
  type LlmToolCall,
} from "@vendaflow/brain";
import {
  DEFAULT_ACTIVE_HOURS,
  isWithinActiveHours,
  nextActiveSlot,
  scoreToTemperature,
  type ActiveHours,
  type Autonomy,
} from "@vendaflow/core";
import { NotImplementedYetError } from "../errors.js";
import {
  AGENT_REPLY_JOBS,
  agentReplyJobSchema,
  type AgentReplyJobPayload,
  type OutboundJobPayload,
} from "../payloads.js";
import type { StageChangeOutcome } from "../services/lead-effects.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "agent-reply" — o SDR de IA respondendo no WhatsApp.
 * Lógica pura com dependências injetadas (banco, LLM, RAG, filas, SSE);
 * o wiring real (prisma, BullMQ, Anthropic) está em agent-reply.wiring.ts.
 *
 * Pipeline: guardas → opt-out → handoff por palavra-chave → rate limit →
 * horário ativo → classificador (Haiku) → contexto (persona/modo/playbook/
 * oferta/RAG/links permitidos) → loop de ferramentas com enforcement.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Palavras que o lead usa para sair da lista (comparação exata, sem caixa). */
const OPT_OUT_WORDS = new Set(["parar", "sair", "stop"]);

/** Confirmação curta enviada quando o lead pede opt-out. */
export const OPT_OUT_CONFIRMATION =
  "Entendido! Não vou mais te mandar mensagens. Se mudar de ideia, é só chamar. 👋";

/** Palavras de handoff quando o workspace não configurou as suas. */
export const DEFAULT_HANDOFF_KEYWORDS = ["cancelar", "reembolso", "advogado"];

/** Resposta honesta ao lead quando falta contexto registrado. */
export const MISSING_CONTEXT_REPLY =
  "Boa pergunta! Vou confirmar essa informação e já te retorno, tá bom?";

/** Máximo de idas ao modelo por job (evita loop infinito de bloqueios). */
const MAX_TOOL_ITERATIONS = 5;

/** Quantidade de chunks de RAG pedidos por resposta. */
const RAG_CHUNK_COUNT = 5;

/** Mensagens recentes enviadas ao classificador. */
const CLASSIFIER_HISTORY = 6;

/** Limite de caracteres do markdown de modo embutido no prompt. */
const MODE_TEXT_LIMIT = 1500;

const DEFAULT_PERSONA: AgentPersona = {
  name: "Ana",
  speaksAs: "consultora de vendas do time",
  tone: "próximo, claro e sem pressão",
  activeHours: DEFAULT_ACTIVE_HOURS,
};

const DEFAULT_PLAYBOOK: ResolvedPlaybook = {
  objective: "entender o momento do lead e conduzir a conversa com utilidade",
  instructions:
    "Conduza com mensagens curtas e humanas, uma pergunta por vez. Nunca invente informações.",
  allowedActions: [
    "send_text",
    "update_lead",
    "schedule_followup",
    "register_objection",
    "escalate_human",
    "flag_missing_context",
  ],
  autonomy: "SEMI",
};

// ---------------------------------------------------------------------------
// Contratos de dados (estruturais — espelham o subconjunto usado do Prisma)
// ---------------------------------------------------------------------------

export type LeadTemperature = "COLD" | "WARM" | "HOT";
export type LeadAiStatus = "RUNNING" | "WAITING_HUMAN" | "PAUSED";
export type OutMessageKind = "TEXT" | "IMAGE" | "BUTTONS" | "LINK";

export interface StoredStage {
  id: string;
  name: string;
  systemKey: string | null;
}

export interface StoredPlaybook {
  objective: string;
  instructions: string;
  /** Json do banco — validado com stringArray(). */
  allowedActions: unknown;
  autonomy: Autonomy;
}

export interface StoredLead {
  id: string;
  name: string;
  aiStatus: LeadAiStatus;
  optedOut: boolean;
  stage: StoredStage;
  playbook: StoredPlaybook | null;
}

export interface StoredConversation {
  id: string;
  state: "BOT" | "HUMAN";
  lead: StoredLead;
}

export interface StoredMessage {
  id: string;
  direction: "IN" | "OUT";
  content: unknown;
  createdAt: Date;
}

export interface StoredPersona {
  name: string;
  speaksAs: string;
  tone: string;
  activeHours: unknown;
  commercialRules: string | null;
}

export interface StoredMode {
  name: string;
  configJson: unknown;
  markdownKey: string | null;
}

export interface StoredOffer {
  id: string;
  name: string;
  priceCents: number;
  guarantee: string | null;
  bonuses: unknown;
  accessLinks: unknown;
}

export interface LeadUpdate {
  name?: string;
  email?: string;
  score?: number;
  temperature?: LeadTemperature;
  nextActionText?: string;
  aiStatus?: LeadAiStatus;
  optedOut?: boolean;
  lastInteractionAt?: Date;
}

/** Porta de banco do handler — o wiring implementa com prisma. */
export interface AgentReplyDb {
  getConversation(workspaceId: string, conversationId: string): Promise<StoredConversation | null>;
  getInboundMessage(conversationId: string, messageId: string): Promise<StoredMessage | null>;
  hasOutMessageAfter(conversationId: string, after: Date): Promise<boolean>;
  countOutMessagesSince(conversationId: string, since: Date): Promise<number>;
  /** Mensagens mais recentes em ordem cronológica ascendente. */
  listRecentMessages(conversationId: string, limit: number): Promise<StoredMessage[]>;
  createOutMessage(input: {
    conversationId: string;
    kind: OutMessageKind;
    content: Record<string, unknown>;
  }): Promise<{ id: string }>;
  updateLead(workspaceId: string, leadId: string, data: LeadUpdate): Promise<void>;
  cancelAutomationRuns(workspaceId: string, leadId: string): Promise<void>;
  createNote(workspaceId: string, leadId: string, text: string): Promise<void>;
  createApproval(input: {
    workspaceId: string;
    leadId: string;
    kind: ApprovalKindString;
    payload: Record<string, unknown>;
  }): Promise<void>;
  createEventLog(input: {
    workspaceId: string;
    type: string;
    entity: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
  getPersona(workspaceId: string): Promise<StoredPersona | null>;
  getActiveMode(workspaceId: string): Promise<StoredMode | null>;
  getContextFileText(workspaceId: string, markdownKey: string): Promise<string | null>;
  getPrimaryOffer(workspaceId: string): Promise<StoredOffer | null>;
  getOffer(workspaceId: string, offerId: string): Promise<StoredOffer | null>;
  getWorkspaceSettings(workspaceId: string): Promise<Record<string, unknown>>;
  getPublishedLandingSlugs(workspaceId: string): Promise<string[]>;
  listStages(workspaceId: string): Promise<StoredStage[]>;
  createWonDeal(input: {
    workspaceId: string;
    leadId: string;
    productOfferId: string;
    valueCents: number;
  }): Promise<void>;
  setConversationLastMessageAt(
    workspaceId: string,
    conversationId: string,
    at: Date,
  ): Promise<void>;
}

export interface RagChunk {
  content: string;
  source: string;
}

/** URLs base usadas para montar a allowlist de links e resolver assets. */
export interface AgentReplyUrls {
  appUrl: string;
  landingUrl?: string;
  s3Endpoint: string;
  s3Bucket: string;
}

export interface AgentReplyDeps {
  db: AgentReplyDb;
  /** Cliente LLM do workspace — deve lançar erro name=MissingCredentialError se faltar. */
  getLlm(workspaceId: string): Promise<LlmClient>;
  /** Contrato de services/rag.ts. */
  retrieveContext(workspaceId: string, query: string, k?: number): Promise<RagChunk[]>;
  enqueueOutbound(payload: OutboundJobPayload, options: { delayMs: number }): Promise<void>;
  enqueueAgentReply(
    payload: AgentReplyJobPayload,
    options: { delayMs: number; followUp?: boolean },
  ): Promise<void>;
  /** Mudança de estágio canônica (services/lead-effects) com movedBy "AI". */
  applyStageChange(input: {
    workspaceId: string;
    leadId: string;
    toStageId: string;
    reason?: string;
  }): Promise<StageChangeOutcome>;
  publish(
    workspaceId: string,
    kind: "inbox" | "notify" | "pipeline",
    payload: Record<string, unknown>,
  ): Promise<void>;
  recordUsage(input: {
    workspaceId: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void>;
  urls: AgentReplyUrls;
  /** Relógio injetável (testes). Default: new Date(). */
  now?(): Date;
  log: Log;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/** Cria o processor da fila "agent-reply". */
export function createAgentReplyProcessor(deps: AgentReplyDeps): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case AGENT_REPLY_JOBS.reply:
        return replyToInbound(deps, job.data);
      default:
        throw new NotImplementedYetError("agent-reply", job.name);
    }
  };
}

async function replyToInbound(deps: AgentReplyDeps, data: unknown): Promise<void> {
  const payload = agentReplyJobSchema.parse(data);
  const isFollowUp = isFollowUpJob(data);
  const now = (deps.now ?? defaultNow)();
  const { workspaceId, conversationId, messageId } = payload;
  const { log } = deps;

  // 1. Guardas que encerram sem erro (não gastar retries do BullMQ).
  const conversation = await deps.db.getConversation(workspaceId, conversationId);
  if (!conversation) {
    log.warn({ workspaceId, conversationId }, "agent-reply: conversa inexistente — encerrando");
    return;
  }
  if (conversation.state === "HUMAN") {
    log.info({ conversationId }, "agent-reply: conversa em modo HUMAN — sem resposta automática");
    return;
  }
  const lead = conversation.lead;
  if (lead.aiStatus === "PAUSED") {
    log.info({ conversationId, leadId: lead.id }, "agent-reply: IA pausada para o lead");
    return;
  }
  if (lead.optedOut) {
    log.info({ conversationId, leadId: lead.id }, "agent-reply: lead com opt-out");
    return;
  }

  const inbound = await deps.db.getInboundMessage(conversationId, messageId);
  if (!inbound || inbound.direction !== "IN") {
    log.warn({ conversationId, messageId }, "agent-reply: mensagem IN disparadora não encontrada");
    return;
  }
  // Dedupe de reprocessamento: já respondemos depois desta mensagem.
  // Follow-ups agendados pulam o dedupe de propósito (reavaliação tardia).
  if (!isFollowUp && (await deps.db.hasOutMessageAfter(conversationId, inbound.createdAt))) {
    log.info({ conversationId, messageId }, "agent-reply: mensagem já respondida — dedupe");
    return;
  }

  const inboundText = textOfContent(inbound.content);

  // 2. Opt-out explícito do lead.
  if (isOptOutMessage(inboundText)) {
    await handleOptOut(deps, payload, lead.id);
    return;
  }

  // 3. Palavras de handoff → humano assume, IA fica em espera.
  const settings = await deps.db.getWorkspaceSettings(workspaceId);
  const keyword = findHandoffKeyword(inboundText, handoffKeywordsOf(settings));
  if (keyword) {
    await handleHandoffKeyword(deps, payload, lead.id, keyword);
    return;
  }

  // 4. Rate limit por conversa (a próxima mensagem do lead redispara).
  const sentLastMinute = await deps.db.countOutMessagesSince(
    conversationId,
    new Date(now.getTime() - 60_000),
  );
  if (sentLastMinute >= MAX_MESSAGES_PER_MINUTE) {
    log.warn(
      { conversationId, sentLastMinute },
      "agent-reply: rate limit por conversa atingido — encerrando sem resposta",
    );
    return;
  }

  // Horário ativo da persona: fora da janela, reagenda para o próximo slot.
  const personaRow = await deps.db.getPersona(workspaceId);
  const persona = toAgentPersona(personaRow);
  const activeHours = persona.activeHours ?? DEFAULT_ACTIVE_HOURS;
  if (!isWithinActiveHours(now, activeHours)) {
    const slot = nextActiveSlot(now, activeHours);
    const delayMs = slot.getTime() - now.getTime();
    if (delayMs > 0) {
      await deps.enqueueAgentReply(payload, { delayMs, followUp: isFollowUp });
      log.info(
        { conversationId, runAt: slot.toISOString() },
        "agent-reply: fora do horário ativo — reagendado para a próxima janela",
      );
      return;
    }
    // delayMs <= 0 ⇒ activeHours inválido; segue sem travar o atendimento.
  }

  const playbook = toResolvedPlaybook(lead.playbook);
  if (playbook.allowedActions.length === 0) {
    log.info(
      { conversationId, stage: lead.stage.name },
      "agent-reply: estágio sem ações permitidas para a IA — sem resposta automática",
    );
    return;
  }

  // 9 (parcial). Sem credencial ANTHROPIC: avisa e encerra sem erro.
  let llm: LlmClient;
  try {
    llm = await deps.getLlm(workspaceId);
  } catch (error) {
    if (isMissingCredentialError(error)) {
      await deps.db.createEventLog({
        workspaceId,
        type: "credential.missing",
        entity: "Workspace",
        entityId: workspaceId,
        data: { provider: "ANTHROPIC", conversationId },
      });
      await deps.publish(workspaceId, "notify", {
        kind: "credential_missing",
        provider: "ANTHROPIC",
        conversationId,
      });
      log.warn({ workspaceId }, "agent-reply: workspace sem credencial ANTHROPIC — encerrando");
      return;
    }
    throw error;
  }

  const recent = await deps.db.listRecentMessages(conversationId, MAX_HISTORY_MESSAGES);
  const history = toTurns(recent.filter((message) => message.id !== inbound.id));

  // 5. Classificador (Haiku) — falha aqui nunca bloqueia a resposta.
  await classifyLead({ deps, llm, payload, leadId: lead.id, history, inboundText });

  // 6. Contexto do agente.
  const offerRow = await deps.db.getPrimaryOffer(workspaceId);
  const paymentLinks = stringArray(settings.paymentLinks);
  const landingSlugs = await deps.db.getPublishedLandingSlugs(workspaceId);
  const allowedLinkUrls = buildAllowedLinkUrls(deps.urls, landingSlugs, offerRow, paymentLinks);
  const mode = await resolveModeLabel(deps.db, workspaceId);

  let ragChunks: string[] = [];
  try {
    const chunks = await deps.retrieveContext(workspaceId, inboundText, RAG_CHUNK_COUNT);
    ragChunks = chunks.map((chunk) => `${chunk.content}\n(fonte: ${chunk.source})`);
  } catch (error) {
    log.warn(
      { conversationId, err: errorMessage(error) },
      "agent-reply: falha no RAG — seguindo sem contexto",
    );
  }

  const extraRules = stringArray(settings.guardrails);
  if (personaRow?.commercialRules) extraRules.push(personaRow.commercialRules);

  const system = buildAgentSystemPrompt({
    persona,
    mode,
    playbook: { objective: playbook.objective, instructions: playbook.instructions },
    offer: toAgentOffer(offerRow, paymentLinks),
    guardrails: { allowedLinkUrls, extraRules },
  });
  const messages = buildAgentMessages({ history, ragChunks, inboundText });

  const run: AgentRun = {
    deps,
    payload,
    workspaceId,
    conversationId,
    leadId: lead.id,
    policy: {
      allowedActions: playbook.allowedActions,
      autonomy: playbook.autonomy,
      allowedLinkUrls,
      paymentUrlPrefixes: paymentLinks,
    },
    stagesCache: null,
    sentCount: 0,
  };

  // 7. Loop de ferramentas com enforcement.
  const chatModel = resolveModel("chat");
  const usage = { inputTokens: 0, outputTokens: 0 };

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await llm.complete({
      model: chatModel,
      system,
      messages,
      tools: AGENT_TOOLS,
      maxTokens: 1024,
    });
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;

    const calls = response.toolCalls ?? [];
    if (calls.length === 0) {
      // Resposta só texto ⇒ trata como send_text (passa pelo enforcement).
      const text = response.text?.trim();
      if (text) await handleToolCall(run, { name: "send_text", input: { text } });
      break;
    }

    const blocked: Array<{ name: string; reason: string }> = [];
    for (const call of calls) {
      const result = await handleToolCall(run, call);
      if (result) blocked.push(result);
    }
    if (blocked.length === 0) break;

    // Turn sintético: informa os bloqueios e deixa o modelo continuar sem eles.
    const assistantText = response.text?.trim();
    messages.push({
      role: "assistant",
      content:
        assistantText && assistantText.length > 0
          ? assistantText
          : `[chamou ferramentas: ${calls.map((call) => call.name).join(", ")}]`,
    });
    messages.push({
      role: "user",
      content: blocked
        .map((item) => `[sistema] Ação ${item.name} bloqueada: ${item.reason}. Continue sem ela.`)
        .join("\n"),
    });
  }

  // 8. Fechamento: uso de IA, timestamps e SSE do inbox.
  try {
    await deps.recordUsage({ workspaceId, feature: "agent-reply", model: chatModel, ...usage });
  } catch (error) {
    log.warn({ workspaceId, err: errorMessage(error) }, "agent-reply: falha ao registrar uso de IA");
  }
  await deps.db.setConversationLastMessageAt(workspaceId, conversationId, now);
  await deps.db.updateLead(workspaceId, lead.id, { lastInteractionAt: now });
  await deps.publish(workspaceId, "inbox", { conversationId, kind: "agent_replied" });
}

// ---------------------------------------------------------------------------
// Caminhos curtos: opt-out e handoff por palavra-chave
// ---------------------------------------------------------------------------

async function handleOptOut(
  deps: AgentReplyDeps,
  payload: AgentReplyJobPayload,
  leadId: string,
): Promise<void> {
  const { workspaceId, conversationId } = payload;
  await deps.db.updateLead(workspaceId, leadId, { optedOut: true });
  await deps.db.cancelAutomationRuns(workspaceId, leadId);

  const created = await deps.db.createOutMessage({
    conversationId,
    kind: "TEXT",
    content: { text: OPT_OUT_CONFIRMATION },
  });
  await deps.enqueueOutbound(
    {
      workspaceId,
      conversationId,
      messageId: created.id,
      kind: "TEXT",
      payload: { text: OPT_OUT_CONFIRMATION },
    },
    { delayMs: typingDelayMs(OPT_OUT_CONFIRMATION.length, hashSeed(payload.messageId)) },
  );

  await deps.db.createEventLog({
    workspaceId,
    type: "lead.opted_out",
    entity: "Lead",
    entityId: leadId,
    data: { conversationId },
  });
  await deps.publish(workspaceId, "inbox", { conversationId, leadId, kind: "lead_opted_out" });
  deps.log.info(
    { workspaceId, leadId },
    "agent-reply: opt-out do lead — confirmação enviada e automações canceladas",
  );
}

async function handleHandoffKeyword(
  deps: AgentReplyDeps,
  payload: AgentReplyJobPayload,
  leadId: string,
  keyword: string,
): Promise<void> {
  const { workspaceId, conversationId } = payload;
  await deps.db.updateLead(workspaceId, leadId, { aiStatus: "WAITING_HUMAN" });
  await deps.db.createEventLog({
    workspaceId,
    type: "conversation.handoff_triggered",
    entity: "Conversation",
    entityId: conversationId,
    data: { keyword, leadId },
  });
  await deps.publish(workspaceId, "notify", {
    kind: "handoff",
    leadId,
    reason: `palavra-chave "${keyword}" detectada`,
  });
  await deps.publish(workspaceId, "inbox", { conversationId, kind: "handoff" });
  deps.log.info(
    { conversationId, leadId, keyword },
    "agent-reply: palavra de handoff detectada — aguardando humano",
  );
}

// ---------------------------------------------------------------------------
// Classificador (Haiku)
// ---------------------------------------------------------------------------

async function classifyLead(input: {
  deps: AgentReplyDeps;
  llm: LlmClient;
  payload: AgentReplyJobPayload;
  leadId: string;
  history: ConversationTurn[];
  inboundText: string;
}): Promise<void> {
  const { deps, llm, payload } = input;
  try {
    const transcript: ClassifierMessage[] = [
      ...input.history,
      { author: "lead", text: input.inboundText },
    ];
    const turns = transcript.slice(-CLASSIFIER_HISTORY);
    const model = resolveModel("classifier");
    const response = await llm.complete({
      model,
      system: "Você é um qualificador de leads. Responda APENAS com o JSON pedido.",
      messages: [{ role: "user", content: buildClassifierPrompt(turns) }],
      maxTokens: 200,
    });
    await deps.recordUsage({
      workspaceId: payload.workspaceId,
      feature: "classifier",
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    });

    const result = parseClassifierResponse(response.text ?? "");
    if (!result) {
      deps.log.warn(
        { conversationId: payload.conversationId },
        "agent-reply: classificador devolveu resposta não aproveitável",
      );
      return;
    }
    const score = Math.round(result.score);
    await deps.db.updateLead(payload.workspaceId, input.leadId, {
      score,
      temperature: scoreToTemperature(score),
    });
    if (result.objection) {
      await deps.db.createNote(
        payload.workspaceId,
        input.leadId,
        `Objeção: ${result.objection}`,
      );
    }
  } catch (error) {
    deps.log.warn(
      { conversationId: payload.conversationId, err: errorMessage(error) },
      "agent-reply: classificador falhou — resposta segue sem ele",
    );
  }
}

// ---------------------------------------------------------------------------
// Execução de ferramentas
// ---------------------------------------------------------------------------

interface AgentRun {
  deps: AgentReplyDeps;
  payload: AgentReplyJobPayload;
  workspaceId: string;
  conversationId: string;
  leadId: string;
  policy: EnforcementPolicy;
  stagesCache: StoredStage[] | null;
  sentCount: number;
}

/** Aplica enforcement e executa/roteia o tool call. Retorna info se bloqueado. */
async function handleToolCall(
  run: AgentRun,
  call: LlmToolCall,
): Promise<{ name: string; reason: string } | null> {
  const verdict = enforceToolCall(call, run.policy);
  switch (verdict.verdict) {
    case "block":
      run.deps.log.info(
        { conversationId: run.conversationId, tool: call.name, reason: verdict.reason },
        "agent-reply: ação bloqueada pelos guardrails",
      );
      return { name: call.name, reason: verdict.reason };
    case "to_draft":
      await createApprovalFor(run, "MESSAGE_DRAFT", call);
      return null;
    case "to_approval":
      await createApprovalFor(run, verdict.kind, call);
      return null;
    case "allow":
      await executeToolCall(run, call);
      return null;
  }
}

async function createApprovalFor(
  run: AgentRun,
  kind: ApprovalKindString,
  call: LlmToolCall,
): Promise<void> {
  await run.deps.db.createApproval({
    workspaceId: run.workspaceId,
    leadId: run.leadId,
    kind,
    payload: {
      tool: call.name,
      input: call.input,
      conversationId: run.conversationId,
      triggerMessageId: run.payload.messageId,
    },
  });
  await run.deps.publish(run.workspaceId, "notify", {
    kind: "approval_pending",
    approvalKind: kind,
    leadId: run.leadId,
    conversationId: run.conversationId,
    tool: call.name,
  });
}

async function executeToolCall(run: AgentRun, call: LlmToolCall): Promise<void> {
  switch (call.name) {
    case "send_text":
      return executeSendText(run, call.input);
    case "send_link":
      return executeSendLink(run, call.input);
    case "send_buttons":
      return executeSendButtons(run, call.input);
    case "send_image":
      return executeSendImage(run, call.input);
    case "update_lead":
      return executeUpdateLead(run, call.input);
    case "move_stage":
      return executeMoveStage(run, call.input);
    case "schedule_followup":
      return executeScheduleFollowup(run, call.input);
    case "register_objection":
      return executeRegisterObjection(run, call.input);
    case "escalate_human":
      return executeEscalateHuman(run, call.input);
    case "register_sale":
      return executeRegisterSale(run, call.input);
    case "flag_missing_context":
      return executeFlagMissingContext(run, call.input);
    default:
      run.deps.log.warn(
        { conversationId: run.conversationId, tool: call.name },
        "agent-reply: ferramenta desconhecida ignorada",
      );
  }
}

/** Persiste a Message OUT (QUEUED) e enfileira no outbound com delay humano. */
async function persistAndEnqueue(
  run: AgentRun,
  dbKind: OutMessageKind,
  content: Record<string, unknown>,
  buildPayload: (messageId: string) => OutboundJobPayload,
  textLength: number,
): Promise<void> {
  const created = await run.deps.db.createOutMessage({
    conversationId: run.conversationId,
    kind: dbKind,
    content,
  });
  const delayMs = typingDelayMs(
    textLength,
    hashSeed(`${run.payload.messageId}:${run.sentCount}`),
  );
  await run.deps.enqueueOutbound(buildPayload(created.id), { delayMs });
  run.sentCount += 1;
}

async function executeSendText(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const text = stringInput(input, "text");
  if (!text) return warnBadInput(run, "send_text");
  await persistAndEnqueue(
    run,
    "TEXT",
    { text },
    (messageId) => ({
      workspaceId: run.workspaceId,
      conversationId: run.conversationId,
      messageId,
      kind: "TEXT",
      payload: { text },
    }),
    text.length,
  );
}

async function executeSendLink(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const url = stringInput(input, "url");
  if (!url) return warnBadInput(run, "send_link");
  const message = stringInput(input, "message");
  const text = message ? `${message}\n${url}` : url;
  await persistAndEnqueue(
    run,
    "LINK",
    { url, ...(message ? { message } : {}) },
    (messageId) => ({
      workspaceId: run.workspaceId,
      conversationId: run.conversationId,
      messageId,
      kind: "TEXT",
      payload: { text },
    }),
    text.length,
  );
}

async function executeSendButtons(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const text = stringInput(input, "text");
  const options = stringArray(input.options).slice(0, 3);
  if (!text || options.length === 0) return warnBadInput(run, "send_buttons");
  const buttons = options.map((label, index) => ({ id: `opt-${index + 1}`, label }));
  await persistAndEnqueue(
    run,
    "BUTTONS",
    { text, buttons },
    (messageId) => ({
      workspaceId: run.workspaceId,
      conversationId: run.conversationId,
      messageId,
      kind: "BUTTONS",
      payload: { text, buttons },
    }),
    text.length,
  );
}

async function executeSendImage(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const assetKey = stringInput(input, "assetKey");
  if (!assetKey) return warnBadInput(run, "send_image");
  const caption = stringInput(input, "caption");
  const url = /^https?:\/\//i.test(assetKey) ? assetKey : resolveAssetUrl(run.deps.urls, assetKey);
  await persistAndEnqueue(
    run,
    "IMAGE",
    { url, ...(caption ? { caption } : {}) },
    (messageId) => ({
      workspaceId: run.workspaceId,
      conversationId: run.conversationId,
      messageId,
      kind: "IMAGE",
      payload: { url, ...(caption ? { caption } : {}) },
    }),
    caption?.length ?? 40,
  );
}

async function executeUpdateLead(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const fields = recordOf(input.fields);
  if (!fields) return warnBadInput(run, "update_lead");

  const update: LeadUpdate = {};
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (name) update.name = name;
  const email = typeof fields.email === "string" ? fields.email.trim() : "";
  if (email) update.email = email;
  const nextActionText =
    typeof fields.nextActionText === "string" ? fields.nextActionText.trim() : "";
  if (nextActionText) update.nextActionText = nextActionText;
  if (typeof fields.score === "number" && Number.isFinite(fields.score)) {
    const score = Math.max(0, Math.min(100, Math.round(fields.score)));
    update.score = score;
    update.temperature = scoreToTemperature(score);
  }
  if (fields.temperature === "COLD" || fields.temperature === "WARM" || fields.temperature === "HOT") {
    update.temperature = fields.temperature;
  }

  if (Object.keys(update).length === 0) return;
  await run.deps.db.updateLead(run.workspaceId, run.leadId, update);
}

async function executeMoveStage(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const stageKey = stringInput(input, "stageKey");
  if (!stageKey) return warnBadInput(run, "move_stage");
  const stages = await stagesOf(run);
  const target = resolveStage(stages, stageKey);
  if (!target) {
    run.deps.log.warn(
      { conversationId: run.conversationId, stageKey },
      "agent-reply: move_stage com estágio desconhecido — ignorado",
    );
    return;
  }
  await run.deps.applyStageChange({
    workspaceId: run.workspaceId,
    leadId: run.leadId,
    toStageId: target.id,
    reason: stringInput(input, "reason"),
  });
}

async function executeScheduleFollowup(
  run: AgentRun,
  input: Record<string, unknown>,
): Promise<void> {
  const minutesRaw = numberInput(input, "minutesFromNow");
  // Entre 1 minuto e 30 dias; default 60min quando o modelo não informou.
  const minutes = Math.min(Math.max(minutesRaw ?? 60, 1), 60 * 24 * 30);
  await run.deps.enqueueAgentReply(run.payload, {
    delayMs: Math.round(minutes * 60_000),
    followUp: true,
  });
  run.deps.log.info(
    { conversationId: run.conversationId, minutes, note: stringInput(input, "note") },
    "agent-reply: follow-up agendado — a IA reavalia a conversa depois",
  );
}

async function executeRegisterObjection(
  run: AgentRun,
  input: Record<string, unknown>,
): Promise<void> {
  const type = stringInput(input, "type");
  if (!type) return warnBadInput(run, "register_objection");
  const detail = stringInput(input, "detail");
  await run.deps.db.createNote(
    run.workspaceId,
    run.leadId,
    `Objeção: ${type}${detail ? ` — ${detail}` : ""}`,
  );
}

async function executeEscalateHuman(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const reason = stringInput(input, "reason") ?? "pedido de humano";
  await run.deps.db.updateLead(run.workspaceId, run.leadId, { aiStatus: "WAITING_HUMAN" });
  await run.deps.db.createEventLog({
    workspaceId: run.workspaceId,
    type: "conversation.handoff_triggered",
    entity: "Conversation",
    entityId: run.conversationId,
    data: { reason, source: "escalate_human", leadId: run.leadId },
  });
  await run.deps.publish(run.workspaceId, "notify", {
    kind: "handoff",
    leadId: run.leadId,
    reason,
  });
  await run.deps.publish(run.workspaceId, "inbox", {
    conversationId: run.conversationId,
    kind: "handoff",
  });
}

async function executeRegisterSale(run: AgentRun, input: Record<string, unknown>): Promise<void> {
  const offerId = stringInput(input, "offerId");
  const valueCents = numberInput(input, "valueCents");
  const offer =
    (offerId ? await run.deps.db.getOffer(run.workspaceId, offerId) : null) ??
    (await run.deps.db.getPrimaryOffer(run.workspaceId));
  if (!offer) {
    run.deps.log.warn(
      { conversationId: run.conversationId },
      "agent-reply: register_sale sem oferta válida no workspace — ignorado",
    );
    return;
  }
  await run.deps.db.createWonDeal({
    workspaceId: run.workspaceId,
    leadId: run.leadId,
    productOfferId: offer.id,
    valueCents: valueCents && valueCents > 0 ? Math.round(valueCents) : offer.priceCents,
  });

  const stages = await stagesOf(run);
  const won = stages.find((stage) => stage.systemKey === "WON");
  if (won) {
    await run.deps.applyStageChange({
      workspaceId: run.workspaceId,
      leadId: run.leadId,
      toStageId: won.id,
      reason: "venda registrada pela IA",
    });
  } else {
    run.deps.log.warn(
      { workspaceId: run.workspaceId },
      "agent-reply: workspace sem estágio WON — venda registrada sem mover o lead",
    );
  }
}

async function executeFlagMissingContext(
  run: AgentRun,
  input: Record<string, unknown>,
): Promise<void> {
  const question = stringInput(input, "question") ?? "(pergunta não informada)";
  await run.deps.db.createEventLog({
    workspaceId: run.workspaceId,
    type: "context.missing",
    entity: "Conversation",
    entityId: run.conversationId,
    data: { question, leadId: run.leadId },
  });
  await run.deps.publish(run.workspaceId, "notify", {
    kind: "missing_context",
    question,
    leadId: run.leadId,
    conversationId: run.conversationId,
  });
  // Honestidade com o lead — só se nada foi enviado ainda nesta rodada.
  if (run.sentCount === 0) {
    await handleToolCall(run, { name: "send_text", input: { text: MISSING_CONTEXT_REPLY } });
  }
}

function warnBadInput(run: AgentRun, tool: string): void {
  run.deps.log.warn(
    { conversationId: run.conversationId, tool },
    "agent-reply: tool call com input inválido — ignorado",
  );
}

async function stagesOf(run: AgentRun): Promise<StoredStage[]> {
  if (!run.stagesCache) run.stagesCache = await run.deps.db.listStages(run.workspaceId);
  return run.stagesCache;
}

// ---------------------------------------------------------------------------
// Resolução de contexto (persona, playbook, modo, oferta, links)
// ---------------------------------------------------------------------------

interface ResolvedPlaybook {
  objective: string;
  instructions: string;
  allowedActions: string[];
  autonomy: Autonomy;
}

function toResolvedPlaybook(row: StoredPlaybook | null): ResolvedPlaybook {
  if (!row) return DEFAULT_PLAYBOOK;
  return {
    objective: row.objective,
    instructions: row.instructions,
    allowedActions: stringArray(row.allowedActions),
    autonomy: row.autonomy,
  };
}

function toAgentPersona(row: StoredPersona | null): AgentPersona {
  if (!row) return DEFAULT_PERSONA;
  return {
    name: row.name,
    speaksAs: row.speaksAs,
    tone: row.tone,
    activeHours: parseActiveHours(row.activeHours) ?? DEFAULT_ACTIVE_HOURS,
  };
}

function toAgentOffer(row: StoredOffer | null, paymentLinks: string[]): AgentOffer | undefined {
  if (!row) return undefined;
  const offer: AgentOffer = { name: row.name, priceCents: row.priceCents };
  const bonuses = stringArray(row.bonuses);
  if (bonuses.length > 0) offer.bonuses = bonuses;
  if (row.guarantee) offer.guarantee = row.guarantee;
  const checkoutUrl = paymentLinks[0];
  if (checkoutUrl) offer.checkoutUrl = checkoutUrl;
  return offer;
}

async function resolveModeLabel(db: AgentReplyDb, workspaceId: string): Promise<string> {
  const mode = await db.getActiveMode(workspaceId);
  if (!mode) return "inbound (atendimento de leads que chamam no WhatsApp)";
  if (mode.markdownKey) {
    const text = await db.getContextFileText(workspaceId, mode.markdownKey);
    if (text?.trim()) return `${mode.name}\n${truncate(text.trim(), MODE_TEXT_LIMIT)}`;
  }
  const config = recordOf(mode.configJson);
  const description =
    config && typeof config.description === "string" && config.description
      ? config.description
      : undefined;
  return description ? `${mode.name} — ${description}` : mode.name;
}

/** Coleta URLs reais permitidas: landings publicadas, acessos da oferta e checkouts. */
export function buildAllowedLinkUrls(
  urls: AgentReplyUrls,
  landingSlugs: string[],
  offer: StoredOffer | null,
  paymentLinks: string[],
): string[] {
  const collected = new Set<string>();
  for (const slug of landingSlugs) {
    collected.add(`${trimTrailingSlash(urls.appUrl)}/p/${slug}`);
    if (urls.landingUrl) collected.add(`${trimTrailingSlash(urls.landingUrl)}/p/${slug}`);
  }
  if (offer) for (const url of accessLinkUrls(offer.accessLinks)) collected.add(url);
  for (const url of paymentLinks) collected.add(url);
  return [...collected];
}

function accessLinkUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item) {
      urls.push(item);
    } else {
      const record = recordOf(item);
      if (record && typeof record.url === "string" && record.url) urls.push(record.url);
    }
  }
  return urls;
}

function resolveAssetUrl(urls: AgentReplyUrls, assetKey: string): string {
  return `${trimTrailingSlash(urls.s3Endpoint)}/${urls.s3Bucket}/${assetKey.replace(/^\/+/, "")}`;
}

/** Resolve o estágio por systemKey, nome slugificado ou id. */
export function resolveStage(stages: StoredStage[], key: string): StoredStage | undefined {
  const upper = key.trim().toUpperCase();
  const slug = slugify(key);
  return (
    stages.find((stage) => stage.systemKey !== null && stage.systemKey === upper) ??
    stages.find((stage) => slugify(stage.name) === slug) ??
    stages.find((stage) => stage.id === key)
  );
}

function handoffKeywordsOf(settings: Record<string, unknown>): string[] {
  const configured = stringArray(settings.handoffKeywords);
  return configured.length > 0 ? configured : DEFAULT_HANDOFF_KEYWORDS;
}

// ---------------------------------------------------------------------------
// Helpers puros (exportados quando úteis em testes)
// ---------------------------------------------------------------------------

/** Texto "visível" do content Json de uma Message. */
export function textOfContent(content: unknown): string {
  if (typeof content === "string") return content;
  const record = recordOf(content);
  if (record) {
    for (const key of ["text", "caption", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value) return value;
    }
    if (typeof record.url === "string") return record.url;
  }
  return "";
}

/** Comparação exata (trim + lowercase) com as palavras de opt-out. */
export function isOptOutMessage(text: string): boolean {
  return OPT_OUT_WORDS.has(text.trim().toLowerCase());
}

/** Primeira palavra de handoff contida no texto (case-insensitive). */
export function findHandoffKeyword(text: string, keywords: string[]): string | undefined {
  const lower = text.toLowerCase();
  return keywords.find((keyword) => keyword && lower.includes(keyword.toLowerCase()));
}

/** Hash determinístico simples (seed do delay de digitação). */
export function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

function toTurns(messages: StoredMessage[]): ConversationTurn[] {
  return messages
    .map((message): ConversationTurn => ({
      author: message.direction === "IN" ? "lead" : "agent",
      text: textOfContent(message.content),
    }))
    .filter((turn) => turn.text.length > 0);
}

function parseActiveHours(value: unknown): ActiveHours | undefined {
  const record = recordOf(value);
  if (!record) return undefined;
  if (typeof record.start !== "string" || typeof record.end !== "string") return undefined;
  if (!Array.isArray(record.days)) return undefined;
  const days = record.days.filter((day): day is number => typeof day === "number");
  return { start: record.start, end: record.end, days };
}

/** Job de follow-up carrega followUp: true fora do schema (parse ignora). */
function isFollowUpJob(data: unknown): boolean {
  return recordOf(data)?.followUp === true;
}

/** Detecção estrutural — evita importar o wiring (e o prisma) no módulo puro. */
function isMissingCredentialError(error: unknown): boolean {
  return error instanceof Error && error.name === "MissingCredentialError";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function stringInput(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numberInput(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultNow(): Date {
  return new Date();
}
