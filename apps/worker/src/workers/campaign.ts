import { NotImplementedYetError } from "../errors.js";
import {
  CAMPAIGN_JOBS,
  campaignReminderJobSchema,
  campaignTickJobSchema,
  type CampaignReminderJobPayload,
  type OutboundJobPayload,
} from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";
import { firstName, renderTemplate } from "./automation.js";

/**
 * Handler da fila "campaign" — régua de lembretes de Lançamento/Live.
 * Lógica pura com dependências injetadas (testável com fakes); o wiring real
 * (prisma, filas BullMQ, SSE) está em campaign.wiring.ts e é carregado sob
 * demanda apenas quando nenhuma dependência é injetada.
 *
 * Idempotência: cada lembrete disparado vira EventLog "campaign.reminder_sent"
 * com o reminderKey — o tick não re-enfileira e o send re-checa antes de enviar.
 */

// ── Régua de lembretes ─────────────────────────────────────────────────────

export const LIVE_REMINDER_KEYS = ["d-1", "h-3", "m-15", "live-now"] as const;
export type LiveReminderKey = (typeof LIVE_REMINDER_KEYS)[number];

/** Minutos ANTES do liveAt em que cada lembrete dispara. */
export const LIVE_REMINDER_OFFSETS_MIN: Record<LiveReminderKey, number> = {
  "d-1": 24 * 60,
  "h-3": 3 * 60,
  "m-15": 15,
  "live-now": 0,
};

/** Templates default (PT-BR) — settings.liveReminderTemplates sobrescreve por key. */
export const DEFAULT_LIVE_REMINDER_TEMPLATES: Record<LiveReminderKey, string> = {
  "d-1":
    "Oi, {nome}! Amanhã, às {hora_live}, tem {nome_live} ao vivo. Vou mostrar na prática o que muda no seu resultado — e tem material exclusivo para quem estiver presente. Guarda este link: {link_live}",
  "h-3":
    "É hoje, {nome}! Daqui a 3 horas começa {nome_live}. Separa papel e caneta: a primeira parte já resolve a dúvida mais comum de quem está começando. Link: {link_live}",
  "m-15":
    "Faltam 15 minutos, {nome}! Já deixa o link aberto para pegar o início de {nome_live} — é onde eu entrego o mapa completo: {link_live}",
  "live-now": "Estamos começando, {nome}! {nome_live} já está ao vivo. Entra agora: {link_live}",
};

/** Janela do tick (5min): lembretes devidos dentro dela são enfileirados. */
export const TICK_WINDOW_MS = 5 * 60_000;

/** Espaçamento anti-flood entre envios: incremento de 1–3s por lead. */
export const REMINDER_SPACING_MIN_MS = 1_000;
export const REMINDER_SPACING_MAX_MS = 3_000;

// ── Contratos das dependências ─────────────────────────────────────────────

/** Campanha candidata a lembretes (tick). */
export interface LiveCampaignSummary {
  id: string;
  workspaceId: string;
  liveAt: Date;
}

/** Visão da campanha para o disparo de um lembrete. */
export interface ReminderCampaignSnapshot {
  id: string;
  name: string;
  type: string;
  status: string;
  remindersEnabled: boolean;
  liveAt: Date | null;
  /** settings.liveReminderTemplates do workspace (por reminderKey). */
  templates: Partial<Record<string, string>>;
  /** Vars resolvidas: {nome_live},{hora_live},{link_live}. */
  vars: Record<string, string>;
}

export interface ReminderRecipient {
  leadId: string;
  name: string;
  conversationId: string;
}

export interface CampaignDeps {
  log: Log;
  /** Relógio injetável (testes); padrão: new Date(). */
  now?: () => Date;
  /** Fonte de aleatoriedade do espaçamento (testes); padrão: Math.random. */
  random?: () => number;
  /** Campanhas LAUNCH_LIVE ACTIVE com remindersEnabled e liveAt >= now. */
  listLiveCampaigns(now: Date): Promise<LiveCampaignSummary[]>;
  /** Já existe EventLog campaign.reminder_sent para este reminderKey? */
  wasReminderSent(workspaceId: string, campaignId: string, reminderKey: string): Promise<boolean>;
  enqueueReminder(payload: CampaignReminderJobPayload, delayMs: number): Promise<void>;
  loadCampaign(workspaceId: string, campaignId: string): Promise<ReminderCampaignSnapshot | null>;
  /** Leads da campanha (não opted-out) com conversa WhatsApp. */
  listRecipients(workspaceId: string, campaignId: string): Promise<ReminderRecipient[]>;
  /** Cria a Message OUT (SYSTEM, QUEUED) na conversa. */
  createOutboundMessage(
    workspaceId: string,
    conversationId: string,
    text: string,
  ): Promise<{ messageId: string }>;
  enqueueOutbound(payload: OutboundJobPayload, delayMs: number): Promise<void>;
  /** Registra o EventLog campaign.reminder_sent (marcador de idempotência). */
  recordReminderSent(
    workspaceId: string,
    campaignId: string,
    reminderKey: string,
    data: Record<string, unknown>,
  ): Promise<void>;
  publishNotify(workspaceId: string, payload: Record<string, unknown>): Promise<void>;
}

// ── Factory (mesma assinatura registrada em workers/index.ts) ──────────────

export interface CampaignProcessorOptions {
  log: Log;
  /** Injetável em testes; ausente ⇒ wiring real carregado sob demanda. */
  deps?: CampaignDeps;
}

