"use server";

import { randomBytes } from "node:crypto";

import {
  computeStageChange,
  STAGE_SEEDS,
  validatePlaybookMarkdown,
  QUEUES,
  type QueueName,
} from "@sales4u/core";
import type { Prisma } from "@sales4u/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent, publishSse } from "@/lib/events";
import { parseBRLToCents } from "@/lib/format";
import { getQueue } from "@/lib/queues";
import { requireWorkspace, type WorkspaceContext } from "@/lib/session";
import { putObject } from "@/lib/storage";

import type {
  ActionResult,
  AddNoteResult,
  CreateLeadResult,
  CsvImportError,
  ImportLeadsResult,
  LeadDetailResult,
  MoveLeadResult,
  PlaybookLoadResult,
  PlaybookSaveResult,
} from "./types";
import { sourceLabel } from "./types";

// ── Helpers internos (não exportados) ─────────────────────────────────────

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function messageText(content: Prisma.JsonValue): string {
  const text = jsonObject(content)["text"];
  return typeof text === "string" ? text : "";
}

function firstAccessLink(value: Prisma.JsonValue): string {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string") return first;
    const url = jsonObject(first as Prisma.JsonValue)["url"];
    if (typeof url === "string") return url;
  }
  return "";
}

/** Enfileira job no worker sem derrubar a mutação se o Redis/fila falhar. */
async function safeEnqueue(
  queue: QueueName,
  name: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await getQueue(queue).add(name, payload);
  } catch {
    // Fila indisponível não pode travar a ação principal; o worker recupera pelo EventLog.
  }
}

function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

interface LeadForMove {
  id: string;
  stageId: string;
  valueCents: number | null;
  stage: { id: string; name: string; systemKey: string | null; isFixed: boolean };
  campaign: { productOfferId: string | null } | null;
}

/** Registra a venda quando o lead cai em Ganho: Deal WON + Order + AccessGrant + eventos. */
async function registerWonSale(
  ctx: WorkspaceContext,
  lead: LeadForMove,
  preferredProductId?: string,
): Promise<void> {
  const product =
    (preferredProductId
      ? await ctx.db.productOffer.findUnique({ where: { id: preferredProductId } })
      : null) ??
    (lead.campaign?.productOfferId
      ? await ctx.db.productOffer.findUnique({ where: { id: lead.campaign.productOfferId } })
      : null) ??
    (await ctx.db.productOffer.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!product) return; // sem produto cadastrado não há como registrar a venda

  const valueCents = lead.valueCents ?? product.priceCents;

  const existingDeal = await ctx.db.deal.findFirst({
    where: { leadId: lead.id, status: "WON" },
  });
  if (!existingDeal) {
    await ctx.db.deal.create({
      data: {
        workspaceId: ctx.workspaceId,
        leadId: lead.id,
        productOfferId: product.id,
        valueCents,
        status: "WON",
        wonAt: new Date(),
      },
    });
  }

  const existingOrder = await ctx.db.order.findFirst({
    where: { leadId: lead.id, productOfferId: product.id, status: "PAID" },
  });
  if (existingOrder) return; // venda já registrada — não duplica

  const order = await ctx.db.order.create({
    data: {
      workspaceId: ctx.workspaceId,
      leadId: lead.id,
      productOfferId: product.id,
      valueCents,
      qty: 1,
      channel: "whatsapp",
      source: "PIPELINE",
      status: "PAID",
      paidAt: new Date(),
    },
  });

  const grant = await ctx.db.accessGrant.create({
    data: {
      workspaceId: ctx.workspaceId,
      orderId: order.id,
      leadId: lead.id,
      url: firstAccessLink(product.accessLinks),
      trackedToken: randomBytes(16).toString("hex"),
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "order.paid",
    entity: "Order",
    entityId: order.id,
    data: { leadId: lead.id, valueCents, source: "PIPELINE", productOfferId: product.id },
    notify: ["notify"],
  });
  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "access.granted",
    entity: "AccessGrant",
    entityId: grant.id,
    data: { leadId: lead.id, orderId: order.id, url: grant.url },
  });
}

