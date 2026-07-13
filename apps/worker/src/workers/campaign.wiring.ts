import { Queue } from "bullmq";
import { QUEUES } from "@sales4u/core";
import { prisma } from "@sales4u/db";
import { loadEnv } from "../env.js";
import { CAMPAIGN_JOBS, OUTBOUND_JOBS } from "../payloads.js";
import { DEFAULT_JOB_OPTIONS } from "../queues.js";
import { createBullRedis, createSsePublisher, publishSse, type RedisPublisher } from "../redis.js";
import type { Log } from "../types.js";
import type {
  CampaignDeps,
  LiveCampaignSummary,
  ReminderCampaignSnapshot,
  ReminderRecipient,
} from "./campaign.js";

/**
 * Wiring real do handler de campanha: prisma, filas BullMQ e SSE.
 * Infra criada de forma preguiçosa no primeiro job — testes unitários nunca
 * chegam aqui porque injetam deps fake.
 */

interface CampaignInfra {
  publisher: RedisPublisher;
  campaignQueue: Queue;
  outboundQueue: Queue;
}

let infra: CampaignInfra | null = null;

function getInfra(): CampaignInfra {
  if (!infra) {
    const env = loadEnv();
    const connection = createBullRedis(env.REDIS_URL);
    const options = { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS };
    infra = {
      publisher: createSsePublisher(env.REDIS_URL),
      campaignQueue: new Queue(QUEUES.campaign, options),
      outboundQueue: new Queue(QUEUES.outbound, options),
    };
  }
  return infra;
}

/** Monta as dependências reais usadas por createCampaignProcessor. */
export function createCampaignDeps(log: Log): CampaignDeps {
  return {
    log,
    listLiveCampaigns,
    wasReminderSent,
    enqueueReminder: async (payload, delayMs) => {
      await getInfra().campaignQueue.add(
        CAMPAIGN_JOBS.sendReminder,
        payload,
        delayMs > 0 ? { delay: delayMs } : {},
      );
    },
    loadCampaign,
    listRecipients,
    createOutboundMessage,
    enqueueOutbound: async (payload, delayMs) => {
      await getInfra().outboundQueue.add(
        OUTBOUND_JOBS.send,
        payload,
        delayMs > 0 ? { delay: delayMs } : {},
      );
    },
    recordReminderSent: async (workspaceId, campaignId, reminderKey, data) => {
      await prisma.eventLog.create({
        data: {
          workspaceId,
          actorType: "SYSTEM",
          type: "campaign.reminder_sent",
          entity: "Campaign",
          entityId: campaignId,
          data: { reminderKey, ...data },
        },
      });
    },
    publishNotify: (workspaceId, payload) =>
      publishSse(getInfra().publisher, workspaceId, "notify", payload),
  };
}

async function listLiveCampaigns(now: Date): Promise<LiveCampaignSummary[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      type: "LAUNCH_LIVE",
      status: "ACTIVE",
      remindersEnabled: true,
      liveAt: { gte: now },
    },
    select: { id: true, workspaceId: true, liveAt: true },
  });
  return campaigns.flatMap((campaign) =>
    campaign.liveAt
      ? [{ id: campaign.id, workspaceId: campaign.workspaceId, liveAt: campaign.liveAt }]
      : [],
  );
}

async function wasReminderSent(
  workspaceId: string,
  campaignId: string,
  reminderKey: string,
): Promise<boolean> {
  const event = await prisma.eventLog.findFirst({
    where: {
      workspaceId,
      type: "campaign.reminder_sent",
      entity: "Campaign",
      entityId: campaignId,
      data: { path: ["reminderKey"], equals: reminderKey },
    },
    select: { id: true },
  });
  return event !== null;
}

async function loadCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<ReminderCampaignSnapshot | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: {
      workspace: { select: { settings: true } },
      landingPage: { select: { externalUrl: true } },
    },
  });
  if (!campaign) return null;

  const settings = asRecord(campaign.workspace.settings);
  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    status: campaign.status,
    remindersEnabled: campaign.remindersEnabled,
    liveAt: campaign.liveAt,
    templates: parseReminderTemplates(settings.liveReminderTemplates),
    vars: {
      nome_live: campaign.name,
      hora_live: campaign.liveAt ? formatHoraLive(campaign.liveAt) : "",
      link_live: stringOrEmpty(settings.liveLink) || (campaign.landingPage?.externalUrl ?? ""),
    },
  };
}

async function listRecipients(
  workspaceId: string,
  campaignId: string,
): Promise<ReminderRecipient[]> {
  const leads = await prisma.lead.findMany({
    where: { workspaceId, campaignId, optedOut: false },
    select: {
      id: true,
      name: true,
      conversations: {
        where: { channel: "WHATSAPP" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  return leads.flatMap((lead) => {
    const conversation = lead.conversations[0];
    return conversation
      ? [{ leadId: lead.id, name: lead.name, conversationId: conversation.id }]
      : [];
  });
}

async function createOutboundMessage(
  _workspaceId: string,
  conversationId: string,
  text: string,
): Promise<{ messageId: string }> {
  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUT",
      authorType: "SYSTEM",
      kind: "TEXT",
      content: { text },
      status: "QUEUED",
    },
  });
  return { messageId: message.id };
}

// ── Utilitários ────────────────────────────────────────────────────────────

/** Fuso de referência do produto (mesmo dos repetíveis). */
const HORA_LIVE_TIMEZONE = "America/Sao_Paulo";

function formatHoraLive(liveAt: Date): string {
  return liveAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: HORA_LIVE_TIMEZONE,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseReminderTemplates(value: unknown): Partial<Record<string, string>> {
  const raw = asRecord(value);
  const templates: Partial<Record<string, string>> = {};
  for (const [key, template] of Object.entries(raw)) {
    if (typeof template === "string" && template.length > 0) templates[key] = template;
  }
  return templates;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}
