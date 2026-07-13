import { z } from "zod";

/**
 * Contratos de payload de cada fila (QUEUES de @sales4u/core).
 * Outros módulos (web, automações) importam estes schemas para enfileirar
 * jobs com tipagem garantida; os handlers validam com .parse() na entrada.
 *
 * Convenção: cada fila tem um objeto <FILA>_JOBS com os nomes de job aceitos.
 */

// ── email ──────────────────────────────────────────────────────────────────

export const EMAIL_JOBS = {
  /** Envia um e-mail transacional. */
  send: "send",
} as const;

export const emailJobSchema = z.object({
  workspaceId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
});

export type EmailJobPayload = z.infer<typeof emailJobSchema>;

// ── outbound (WhatsApp etc.) ───────────────────────────────────────────────

export const OUTBOUND_JOBS = {
  /** Envia uma Message OUT já persistida (status QUEUED) pelo canal do workspace. */
  send: "send",
} as const;

/** Campos comuns a qualquer envio de saída. */
const outboundBase = {
  workspaceId: z.string().min(1),
  conversationId: z.string().min(1),
  /** Message.id persistida como QUEUED — o handler atualiza status/externalId. */
  messageId: z.string().min(1),
};

export const outboundButtonSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

/** União discriminada por kind — espelha o subconjunto enviável de MessageKind. */
export const outboundJobSchema = z.discriminatedUnion("kind", [
  z.object({
    ...outboundBase,
    kind: z.literal("TEXT"),
    payload: z.object({ text: z.string().min(1) }),
  }),
  z.object({
    ...outboundBase,
    kind: z.literal("IMAGE"),
    payload: z.object({ url: z.string().url(), caption: z.string().optional() }),
  }),
  z.object({
    ...outboundBase,
    kind: z.literal("FILE"),
    payload: z.object({ url: z.string().url(), fileName: z.string().min(1) }),
  }),
  z.object({
    ...outboundBase,
    kind: z.literal("BUTTONS"),
    payload: z.object({
      text: z.string().min(1),
      buttons: z.array(outboundButtonSchema).min(1),
    }),
  }),
]);

export type OutboundJobPayload = z.infer<typeof outboundJobSchema>;
export type OutboundKind = OutboundJobPayload["kind"];

// ── automation ─────────────────────────────────────────────────────────────

export const AUTOMATION_JOBS = {
  /** Executa o passo atual (cursor) de um AutomationRun e agenda o próximo. */
  runStep: "run-step",
} as const;

export const automationJobSchema = z.object({
  workspaceId: z.string().min(1),
  /** AutomationRun.id — o handler carrega flow, lead e cursor a partir dele. */
  runId: z.string().min(1),
});

export type AutomationJobPayload = z.infer<typeof automationJobSchema>;

// ── agent-reply ────────────────────────────────────────────────────────────

export const AGENT_REPLY_JOBS = {
  /** Gera e envia a resposta do agente de IA a uma mensagem recebida. */
  reply: "reply",
} as const;

export const agentReplyJobSchema = z.object({
  workspaceId: z.string().min(1),
  conversationId: z.string().min(1),
  /** Message.id (direction IN) que disparou a resposta. */
  messageId: z.string().min(1),
});

export type AgentReplyJobPayload = z.infer<typeof agentReplyJobSchema>;

// ── context-ingest (RAG) ───────────────────────────────────────────────────

export const CONTEXT_INGEST_JOBS = {
  /** Extrai texto, faz chunking e gera embeddings de um ContextFile. */
  ingestFile: "ingest-file",
} as const;

export const contextIngestJobSchema = z.object({
  workspaceId: z.string().min(1),
  /** ContextFile.id em status PENDING. */
  contextFileId: z.string().min(1),
});

export type ContextIngestJobPayload = z.infer<typeof contextIngestJobSchema>;

// ── post-sale ──────────────────────────────────────────────────────────────

export const POST_SALE_JOBS = {
  /** Varredura diária: classifica uso/idle de todos os AccessGrants. */
  dailyClassification: "daily-classification",
  /** Agenda a régua de pós-venda de um lead recém-convertido. */
  scheduleForLead: "schedule-for-lead",
} as const;

export const postSaleJobSchema = z.object({
  /** Ausente na varredura diária global (processa todos os workspaces). */
  workspaceId: z.string().min(1).optional(),
  /** Presente apenas em schedule-for-lead. */
  leadId: z.string().min(1).optional(),
});

export type PostSaleJobPayload = z.infer<typeof postSaleJobSchema>;

// ── campaign ───────────────────────────────────────────────────────────────

export const CAMPAIGN_JOBS = {
  /** Tick de 5min: encontra campanhas LAUNCH_LIVE com lembretes a disparar. */
  schedulerTick: "scheduler-tick",
  /** Dispara um lembrete específico de uma campanha. */
  sendReminder: "send-reminder",
} as const;

export const campaignTickJobSchema = z.object({}).strict();

export const campaignReminderJobSchema = z.object({
  workspaceId: z.string().min(1),
  campaignId: z.string().min(1),
  /** Identificador do lembrete na régua da campanha (ex.: "d-1", "h-1", "live-now"). */
  reminderKey: z.string().min(1),
});

export type CampaignReminderJobPayload = z.infer<typeof campaignReminderJobSchema>;

// ── analyst ────────────────────────────────────────────────────────────────

export const ANALYST_JOBS = {
  /** Relatório diário do analista de funil (07:00). */
  dailyReport: "daily-report",
} as const;

export const analystJobSchema = z.object({
  /** Ausente no job diário global (processa todos os workspaces). */
  workspaceId: z.string().min(1).optional(),
  /** Data de referência YYYY-MM-DD; padrão = ontem. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar no formato YYYY-MM-DD")
    .optional(),
});

export type AnalystJobPayload = z.infer<typeof analystJobSchema>;

// ── import ─────────────────────────────────────────────────────────────────

export const IMPORT_JOBS = {
  /** Importa um CSV (leads ou prospects) já enviado ao S3. */
  csv: "csv",
} as const;

export const importJobSchema = z.object({
  workspaceId: z.string().min(1),
  /** Chave do arquivo no bucket S3. */
  storageKey: z.string().min(1),
  entity: z.enum(["leads", "prospects"]),
  /** ProspectList de destino quando entity = prospects. */
  prospectListId: z.string().min(1).optional(),
});

export type ImportJobPayload = z.infer<typeof importJobSchema>;
