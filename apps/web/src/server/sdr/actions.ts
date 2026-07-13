"use server";

import { validatePersonaMarkdown } from "@sales4u/core";
import type { Prisma } from "@sales4u/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, MissingAiCredentialError } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace, type WorkspaceContext } from "@/lib/session";
import { deleteObject, putObject } from "@/lib/storage";

import { isAlwaysOn } from "./queries";
import {
  MAX_CADENCE_TOUCHES,
  MAX_MODE_MARKDOWN_FILES,
  touchDelayLabel,
  type CadenceTextResult,
  type ModeMarkdownResult,
  type PreviewResult,
  type SdrActionResult,
} from "./types";

/** Server Actions do módulo SDR de IA (persona, modos, guardrails, cadências). */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_MD_BYTES = 1024 * 1024;

const TONE_LABELS: Record<string, string> = {
  formal: "formal",
  balanced: "equilibrado",
  informal: "informal",
};

const SPEAKS_AS_LABELS: Record<string, string> = {
  owner: "o dono do negócio",
  mentor: "o mentor",
  team: "a equipe",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Lê Workspace.settings e grava o merge raso das chaves informadas. */
async function mergeWorkspaceSettings(
  ctx: WorkspaceContext,
  patch: Record<string, unknown>,
): Promise<void> {
  const workspace = await ctx.db.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { settings: true },
  });
  const settings = asRecord(workspace?.settings);
  await ctx.db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { settings: { ...settings, ...patch } as Prisma.InputJsonValue },
  });
}

// ── Persona ───────────────────────────────────────────────────────────────

const personaSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao assistente.").max(60),
  speaksAs: z.enum(["owner", "mentor", "team"]),
  tone: z.enum(["formal", "balanced", "informal"]),
  msgLength: z.enum(["short", "medium"]),
  emojis: z.boolean(),
  always: z.boolean(),
  windowStart: z.string().regex(HHMM, "Horário inválido (use HH:MM)."),
  windowEnd: z.string().regex(HHMM, "Horário inválido (use HH:MM)."),
});

export async function updatePersona(input: unknown): Promise<SdrActionResult> {
  const parsed = personaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const existing = await ctx.db.agentPersona.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, activeHours: true },
    });

    const previousHours = asRecord(existing?.activeHours);
    const previousDays =
      Array.isArray(previousHours["days"]) &&
      !isAlwaysOn(existing?.activeHours) &&
      (previousHours["days"] as unknown[]).length > 0
        ? (previousHours["days"] as number[])
        : [1, 2, 3, 4, 5, 6];

    const activeHours = parsed.data.always
      ? { start: "00:00", end: "23:59", days: [0, 1, 2, 3, 4, 5, 6] }
      : { start: parsed.data.windowStart, end: parsed.data.windowEnd, days: previousDays };

    const data = {
      name: parsed.data.name,
      speaksAs: parsed.data.speaksAs,
      tone: parsed.data.tone,
      msgLength: parsed.data.msgLength,
      emojis: parsed.data.emojis,
      activeHours,
    };

    const saved = existing
      ? await ctx.db.agentPersona.update({ where: { id: existing.id }, data })
      : await ctx.db.agentPersona.create({ data: { ...data, workspaceId: ctx.workspaceId } });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.persona_updated",
      entity: "AgentPersona",
      entityId: saved.id,
      data: { name: parsed.data.name },
    });

    revalidatePath("/sdr");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar a persona. Tente de novo." };
  }
}

const previewSchema = z.object({
  assistantName: z.string().trim().min(1).max(60),
  speaksAs: z.enum(["owner", "mentor", "team"]),
  tone: z.enum(["formal", "balanced", "informal"]),
  msgLength: z.enum(["short", "medium"]),
  emojis: z.boolean(),
});