/** Núcleo da mudança de estágio: executa os efeitos de computeStageChange. */
async function performStageMove(
  ctx: WorkspaceContext,
  leadId: string,
  toStageId: string,
  options: { reason?: string; productOfferId?: string } = {},
): Promise<MoveLeadResult> {
  const lead = await ctx.db.lead.findUnique({
    where: { id: leadId },
    include: {
      stage: { select: { id: true, name: true, systemKey: true, isFixed: true } },
      campaign: { select: { productOfferId: true } },
    },
  });
  if (!lead) return { ok: false, error: "Lead não encontrado." };

  const toStage = await ctx.db.pipelineStage.findUnique({ where: { id: toStageId } });
  if (!toStage) return { ok: false, error: "Estágio de destino não encontrado." };
  if (lead.stageId === toStage.id) return { ok: true, toastText: "" };

  const seed = STAGE_SEEDS.find((s) => s.name === toStage.name);
  const change = computeStageChange({
    leadId: lead.id,
    from: {
      id: lead.stage.id,
      name: lead.stage.name,
      systemKey: lead.stage.systemKey,
      isFixed: lead.stage.isFixed,
    },
    to: {
      id: toStage.id,
      name: toStage.name,
      systemKey: toStage.systemKey,
      isFixed: toStage.isFixed,
      toastText: seed?.playbook.toastText,
    },
    movedBy: "HUMAN",
    reason: options.reason,
    openDealValueCents: lead.valueCents ?? undefined,
  });

  await ctx.db.lead.update({
    where: { id: lead.id },
    data: {
      stageId: toStage.id,
      ...(toStage.systemKey === "LOST"
        ? { aiStatus: "PAUSED" as const, ...(options.reason ? { lostReason: options.reason } : {}) }
        : {}),
    },
  });

  for (const effect of change.effects) {
    switch (effect.kind) {
      case "cancel_automation_runs":
        await ctx.db.automationRun.updateMany({
          where: { leadId: lead.id, state: { in: ["RUNNING", "PAUSED"] } },
          data: { state: "CANCELLED" },
        });
        break;
      case "emit_event":
        await logEvent({
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          type: effect.event.type,
          entity: "Lead",
          entityId: lead.id,
          data: {
            fromStageId: lead.stage.id,
            fromStageName: lead.stage.name,
            toStageId: toStage.id,
            toStageName: toStage.name,
            movedBy: "HUMAN",
            reason: options.reason ?? null,
          },
        });
        break;
      case "publish_sse":
        await publishSse(ctx.workspaceId, effect.channel, effect.payload);
        break;
      case "create_order_from_deal":
        await registerWonSale(ctx, lead, options.productOfferId);
        break;
      case "grant_access":
        // AccessGrant é criado junto com a Order em registerWonSale (precisa do orderId).
        break;
      case "schedule_post_sale":
        await safeEnqueue(QUEUES.postSale, "schedule-post-sale", {
          workspaceId: ctx.workspaceId,
          leadId: lead.id,
        });
        break;
      case "start_stage_automation":
        await safeEnqueue(QUEUES.automation, "start-stage-automation", {
          workspaceId: ctx.workspaceId,
          leadId: lead.id,
          stageId: effect.stageId,
        });
        break;
      default:
        break;
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { ok: true, toastText: change.toastText };
}

// ── Actions ───────────────────────────────────────────────────────────────

const moveLeadSchema = z.object({
  leadId: z.string().min(1),
  toStageId: z.string().min(1),
  productOfferId: z.string().min(1).optional(),
});

/** Move o lead de estágio (drag & drop do kanban) executando o playbook de transição. */
export async function moveLeadStage(input: unknown): Promise<MoveLeadResult> {
  const parsed = moveLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos para mover o lead." };
  try {
    const ctx = await requireWorkspace();
    return await performStageMove(ctx, parsed.data.leadId, parsed.data.toStageId, {
      productOfferId: parsed.data.productOfferId,
    });
  } catch {
    return { ok: false, error: "Não foi possível mover o lead. Tente de novo." };
  }
}

const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do lead").max(120),
  whatsapp: z.string().trim().min(1, "Informe o WhatsApp"),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  origem: z.string().trim().min(1, "Informe a origem").max(80),
  valueCents: z.number().int().min(0).nullable(),
  stageId: z.string().min(1, "Escolha o estágio inicial"),
});