/** Cria o processor da fila "campaign". */
export function createCampaignProcessor(options: CampaignProcessorOptions): JobProcessor {
  let deps = options.deps;
  const resolveDeps = async (): Promise<CampaignDeps> => {
    if (!deps) {
      const wiring = await import("./campaign.wiring.js");
      deps = wiring.createCampaignDeps(options.log);
    }
    return deps;
  };

  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case CAMPAIGN_JOBS.schedulerTick: {
        campaignTickJobSchema.parse(job.data);
        return schedulerTick(await resolveDeps());
      }
      case CAMPAIGN_JOBS.sendReminder: {
        const payload = campaignReminderJobSchema.parse(job.data);
        return sendReminder(await resolveDeps(), payload);
      }
      default:
        throw new NotImplementedYetError("campaign", job.name);
    }
  };
}

// ── scheduler-tick ─────────────────────────────────────────────────────────

/**
 * Varre campanhas LAUNCH_LIVE ativas e enfileira send-reminder para cada
 * lembrete da régua cujo horário cai nos próximos 5 minutos e que ainda não
 * foi disparado (idempotência via EventLog).
 */
export async function schedulerTick(deps: CampaignDeps): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const campaigns = await deps.listLiveCampaigns(now);

  for (const campaign of campaigns) {
    for (const reminderKey of LIVE_REMINDER_KEYS) {
      const dueAt = reminderDueAt(campaign.liveAt, reminderKey);
      const delayMs = dueAt.getTime() - now.getTime();
      if (delayMs < 0 || delayMs >= TICK_WINDOW_MS) continue;
      if (await deps.wasReminderSent(campaign.workspaceId, campaign.id, reminderKey)) continue;

      await deps.enqueueReminder(
        { workspaceId: campaign.workspaceId, campaignId: campaign.id, reminderKey },
        delayMs,
      );
      deps.log.info(
        { workspaceId: campaign.workspaceId, campaignId: campaign.id, reminderKey, delayMs },
        "lembrete de live enfileirado",
      );
    }
  }
}

/** Horário devido de um lembrete em relação ao liveAt. */
export function reminderDueAt(liveAt: Date, reminderKey: LiveReminderKey): Date {
  return new Date(liveAt.getTime() - LIVE_REMINDER_OFFSETS_MIN[reminderKey] * 60_000);
}

// ── send-reminder ──────────────────────────────────────────────────────────

/**
 * Dispara um lembrete da régua para todos os leads da campanha: re-checa a
 * idempotência, cria Messages OUT e enfileira envios espaçados (anti-flood).
 */
export async function sendReminder(
  deps: CampaignDeps,
  payload: CampaignReminderJobPayload,
): Promise<void> {
  const { workspaceId, campaignId, reminderKey } = payload;

  if (await deps.wasReminderSent(workspaceId, campaignId, reminderKey)) {
    deps.log.info({ ...payload }, "lembrete já disparado — idempotência preservada");
    return;
  }

  const campaign = await deps.loadCampaign(workspaceId, campaignId);
  if (!campaign) {
    deps.log.warn({ ...payload }, "campanha não encontrada — lembrete descartado");
    return;
  }
  if (campaign.type !== "LAUNCH_LIVE" || campaign.status !== "ACTIVE" || !campaign.remindersEnabled) {
    deps.log.info(
      { ...payload, type: campaign.type, status: campaign.status },
      "campanha não elegível a lembretes — nada enviado",
    );
    return;
  }

  const template = campaign.templates[reminderKey] ?? defaultTemplateFor(reminderKey);
  if (!template) {
    deps.log.warn({ ...payload }, "reminderKey sem template conhecido — lembrete descartado");
    return;
  }

  const recipients = await deps.listRecipients(workspaceId, campaignId);
  const random = deps.random ?? Math.random;
  let delayMs = 0;

  for (const recipient of recipients) {
    const text = renderTemplate(template, { ...campaign.vars, nome: firstName(recipient.name) });
    const { messageId } = await deps.createOutboundMessage(
      workspaceId,
      recipient.conversationId,
      text,
    );
    await deps.enqueueOutbound(
      {
        workspaceId,
        conversationId: recipient.conversationId,
        messageId,
        kind: "TEXT",
        payload: { text },
      },
      delayMs,
    );
    delayMs += nextSpacingMs(random);
  }

  await deps.recordReminderSent(workspaceId, campaignId, reminderKey, {
    recipients: recipients.length,
  });
  await deps.publishNotify(workspaceId, {
    type: "campaign.reminder_sent",
    campaignId,
    reminderKey,
    recipients: recipients.length,
  });
  deps.log.info({ ...payload, recipients: recipients.length }, "lembrete de live disparado");
}

function defaultTemplateFor(reminderKey: string): string | null {
  return isLiveReminderKey(reminderKey) ? DEFAULT_LIVE_REMINDER_TEMPLATES[reminderKey] : null;
}

function isLiveReminderKey(value: string): value is LiveReminderKey {
  return (LIVE_REMINDER_KEYS as readonly string[]).includes(value);
}

/** Incremento aleatório de 1–3s entre envios consecutivos. */
function nextSpacingMs(random: () => number): number {
  return (
    REMINDER_SPACING_MIN_MS +
    Math.floor(random() * (REMINDER_SPACING_MAX_MS - REMINDER_SPACING_MIN_MS))
  );
}