/** Gera a prévia da mensagem com IA usando as configurações atuais da aba Persona. */
export async function generatePersonaPreview(input: unknown): Promise<PreviewResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  try {
    const ctx = await requireWorkspace();

    const limit = RATE_LIMITS.aiGeneration;
    const rl = await rateLimit(`sdr-preview:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
    if (!rl.allowed) {
      return { ok: false, error: `Muitas gerações seguidas — aguarde ${rl.resetInSeconds}s.` };
    }

    const product = await ctx.db.productOffer.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true, priceCents: true, guarantee: true },
    });

    const price = product
      ? `R$ ${(product.priceCents / 100).toLocaleString("pt-BR")}`
      : "preço ainda não cadastrado";
    const p = parsed.data;

    const system = [
      `Você é ${p.assistantName}, vendedor(a) por WhatsApp de um infoproduto. Fala em nome de ${SPEAKS_AS_LABELS[p.speaksAs]}.`,
      `Tom ${TONE_LABELS[p.tone]}; mensagens ${p.msgLength === "short" ? "curtas (1-2 frases)" : "médias (2-4 frases)"}.`,
      p.emojis ? "Pode usar no máximo 1 emoji." : "Não use emojis.",
      product
        ? `Produto: ${product.name} — ${price}, parcelável em até 12x.${product.guarantee ? ` Garantia: ${product.guarantee}.` : ""}`
        : "Nenhum produto cadastrado: diga com honestidade que vai confirmar o preço.",
      "Nunca invente preço, prazo ou promessa. Responda em pt-BR somente com o texto da mensagem, sem aspas.",
    ].join("\n");

    const text = await completeWithUsage({
      workspaceId: ctx.workspaceId,
      feature: "sdr.persona_preview",
      tier: "chat",
      system,
      messages: [{ role: "user", content: "Oi! Quanto custa o curso?" }],
      maxTokens: 300,
    });

    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "A IA não retornou a prévia. Tente de novo." };
    return { ok: true, text: trimmed };
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Não foi possível gerar a prévia agora. Tente de novo." };
  }
}

// ── Modos do agente ───────────────────────────────────────────────────────

const modesSchema = z.object({
  modes: z
    .array(
      z.object({
        slot: z.number().int().min(1).max(3),
        name: z.string().trim().min(1, "Dê um nome a cada modo configurado.").max(60),
        sentiment: z.string().trim().max(200),
        guidance: z.string().trim().max(4000),
      }),
    )
    .max(3),
});

/** Salva nome e configuração de plataforma dos modos (markdown é salvo no upload). */
export async function saveAgentModes(input: unknown): Promise<SdrActionResult> {
  const parsed = modesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const existing = await ctx.db.agentMode.findMany({
      select: { id: true, slot: true, configJson: true },
    });

    for (const mode of parsed.data.modes) {
      const current = existing.find((m) => m.slot === mode.slot);
      const config = {
        ...asRecord(current?.configJson),
        sentiment: mode.sentiment,
        guidance: mode.guidance,
      };
      if (current) {
        await ctx.db.agentMode.update({
          where: { id: current.id },
          data: { name: mode.name, configJson: config as Prisma.InputJsonValue },
        });
      } else {
        await ctx.db.agentMode.create({
          data: {
            workspaceId: ctx.workspaceId,
            slot: mode.slot,
            name: mode.name,
            source: "PLATFORM",
            configJson: config as Prisma.InputJsonValue,
          },
        });
      }
    }

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.modes_updated",
      entity: "AgentMode",
      entityId: ctx.workspaceId,
      data: { slots: parsed.data.modes.map((m) => m.slot) },
    });

    revalidatePath("/sdr");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar os modos. Tente de novo." };
  }
}

/**
 * Upload do .md de um modo: valida com validatePersonaMarkdown, sobe para o
 * storage e grava markdownKey. Enforcement real do limite de 3 arquivos.
 */
export async function uploadModeMarkdown(formData: FormData): Promise<ModeMarkdownResult> {
  const slot = Number(formData.get("slot"));
  const nameRaw = String(formData.get("name") ?? "").trim();
  const file = formData.get("file");

  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    return { ok: false, error: "Slot inválido." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Anexe um arquivo .md." };
  }
  if (!file.name.toLowerCase().endsWith(".md")) {
    return { ok: false, error: "Formato não suportado — envie um arquivo .md." };
  }
  if (file.size > MAX_MD_BYTES) {
    return { ok: false, error: "Arquivo acima de 1 MB." };
  }

  try {
    const ctx = await requireWorkspace();
    const text = Buffer.from(await file.arrayBuffer()).toString("utf8");

    const validation = validatePersonaMarkdown(text);
    if (!validation.ok) return { ok: false, errors: validation.errors };

    const modes = await ctx.db.agentMode.findMany({
      select: { id: true, slot: true, markdownKey: true, configJson: true },
    });
    const current = modes.find((m) => m.slot === slot);

    const markdownCount = modes.filter((m) => m.markdownKey && m.slot !== slot).length;
    if (markdownCount >= MAX_MODE_MARKDOWN_FILES) {
      return {
        ok: false,
        error: `Limite atingido: máximo ${MAX_MODE_MARKDOWN_FILES} arquivos markdown somando todos os modos.`,
      };
    }

    const storageKey = `sdr/modes/${ctx.workspaceId}/slot-${slot}-${Date.now()}.md`;
    await putObject(storageKey, Buffer.from(text, "utf8"), "text/markdown");

    if (current?.markdownKey && current.markdownKey !== storageKey) {
      try {
        await deleteObject(current.markdownKey);
      } catch {
        // Binário antigo órfão não bloqueia a troca.
      }
    }

    const modeName = nameRaw || validation.value?.title || `Modo ${slot}`;
    const config = {
      ...asRecord(current?.configJson),
      markdownName: file.name,
      markdownSize: file.size,
    } as Prisma.InputJsonValue;

    const saved = current
      ? await ctx.db.agentMode.update({
          where: { id: current.id },
          data: { name: modeName, source: "MARKDOWN", markdownKey: storageKey, configJson: config },
        })
      : await ctx.db.agentMode.create({
          data: {
            workspaceId: ctx.workspaceId,
            slot,
            name: modeName,
            source: "MARKDOWN",
            markdownKey: storageKey,
            configJson: config,
          },
        });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.mode_markdown_uploaded",
      entity: "AgentMode",
      entityId: saved.id,
      data: { slot, fileName: file.name },
    });

    revalidatePath("/sdr");
    return { ok: true, markdownName: file.name, markdownSize: file.size };
  } catch {
    return { ok: false, error: "Não foi possível enviar o .md. Verifique o storage e tente de novo." };
  }
}

/** Remove o .md do modo e volta a configuração para a plataforma. */
export async function removeModeMarkdown(slot: number): Promise<SdrActionResult> {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    return { ok: false, error: "Slot inválido." };
  }
  try {
    const ctx = await requireWorkspace();
    const mode = await ctx.db.agentMode.findFirst({
      where: { slot },
      select: { id: true, markdownKey: true, configJson: true },
    });
    if (!mode) return { ok: false, error: "Modo não encontrado." };

    if (mode.markdownKey) {
      try {
        await deleteObject(mode.markdownKey);
      } catch {
        // Binário órfão não bloqueia a remoção.
      }
    }

    const config = { ...asRecord(mode.configJson) };
    delete config["markdownName"];
    delete config["markdownSize"];

    await ctx.db.agentMode.update({
      where: { id: mode.id },
      data: {
        source: "PLATFORM",
        markdownKey: null,
        configJson: config as Prisma.InputJsonValue,
      },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.mode_markdown_removed",
      entity: "AgentMode",
      entityId: mode.id,
      data: { slot },
    });

    revalidatePath("/sdr");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível remover o arquivo." };
  }
}

/** Define o modo ativo (apenas 1 isActive por workspace). */
export async function setActiveMode(slot: number): Promise<SdrActionResult> {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    return { ok: false, error: "Slot inválido." };
  }
  try {
    const ctx = await requireWorkspace();
    const mode = await ctx.db.agentMode.findFirst({
      where: { slot },
      select: { id: true, name: true },
    });
    if (!mode) {
      return { ok: false, error: "Configure e salve este modo antes de ativá-lo." };
    }

    await ctx.db.agentMode.updateMany({ data: { isActive: false } });
    await ctx.db.agentMode.update({ where: { id: mode.id }, data: { isActive: true } });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.mode_activated",
      entity: "AgentMode",
      entityId: mode.id,
      data: { slot, name: mode.name },
    });

    revalidatePath("/sdr");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível ativar o modo." };
  }
}

// ── Guardrails ────────────────────────────────────────────────────────────

const guardrailsSchema = z.object({
  guardrails: z.object({
    neverInvent: z.boolean(),
    productOnly: z.boolean(),
    noCompetitors: z.boolean(),
    respectOptOut: z.boolean(),
    respectTouchCap: z.boolean(),
    escalateSensitive: z.boolean(),
  }),
  handoffKeywords: z.array(z.string().trim().min(1).max(40)).max(30),
});

export async function updateGuardrails(input: unknown): Promise<SdrActionResult> {
  const parsed = guardrailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  try {
    const ctx = await requireWorkspace();
    const keywords = [...new Set(parsed.data.handoffKeywords.map((k) => k.toLowerCase()))];

    await mergeWorkspaceSettings(ctx, {
      guardrails: parsed.data.guardrails,
      handoffKeywords: keywords,
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.guardrails_updated",
      entity: "Workspace",
      entityId: ctx.workspaceId,
      data: { handoffKeywords: keywords },
    });

    revalidatePath("/sdr");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar os guardrails. Tente de novo." };
  }
}

// ── Cadências ─────────────────────────────────────────────────────────────

const cadenceSchema = z.object({
  touches: z
    .array(
      z.object({
        minutes: z.number().int().min(0).max(90 * 1440),
        channel: z.enum(["whatsapp", "email"]),
        text: z.string().max(2000),
      }),
    )
    .min(1, "A cadência precisa de pelo menos 1 toque.")
    .max(MAX_CADENCE_TOUCHES),
  maxTouches: z.number().int().min(1).max(MAX_CADENCE_TOUCHES),
});

export async function updateCadence(input: unknown): Promise<SdrActionResult> {
  const parsed = cadenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const { touches, maxTouches } = parsed.data;

    const intervals = touches.map((t) => t.minutes);
    const channels = touches.map((t) => t.channel);
    const templates = touches.map((t) => t.text.trim());

    await mergeWorkspaceSettings(ctx, {
      defaultCadence: { intervals, channels, maxTouches },
      cadenceTemplates: templates,
    });

    // Mantém o motor coerente: sincroniza a cadência do playbook de "Em conversa".
    const emConversa = await ctx.db.pipelineStage.findFirst({
      where: { name: { equals: "Em conversa", mode: "insensitive" } },
      select: { id: true, playbook: { select: { id: true } } },
    });
    if (emConversa?.playbook) {
      await ctx.db.stagePlaybook.update({
        where: { id: emConversa.playbook.id },
        data: { cadence: { intervals, maxTouches } },
      });
    }

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "sdr.cadence_updated",
      entity: "Workspace",
      entityId: ctx.workspaceId,
      data: { touches: intervals.length, maxTouches },
    });

    revalidatePath("/sdr");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar a cadência. Tente de novo." };
  }
}

const cadenceTextSchema = z.object({
  touchIndex: z.number().int().min(0).max(MAX_CADENCE_TOUCHES - 1),
  minutes: z.number().int().min(0).max(90 * 1440),
  channel: z.enum(["whatsapp", "email"]),
});

/** Gera o texto de um toque da cadência com IA (persona + produto reais). */
export async function generateCadenceText(input: unknown): Promise<CadenceTextResult> {
  const parsed = cadenceTextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  try {
    const ctx = await requireWorkspace();

    const limit = RATE_LIMITS.aiGeneration;
    const rl = await rateLimit(`sdr-cadence:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
    if (!rl.allowed) {
      return { ok: false, error: `Muitas gerações seguidas — aguarde ${rl.resetInSeconds}s.` };
    }

    const [persona, product] = await Promise.all([
      ctx.db.agentPersona.findFirst({
        orderBy: { createdAt: "asc" },
        select: { name: true, tone: true, emojis: true, msgLength: true },
      }),
      ctx.db.productOffer.findFirst({
        orderBy: { createdAt: "asc" },
        select: { name: true, priceCents: true },
      }),
    ]);

    const { touchIndex, minutes, channel } = parsed.data;
    const channelLabel = channel === "email" ? "e-mail" : "WhatsApp";

    const system = [
      `Você é ${persona?.name ?? "a assistente de vendas"}, SDR de IA${product ? ` do produto "${product.name}"` : ""}.`,
      persona ? `Tom: ${TONE_LABELS[persona.tone] ?? persona.tone}. ${persona.emojis ? "Pode usar no máximo 1 emoji." : "Não use emojis."}` : "",
      product ? `Preço: R$ ${(product.priceCents / 100).toLocaleString("pt-BR")}, em até 12x.` : "",
      `Escreva o toque ${touchIndex + 1} de uma cadência de follow-up para um lead que parou de responder — enviado ${touchDelayLabel(minutes)} depois do último contato, pelo canal ${channelLabel}.`,
      "Mensagem curta, humana, sem pressão e sem inventar preço, prazo ou promessa. Termine com uma pergunta leve.",
      "Responda em pt-BR somente com o texto da mensagem, sem aspas nem assinatura.",
    ]
      .filter(Boolean)
      .join("\n");

    const text = await completeWithUsage({
      workspaceId: ctx.workspaceId,
      feature: "sdr.cadence_text",
      tier: "chat",
      system,
      messages: [{ role: "user", content: "Gere o texto deste toque." }],
      maxTokens: 300,
    });

    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "A IA não retornou texto. Tente de novo." };
    return { ok: true, text: trimmed };
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Não foi possível gerar o texto agora. Tente de novo." };
  }
}