/** Cria lead + conversa WhatsApp vazia + evento lead.created (modal "Novo lead"). */
export async function createLead(input: unknown): Promise<CreateLeadResult> {
  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const phone = normalizePhone(parsed.data.whatsapp);
    if (!phone) return { ok: false, error: "WhatsApp inválido — use DDD + número." };

    const stage = await ctx.db.pipelineStage.findUnique({ where: { id: parsed.data.stageId } });
    if (!stage) return { ok: false, error: "Estágio inicial não encontrado." };

    const duplicate = await ctx.db.lead.findFirst({ where: { phone }, select: { id: true } });
    if (duplicate) return { ok: false, error: "Já existe um lead com esse WhatsApp." };

    const lead = await ctx.db.lead.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: parsed.data.name,
        phone,
        email: parsed.data.email || null,
        source: parsed.data.origem,
        stageId: stage.id,
        temperature: "COLD",
        score: 0,
        valueCents: parsed.data.valueCents,
        ownerId: ctx.userId,
        lastInteractionAt: new Date(),
        aiStatus: "RUNNING",
      },
    });

    await ctx.db.conversation.create({
      data: { workspaceId: ctx.workspaceId, leadId: lead.id, channel: "WHATSAPP", state: "BOT" },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "lead.created",
      entity: "Lead",
      entityId: lead.id,
      data: { name: lead.name, source: lead.source, stageId: stage.id, stageName: stage.name },
      notify: ["pipeline"],
    });

    await safeEnqueue(QUEUES.automation, "start-stage-automation", {
      workspaceId: ctx.workspaceId,
      leadId: lead.id,
      stageId: stage.id,
    });

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { ok: true, leadId: lead.id };
  } catch {
    return { ok: false, error: "Não foi possível criar o lead. Tente de novo." };
  }
}

const importLeadsSchema = z.object({
  rows: z
    .array(
      z.object({
        linha: z.number().int().min(1),
        nome: z.string(),
        whatsapp: z.string(),
        email: z.string().optional(),
        origem: z.string().optional(),
        valor: z.string().optional(),
      }),
    )
    .min(1, "Nenhuma linha para importar")
    .max(500, "Máximo de 500 linhas por importação"),
  startCadence: z.boolean(),
});

const emailSchema = z.string().email();

/** Importa leads de CSV já mapeado no cliente; valida linha a linha e devolve o relatório. */
export async function importLeadsCsv(input: unknown): Promise<ImportLeadsResult> {
  const parsed = importLeadsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const stage =
      (await ctx.db.pipelineStage.findFirst({ where: { systemKey: "NEW" } })) ??
      (await ctx.db.pipelineStage.findFirst({ orderBy: { order: "asc" } }));
    if (!stage) return { ok: false, error: "Nenhum estágio configurado no pipeline." };

    const existing = await ctx.db.lead.findMany({ select: { phone: true } });
    const knownPhones = new Set(existing.map((l) => l.phone));

    const erros: CsvImportError[] = [];
    let criados = 0;

    for (const row of parsed.data.rows) {
      const nome = row.nome.trim();
      if (!nome) {
        erros.push({ linha: row.linha, motivo: "Nome vazio" });
        continue;
      }
      const phone = normalizePhone(row.whatsapp);
      if (!phone) {
        erros.push({ linha: row.linha, motivo: "WhatsApp inválido (use DDD + número)" });
        continue;
      }
      if (knownPhones.has(phone)) {
        erros.push({ linha: row.linha, motivo: "WhatsApp duplicado (já existe um lead)" });
        continue;
      }
      const email = row.email?.trim() ?? "";
      if (email && !emailSchema.safeParse(email).success) {
        erros.push({ linha: row.linha, motivo: "E-mail inválido" });
        continue;
      }
      const valueCents = row.valor?.trim() ? parseBRLToCents(row.valor) : null;
      if (row.valor?.trim() && valueCents === null) {
        erros.push({ linha: row.linha, motivo: "Valor inválido (use formato R$ 1.997,00)" });
        continue;
      }

      const lead = await ctx.db.lead.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: nome,
          phone,
          email: email || null,
          source: row.origem?.trim() || "csv",
          stageId: stage.id,
          temperature: "COLD",
          score: 0,
          valueCents,
          ownerId: ctx.userId,
          lastInteractionAt: new Date(),
          aiStatus: "RUNNING",
        },
      });
      await ctx.db.conversation.create({
        data: { workspaceId: ctx.workspaceId, leadId: lead.id, channel: "WHATSAPP", state: "BOT" },
      });
      await logEvent({
        workspaceId: ctx.workspaceId,
        actorType: "USER",
        actorId: ctx.userId,
        type: "lead.created",
        entity: "Lead",
        entityId: lead.id,
        data: { name: lead.name, source: lead.source, import: true },
      });
      if (parsed.data.startCadence) {
        await safeEnqueue(QUEUES.automation, "welcome-cadence", {
          workspaceId: ctx.workspaceId,
          leadId: lead.id,
          stageId: stage.id,
        });
      }
      knownPhones.add(phone);
      criados++;
    }

    if (criados > 0) {
      await publishSse(ctx.workspaceId, "pipeline", { type: "leads.imported", count: criados });
    }

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { ok: true, criados, erros };
  } catch {
    return { ok: false, error: "Falha na importação. Verifique o arquivo e tente de novo." };
  }
}

