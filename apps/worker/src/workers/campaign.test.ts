import { describe, expect, it } from "vitest";
import { NotImplementedYetError } from "../errors.js";
import type { CampaignReminderJobPayload, OutboundJobPayload } from "../payloads.js";
import type { Log } from "../types.js";
import {
  createCampaignProcessor,
  DEFAULT_LIVE_REMINDER_TEMPLATES,
  reminderDueAt,
  TICK_WINDOW_MS,
  type CampaignDeps,
  type LiveCampaignSummary,
  type ReminderCampaignSnapshot,
  type ReminderRecipient,
} from "./campaign.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

const NOW = new Date("2026-07-10T12:00:00.000Z");

interface Recorded {
  reminders: Array<{ payload: CampaignReminderJobPayload; delayMs: number }>;
  messages: Array<{ conversationId: string; text: string }>;
  outbound: Array<{ payload: OutboundJobPayload; delayMs: number }>;
  recordedSends: Array<{ campaignId: string; reminderKey: string; data: Record<string, unknown> }>;
  notifications: Array<Record<string, unknown>>;
}

function makeCampaignSnapshot(
  partial?: Partial<ReminderCampaignSnapshot>,
): ReminderCampaignSnapshot {
  return {
    id: "camp_1",
    name: "Live de Lançamento",
    type: "LAUNCH_LIVE",
    status: "ACTIVE",
    remindersEnabled: true,
    liveAt: new Date(NOW.getTime() + 24 * 60 * 60_000),
    templates: {},
    vars: { nome_live: "Live de Lançamento", hora_live: "20:00", link_live: "https://live.x/1" },
    ...partial,
  };
}

function makeDeps(config: {
  campaigns?: LiveCampaignSummary[];
  sentKeys?: string[];
  snapshot?: ReminderCampaignSnapshot | null;
  recipients?: ReminderRecipient[];
  random?: () => number;
}): { deps: CampaignDeps; recorded: Recorded } {
  const recorded: Recorded = {
    reminders: [],
    messages: [],
    outbound: [],
    recordedSends: [],
    notifications: [],
  };
  const sentKeys = new Set(config.sentKeys ?? []);
  const deps: CampaignDeps = {
    log: silentLog,
    now: () => NOW,
    random: config.random ?? (() => 0.5),
    listLiveCampaigns: async () => config.campaigns ?? [],
    wasReminderSent: async (_ws, _campaign, reminderKey) => sentKeys.has(reminderKey),
    enqueueReminder: async (payload, delayMs) => {
      recorded.reminders.push({ payload, delayMs });
    },
    loadCampaign: async () => config.snapshot ?? null,
    listRecipients: async () => config.recipients ?? [],
    createOutboundMessage: async (_ws, conversationId, text) => {
      recorded.messages.push({ conversationId, text });
      return { messageId: `msg_${recorded.messages.length}` };
    },
    enqueueOutbound: async (payload, delayMs) => {
      recorded.outbound.push({ payload, delayMs });
    },
    recordReminderSent: async (_ws, campaignId, reminderKey, data) => {
      recorded.recordedSends.push({ campaignId, reminderKey, data });
    },
    publishNotify: async (_ws, payload) => {
      recorded.notifications.push(payload);
    },
  };
  return { deps, recorded };
}

async function process(deps: CampaignDeps, name: string, data: unknown): Promise<void> {
  const processor = createCampaignProcessor({ log: silentLog, deps });
  await processor({ name, data });
}