/** Carrega o playbook do estágio para o slide-over (fallback: seed padrão do estágio). */
export async function getStagePlaybook(stageId: string): Promise<PlaybookLoadResult> {
  const parsed = z.string().min(1).safeParse(stageId);
  if (!parsed.success) return { ok: false, error: "Estágio inválido." };
  try {
    const ctx = await requireWorkspace();
    const stage = await ctx.db.pipelineStage.findUnique({
      where: { id: parsed.data },
      include: { playbook: true },
    });
    if (!stage) return { ok: false, error: "Estágio não encontrado." };

    const seed = STAGE_SEEDS.find((s) => s.name === stage.name)?.playbook;
    const playbook = stage.playbook;

    return {
      ok: true,
      playbook: {
        stageId: stage.id,
        stageName: stage.name,
        source: playbook?.source ?? "PLATFORM",
        objective: playbook?.objective ?? seed?.objective ?? "",
        instructions: playbook?.instructions ?? seed?.instructions ?? "",
        allowedActions: playbook
          ? jsonStringArray(playbook.allowedActions)
          : (seed?.allowedActions ?? []),
        advanceWhen: playbook?.advanceWhen ?? seed?.advanceWhen ?? "",
        regressWhen: playbook?.regressWhen ?? seed?.regressWhen ?? "",
        autonomy: playbook?.autonomy ?? seed?.autonomy ?? "SEMI",
      },
    };
  } catch {
    return { ok: false, error: "Não foi possível carregar o playbook." };
  }
}

const playbookManualSchema = z.object({
  stageId: z.string().min(1),
  mode: z.literal("manual"),
  objective: z.string().trim().min(1, "Informe o objetivo deste estágio"),
  instructions: z.string().trim().max(4000),
  sendPaymentLink: z.boolean(),
  sendSocialProof: z.boolean(),
  offerDiscount: z.boolean(),
  advanceWhen: z.string().trim().min(1, "Informe o critério para avançar"),
  regressWhen: z.string().trim().max(2000),
  autonomy: z.enum(["DRAFT", "SEMI", "AUTO"]),
});

const playbookMarkdownSchema = z.object({
  stageId: z.string().min(1),
  mode: z.literal("markdown"),
  rawText: z.string().min(1, "Arquivo vazio"),
  fileName: z.string().max(200).optional(),
});

const updatePlaybookSchema = z.discriminatedUnion("mode", [
  playbookManualSchema,
  playbookMarkdownSchema,
]);

/** Mapeia os toggles "Ações liberadas" da UI para as ações do agente. */
const TOGGLE_ACTION_MAP: Array<{ field: "sendPaymentLink" | "sendSocialProof" | "offerDiscount"; action: string }> = [
  { field: "sendPaymentLink", action: "send_link" },
  { field: "sendSocialProof", action: "send_image" },
  { field: "offerDiscount", action: "register_sale" },
];

/** Salva o playbook do estágio (manual ou via markdown validado). */
export async function updatePlaybook(input: unknown): Promise<PlaybookSaveResult> {
  const parsed = updatePlaybookSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const stage = await ctx.db.pipelineStage.findUnique({
      where: { id: parsed.data.stageId },
      include: { playbook: true },
    });
    if (!stage) return { ok: false, error: "Estágio não encontrado." };

    if (parsed.data.mode === "manual") {
      const data = parsed.data;
      const seed = STAGE_SEEDS.find((s) => s.name === stage.name)?.playbook;
      const base = new Set(
        stage.playbook
          ? jsonStringArray(stage.playbook.allowedActions)
          : (seed?.allowedActions ?? ["send_text", "update_lead", "move_stage"]),
      );
      for (const { field, action } of TOGGLE_ACTION_MAP) {
        if (data[field]) base.add(action);
        else base.delete(action);
      }
      const allowedActions = Array.from(base);

      await ctx.db.stagePlaybook.upsert({
        where: { stageId: stage.id },
        update: {
          source: "PLATFORM",
          objective: data.objective,
          instructions: data.instructions,
          allowedActions,
          advanceWhen: data.advanceWhen,
          regressWhen: data.regressWhen,
          autonomy: data.autonomy,
        },
        create: {
          workspaceId: ctx.workspaceId,
          stageId: stage.id,
          source: "PLATFORM",
          objective: data.objective,
          instructions: data.instructions,
          allowedActions,
          advanceWhen: data.advanceWhen,
          regressWhen: data.regressWhen,
          autonomy: data.autonomy,
        },
      });
    } else {
      const validation = validatePlaybookMarkdown(parsed.data.rawText);
      if (!validation.ok || !validation.value) {
        return { ok: false, error: "Markdown inválido — corrija e reenvie.", errors: validation.errors };
      }
      let markdownKey: string | undefined;
      try {
        const key = `playbooks/${ctx.workspaceId}/${stage.id}.md`;
        await putObject(key, Buffer.from(parsed.data.rawText, "utf8"), "text/markdown");
        markdownKey = key;
      } catch {
        // Storage indisponível: os campos parseados ainda são salvos; o arquivo pode ser reenviado depois.
      }
      const value = validation.value;
      await ctx.db.stagePlaybook.upsert({
        where: { stageId: stage.id },
        update: {
          source: "MARKDOWN",
          objective: value.objective,
          instructions: value.instructions,
          allowedActions: value.allowedActions,
          advanceWhen: value.advanceWhen,
          regressWhen: value.regressWhen,
          cadence: value.cadence as unknown as Prisma.InputJsonValue,
          handoffTriggers: value.handoffTriggers,
          autonomy: value.autonomy,
          ...(markdownKey ? { markdownKey } : {}),
        },
        create: {
          workspaceId: ctx.workspaceId,
          stageId: stage.id,
          source: "MARKDOWN",
          objective: value.objective,
          instructions: value.instructions,
          allowedActions: value.allowedActions,
          advanceWhen: value.advanceWhen,
          regressWhen: value.regressWhen,
          cadence: value.cadence as unknown as Prisma.InputJsonValue,
          handoffTriggers: value.handoffTriggers,
          autonomy: value.autonomy,
          markdownKey: markdownKey ?? null,
        },
      });
    }

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "playbook.updated",
      entity: "StagePlaybook",
      entityId: stage.id,
      data: { stageName: stage.name, mode: parsed.data.mode },
    });

    revalidatePath("/pipeline");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar o playbook. Tente de novo." };
  }
}