describe("campaign scheduler-tick", () => {
  it("enfileira o lembrete cujo horário cai nos próximos 5 minutos", async () => {
    // liveAt daqui a 24h02min ⇒ "d-1" devido em 2min; demais fora da janela.
    const liveAt = new Date(NOW.getTime() + (24 * 60 + 2) * 60_000);
    const { deps, recorded } = makeDeps({
      campaigns: [{ id: "camp_1", workspaceId: "ws_1", liveAt }],
    });
    await process(deps, "scheduler-tick", {});

    expect(recorded.reminders).toEqual([
      {
        payload: { workspaceId: "ws_1", campaignId: "camp_1", reminderKey: "d-1" },
        delayMs: 2 * 60_000,
      },
    ]);
  });

  it("é idempotente: não re-enfileira lembrete já registrado no EventLog", async () => {
    const liveAt = new Date(NOW.getTime() + (24 * 60 + 2) * 60_000);
    const { deps, recorded } = makeDeps({
      campaigns: [{ id: "camp_1", workspaceId: "ws_1", liveAt }],
      sentKeys: ["d-1"],
    });
    await process(deps, "scheduler-tick", {});

    expect(recorded.reminders).toHaveLength(0);
  });

  it("ignora lembretes já passados ou além da janela do tick", async () => {
    // liveAt daqui a 16min ⇒ m-15 devido em 1min (dentro), live-now em 16min
    // (fora), h-3 e d-1 já passados.
    const liveAt = new Date(NOW.getTime() + 16 * 60_000);
    const { deps, recorded } = makeDeps({
      campaigns: [{ id: "camp_1", workspaceId: "ws_1", liveAt }],
    });
    await process(deps, "scheduler-tick", {});

    expect(recorded.reminders.map((item) => item.payload.reminderKey)).toEqual(["m-15"]);
    expect(recorded.reminders[0]?.delayMs).toBe(60_000);
  });

  it("dispara live-now no instante da live (delay 0)", async () => {
    const { deps, recorded } = makeDeps({
      campaigns: [{ id: "camp_1", workspaceId: "ws_1", liveAt: NOW }],
    });
    await process(deps, "scheduler-tick", {});

    expect(recorded.reminders.map((item) => item.payload.reminderKey)).toEqual(["live-now"]);
    expect(recorded.reminders[0]?.delayMs).toBe(0);
  });

  it("rejeita payload com campos intrusos (schema estrito)", async () => {
    const { deps } = makeDeps({});
    await expect(process(deps, "scheduler-tick", { intruso: true })).rejects.toThrowError();
  });
});

const REMINDER_PAYLOAD = { workspaceId: "ws_1", campaignId: "camp_1", reminderKey: "d-1" };

describe("campaign send-reminder", () => {
  it("cria Messages OUT e enfileira outbound com delays incrementais (anti-flood)", async () => {
    const { deps, recorded } = makeDeps({
      snapshot: makeCampaignSnapshot(),
      recipients: [
        { leadId: "l1", name: "Ana Souza", conversationId: "c1" },
        { leadId: "l2", name: "Bruno Lima", conversationId: "c2" },
        { leadId: "l3", name: "Carla Dias", conversationId: "c3" },
      ],
      random: () => 0.5, // incremento fixo de 2000ms
    });
    await process(deps, "send-reminder", REMINDER_PAYLOAD);

    expect(recorded.messages).toHaveLength(3);
    expect(recorded.messages[0]?.text).toContain("Ana");
    expect(recorded.messages[0]?.text).toContain("Live de Lançamento");
    expect(recorded.messages[0]?.text).toContain("https://live.x/1");
    expect(recorded.messages[0]?.text).toContain("20:00");

    expect(recorded.outbound.map((item) => item.delayMs)).toEqual([0, 2000, 4000]);
    expect(recorded.outbound[1]?.payload).toMatchObject({
      workspaceId: "ws_1",
      conversationId: "c2",
      kind: "TEXT",
      messageId: "msg_2",
    });

    expect(recorded.recordedSends).toEqual([
      { campaignId: "camp_1", reminderKey: "d-1", data: { recipients: 3 } },
    ]);
    expect(recorded.notifications).toEqual([
      { type: "campaign.reminder_sent", campaignId: "camp_1", reminderKey: "d-1", recipients: 3 },
    ]);
  });

  it("re-checa idempotência: lembrete já enviado não envia de novo", async () => {
    const { deps, recorded } = makeDeps({
      snapshot: makeCampaignSnapshot(),
      recipients: [{ leadId: "l1", name: "Ana", conversationId: "c1" }],
      sentKeys: ["d-1"],
    });
    await process(deps, "send-reminder", REMINDER_PAYLOAD);

    expect(recorded.messages).toHaveLength(0);
    expect(recorded.outbound).toHaveLength(0);
    expect(recorded.recordedSends).toHaveLength(0);
  });

  it("usa template customizado de settings.liveReminderTemplates quando existir", async () => {
    const { deps, recorded } = makeDeps({
      snapshot: makeCampaignSnapshot({
        templates: { "d-1": "Custom: {nome} em {nome_live}" },
      }),
      recipients: [{ leadId: "l1", name: "Ana Souza", conversationId: "c1" }],
    });
    await process(deps, "send-reminder", REMINDER_PAYLOAD);

    expect(recorded.messages[0]?.text).toBe("Custom: Ana em Live de Lançamento");
  });

  it("usa o template default PT-BR por reminderKey quando não há custom", async () => {
    const { deps, recorded } = makeDeps({
      snapshot: makeCampaignSnapshot(),
      recipients: [{ leadId: "l1", name: "Ana", conversationId: "c1" }],
    });
    await process(deps, "send-reminder", {
      ...REMINDER_PAYLOAD,
      reminderKey: "live-now",
    });

    const expected = DEFAULT_LIVE_REMINDER_TEMPLATES["live-now"]
      .replaceAll("{nome}", "Ana")
      .replaceAll("{nome_live}", "Live de Lançamento")
      .replaceAll("{link_live}", "https://live.x/1");
    expect(recorded.messages[0]?.text).toBe(expected);
  });

  it("campanha não elegível (pausada) encerra sem enviar e sem erro", async () => {
    const { deps, recorded } = makeDeps({
      snapshot: makeCampaignSnapshot({ status: "PAUSED" }),
      recipients: [{ leadId: "l1", name: "Ana", conversationId: "c1" }],
    });
    await expect(process(deps, "send-reminder", REMINDER_PAYLOAD)).resolves.toBeUndefined();

    expect(recorded.messages).toHaveLength(0);
    expect(recorded.recordedSends).toHaveLength(0);
  });

  it("campanha inexistente encerra sem erro (não gasta retries)", async () => {
    const { deps, recorded } = makeDeps({ snapshot: null });
    await expect(process(deps, "send-reminder", REMINDER_PAYLOAD)).resolves.toBeUndefined();
    expect(recorded.messages).toHaveLength(0);
  });

  it("reminderKey desconhecido sem template custom é descartado com log", async () => {
    const { deps, recorded } = makeDeps({
      snapshot: makeCampaignSnapshot(),
      recipients: [{ leadId: "l1", name: "Ana", conversationId: "c1" }],
    });
    await process(deps, "send-reminder", { ...REMINDER_PAYLOAD, reminderKey: "h-99" });

    expect(recorded.messages).toHaveLength(0);
    expect(recorded.recordedSends).toHaveLength(0);
  });

  it("rejeita payload inválido com erro de validação", async () => {
    const { deps } = makeDeps({});
    await expect(
      process(deps, "send-reminder", { workspaceId: "ws_1", campaignId: "camp_1" }),
    ).rejects.toThrowError();
  });

  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { deps } = makeDeps({});
    const processor = createCampaignProcessor({ log: silentLog, deps });
    await expect(processor({ name: "job-inexistente", data: {} })).rejects.toBeInstanceOf(
      NotImplementedYetError,
    );
  });
});

describe("reminderDueAt", () => {
  it("calcula os horários da régua em relação ao liveAt", () => {
    const liveAt = new Date("2026-07-11T20:00:00.000Z");
    expect(reminderDueAt(liveAt, "d-1")).toEqual(new Date("2026-07-10T20:00:00.000Z"));
    expect(reminderDueAt(liveAt, "h-3")).toEqual(new Date("2026-07-11T17:00:00.000Z"));
    expect(reminderDueAt(liveAt, "m-15")).toEqual(new Date("2026-07-11T19:45:00.000Z"));
    expect(reminderDueAt(liveAt, "live-now")).toEqual(liveAt);
  });

  it("janela do tick é de 5 minutos", () => {
    expect(TICK_WINDOW_MS).toBe(5 * 60_000);
  });
});