/** Detalhe completo do lead para o slide-over (visão geral, conversa, notas, atividade). */
export async function getLeadDetail(leadId: string): Promise<LeadDetailResult> {
  const parsed = z.string().min(1).safeParse(leadId);
  if (!parsed.success) return { ok: false, error: "Lead inválido." };
  try {
    const ctx = await requireWorkspace();
    const lead = await ctx.db.lead.findUnique({
      where: { id: parsed.data },
      include: {
        stage: { select: { name: true } },
        campaign: { select: { name: true } },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    const events = await ctx.db.eventLog.findMany({
      where: { entity: "Lead", entityId: lead.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    const rawMessages = lead.conversations[0]?.messages ?? [];
    const messages = [...rawMessages].reverse().map((m) => ({
      id: m.id,
      direction: m.direction,
      authorType: m.authorType,
      text: messageText(m.content),
      createdAt: (m.sentAt ?? m.createdAt).toISOString(),
    }));
    const lastAi = rawMessages.find((m) => m.authorType === "AI");

    return {
      ok: true,
      detail: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        sourceLabel: sourceLabel(lead.source),
        campaignName: lead.campaign?.name ?? null,
        stageName: lead.stage.name,
        valueCents: lead.valueCents,
        temperature: lead.temperature,
        aiStatus: lead.aiStatus,
        score: lead.score,
        nextActionText: lead.nextActionText,
        tags: lead.tags,
        messages,
        lastAiReplyAt: lastAi ? (lastAi.sentAt ?? lastAi.createdAt).toISOString() : null,
        notes: lead.notes.map((n) => ({
          id: n.id,
          text: n.text,
          authorName: n.author?.name ?? "Sistema",
          isYou: n.author?.id === ctx.userId,
          createdAt: n.createdAt.toISOString(),
        })),
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          data: jsonObject(e.data),
          createdAt: e.createdAt.toISOString(),
        })),
      },
    };
  } catch {
    return { ok: false, error: "Não foi possível carregar o lead." };
  }
}

const addNoteSchema = z.object({
  leadId: z.string().min(1),
  text: z.string().trim().min(1, "Escreva a nota").max(4000),
});

/** Adiciona nota interna ao lead. */
export async function addNote(input: unknown): Promise<AddNoteResult> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const lead = await ctx.db.lead.findUnique({
      where: { id: parsed.data.leadId },
      select: { id: true },
    });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    const note = await ctx.db.note.create({
      data: {
        workspaceId: ctx.workspaceId,
        leadId: lead.id,
        authorId: ctx.userId,
        text: parsed.data.text,
      },
    });
    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "note.added",
      entity: "Lead",
      entityId: lead.id,
      data: { noteId: note.id },
    });

    return {
      ok: true,
      note: {
        id: note.id,
        text: note.text,
        authorName: "Você",
        isYou: true,
        createdAt: note.createdAt.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Não foi possível salvar a nota." };
  }
}

/** Assume a conversa do lead: pausa a IA e as automações. */
export async function takeoverConversation(leadId: string): Promise<ActionResult> {
  const parsed = z.string().min(1).safeParse(leadId);
  if (!parsed.success) return { ok: false, error: "Lead inválido." };
  try {
    const ctx = await requireWorkspace();
    const lead = await ctx.db.lead.findUnique({
      where: { id: parsed.data },
      include: {
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 1, select: { id: true } },
      },
    });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    await ctx.db.conversation.updateMany({
      where: { leadId: lead.id },
      data: { state: "HUMAN" },
    });
    await ctx.db.lead.update({ where: { id: lead.id }, data: { aiStatus: "PAUSED" } });
    await ctx.db.automationRun.updateMany({
      where: { leadId: lead.id, state: "RUNNING" },
      data: { state: "PAUSED", pausedReason: "human_takeover" },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "conversation.human_takeover",
      entity: "Lead",
      entityId: lead.id,
      data: { conversationId: lead.conversations[0]?.id ?? null },
      notify: ["inbox", "pipeline"],
    });

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível assumir a conversa." };
  }
}

const markLostSchema = z.object({
  leadId: z.string().min(1),
  reason: z.string().trim().min(1, "Informe o motivo da perda").max(500),
});

/** Marca o lead como perdido com motivo (move para o estágio fixo Perdido). */
export async function markLeadLost(input: unknown): Promise<MoveLeadResult> {
  const parsed = markLostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const lostStage = await ctx.db.pipelineStage.findFirst({ where: { systemKey: "LOST" } });
    if (!lostStage) return { ok: false, error: "Estágio Perdido não encontrado no funil." };
    return await performStageMove(ctx, parsed.data.leadId, lostStage.id, {
      reason: parsed.data.reason,
    });
  } catch {
    return { ok: false, error: "Não foi possível marcar como perdido." };
  }
}

/** Exclui o lead definitivamente (LGPD): apaga lead, conversas, mensagens e notas em cascata. */
export async function deleteLead(leadId: string): Promise<ActionResult> {
  const parsed = z.string().min(1).safeParse(leadId);
  if (!parsed.success) return { ok: false, error: "Lead inválido." };
  try {
    const ctx = await requireWorkspace();
    const lead = await ctx.db.lead.findUnique({
      where: { id: parsed.data },
      select: { id: true, name: true },
    });
    if (!lead) return { ok: false, error: "Lead não encontrado." };

    await ctx.db.lead.delete({ where: { id: lead.id } });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "lead.deleted",
      entity: "Lead",
      entityId: lead.id,
      data: { name: lead.name, lgpd: true },
      notify: ["pipeline"],
    });

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível excluir o lead." };
  }
}
