"use server";

import type { QueueName } from "@vendaflow/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, hasAiCredential, MissingAiCredentialError } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { getQueue, QUEUES } from "@/lib/queues";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace, type WorkspaceContext } from "@/lib/session";
import { getCredentialData } from "@/server/credentials/service";

import { searchExploriumProspects, type VibeProspect } from "./explorium";
import { ghostedLeadsWhere, INERT_LEADS_WHERE } from "./queries";

/**
 * Server Actions do módulo Prospecção Ativa: fontes internas (CRM), busca via
 * Vibe Prospecting (Explorium), importação CSV, geração de abordagens com IA
 * e aprovação/disparo (prospect → lead + conversa + mensagem na fila).
 */

const GENERIC_ERROR = "Algo deu errado. Tente de novo em instantes.";
const MAX_BATCH = 50;
const MAX_AI_BATCH = 20;

/** Enfileira job no worker sem derrubar a mutação se o Redis/fila falhar. */
async function safeEnqueue(
  queue: QueueName,
  name: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await getQueue(queue).add(name, payload);
  } catch {
    // Fila indisponível não pode travar a ação principal.
  }
}

function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

// ── Fontes internas: contatos inertes e leads sumidos ───────────────────────

export interface BuildSourceListResult {
  ok: boolean;
  error?: string;
  listName?: string;
  added?: number;
  total?: number;
}

const SOURCE_LIST_CONFIG = {
  INERT_CONTACTS: { name: "Contatos sem resposta", event: "prospecting.inert_list_built" },
  GHOSTED: { name: "Leads sumidos", event: "prospecting.ghosted_list_built" },
} as const;

/** "Buscar leads" das fontes internas: cria/atualiza a ProspectList com os leads do CRM. */
export async function buildSourceListAction(
  kind: "INERT_CONTACTS" | "GHOSTED",
): Promise<BuildSourceListResult> {
  const parsed = z.enum(["INERT_CONTACTS", "GHOSTED"]).safeParse(kind);
  if (!parsed.success) return { ok: false, error: "Fonte inválida." };

  try {
    const ctx = await requireWorkspace();
    const config = SOURCE_LIST_CONFIG[parsed.data];

    const leads = await ctx.db.lead.findMany({
      where: parsed.data === "INERT_CONTACTS" ? INERT_LEADS_WHERE : ghostedLeadsWhere(),
      select: { id: true, name: true, phone: true, email: true },
      take: 500,
    });

    let list = await ctx.db.prospectList.findFirst({ where: { source: parsed.data } });
    if (!list) {
      list = await ctx.db.prospectList.create({
        data: { workspaceId: ctx.workspaceId, name: config.name, source: parsed.data },
      });
    } else {
      // Toca o updatedAt para a lista subir no topo.
      list = await ctx.db.prospectList.update({ where: { id: list.id }, data: {} });
    }

    const existing = await ctx.db.prospect.findMany({
      where: { listId: list.id },
      select: { leadId: true },
    });
    const knownLeadIds = new Set(existing.map((p) => p.leadId).filter(Boolean));

    const toCreate = leads.filter((lead) => !knownLeadIds.has(lead.id));
    if (toCreate.length > 0) {
      await ctx.db.prospect.createMany({
        data: toCreate.map((lead) => ({
          listId: list.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          leadId: lead.id,
          contacted: false,
        })),
      });
    }

    const total = await ctx.db.prospect.count({ where: { listId: list.id } });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: config.event,
      entity: "ProspectList",
      entityId: list.id,
      data: { added: toCreate.length, total },
    });

    revalidatePath("/prospeccao");
    return { ok: true, listName: list.name, added: toCreate.length, total };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Vibe Prospecting (Explorium) ────────────────────────────────────────────

export interface VibeProspectDto {
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export interface SearchProspectsResult {
  ok: boolean;
  missingCredential?: boolean;
  error?: string;
  prospects?: VibeProspectDto[];
}

/** Chat do Vibe: busca prospects reais na API do Explorium a partir do ICP descrito. */
export async function searchProspectsAction(icpDescription: string): Promise<SearchProspectsResult> {
  const parsed = z.string().trim().min(3, "Descreva quem você procura.").max(500).safeParse(icpDescription);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Descrição inválida." };
  }

  try {
    const ctx = await requireWorkspace();

    const credential = await getCredentialData(ctx.workspaceId, "EXPLORIUM");
    if (!credential?.apiKey) {
      return {
        ok: false,
        missingCredential: true,
        error: "Conecte o Vibe Prospecting (chave do Explorium) para buscar leads.",
      };
    }

    const limit = RATE_LIMITS.aiGeneration;
    const rl = await rateLimit(`vibe-search:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
    if (!rl.allowed) {
      return { ok: false, error: `Muitas buscas seguidas — aguarde ${rl.resetInSeconds}s e tente de novo.` };
    }

    const result = await searchExploriumProspects(credential.apiKey, parsed.data);
    if (!result.ok) return { ok: false, error: result.error };

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "prospecting.vibe_search",
      entity: "ProspectList",
      entityId: "vibe-search",
      data: { icp: parsed.data, results: result.prospects.length },
    });

    return { ok: true, prospects: result.prospects };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

const vibeProspectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).nullable(),
  role: z.string().trim().max(160).nullable(),
  email: z.string().trim().max(200).nullable(),
  phone: z.string().trim().max(40).nullable(),
});

const importVibeSchema = z.object({
  icp: z.string().trim().min(1).max(500),
  prospects: z.array(vibeProspectSchema).min(1, "Nenhum prospect para importar.").max(MAX_BATCH),
});

export interface ImportListResult {
  ok: boolean;
  error?: string;
  listName?: string;
  created?: number;
}

/** [Importar] do chat Vibe: cria ProspectList VIBE + Prospects com o resultado da busca. */
export async function importVibeProspectsAction(input: {
  icp: string;
  prospects: VibeProspect[];
}): Promise<ImportListResult> {
  const parsed = importVibeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const ctx = await requireWorkspace();
    const shortIcp = parsed.data.icp.length > 48 ? `${parsed.data.icp.slice(0, 48)}…` : parsed.data.icp;

    const list = await ctx.db.prospectList.create({
      data: { workspaceId: ctx.workspaceId, name: `Vibe · ${shortIcp}`, source: "VIBE" },
    });
    await ctx.db.prospect.createMany({
      data: parsed.data.prospects.map((prospect) => ({
        listId: list.id,
        name: prospect.name,
        company: prospect.company,
        role: prospect.role,
        email: prospect.email,
        phone: prospect.phone ? normalizePhone(prospect.phone) : null,
        contacted: false,
      })),
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "prospecting.vibe_imported",
      entity: "ProspectList",
      entityId: list.id,
      data: { icp: parsed.data.icp, created: parsed.data.prospects.length },
    });

    revalidatePath("/prospeccao");
    return { ok: true, listName: list.name, created: parsed.data.prospects.length };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Importar base (CSV) ─────────────────────────────────────────────────────

const csvRowSchema = z.object({
  linha: z.number().int().min(1),
  name: z.string().trim().max(160),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
});

const importCsvSchema = z.object({
  listName: z.string().trim().min(1, "Dê um nome à lista.").max(80),
  rows: z.array(csvRowSchema).min(1, "O CSV não tem linhas válidas.").max(1000),
});

export interface CsvImportError {
  linha: number;
  motivo: string;
}

export interface ImportCsvResult {
  ok: boolean;
  error?: string;
  listName?: string;
  created?: number;
  errors?: CsvImportError[];
}

/** Importa a base CSV mapeada no cliente: cria lista IMPORT + relatório linha a linha. */
export async function importCsvProspectsAction(input: unknown): Promise<ImportCsvResult> {
  const parsed = importCsvSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const ctx = await requireWorkspace();
    const errors: CsvImportError[] = [];
    const valid: Array<{ name: string; company: string | null; role: string | null; phone: string | null; email: string | null }> = [];

    for (const row of parsed.data.rows) {
      const name = row.name.trim();
      if (!name) {
        errors.push({ linha: row.linha, motivo: "Nome vazio" });
        continue;
      }
      const email = row.email?.trim() || null;
      if (email && !z.string().email().safeParse(email).success) {
        errors.push({ linha: row.linha, motivo: "E-mail inválido" });
        continue;
      }
      const rawPhone = row.phone?.trim() || null;
      const phone = rawPhone ? normalizePhone(rawPhone) : null;
      if (rawPhone && !phone) {
        errors.push({ linha: row.linha, motivo: "WhatsApp inválido (use DDD + número)" });
        continue;
      }
      valid.push({
        name,
        company: row.company?.trim() || null,
        role: row.role?.trim() || null,
        phone,
        email,
      });
    }

    if (valid.length === 0) {
      return { ok: false, error: "Nenhuma linha válida para importar.", errors };
    }

    const list = await ctx.db.prospectList.create({
      data: { workspaceId: ctx.workspaceId, name: parsed.data.listName, source: "IMPORT" },
    });
    await ctx.db.prospect.createMany({
      data: valid.map((row) => ({ listId: list.id, ...row, contacted: false })),
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "prospecting.csv_imported",
      entity: "ProspectList",
      entityId: list.id,
      data: { created: valid.length, errors: errors.length },
    });

    revalidatePath("/prospeccao");
    return { ok: true, listName: list.name, created: valid.length, errors };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Gerar abordagem com IA ──────────────────────────────────────────────────

export interface GenerateOutreachResult {
  ok: boolean;
  missingCredential?: boolean;
  error?: string;
  generated?: number;
  failed?: number;
}

interface ProspectForOutreach {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  list: { source: string };
}

async function buildOutreachSystemPrompt(ctx: WorkspaceContext): Promise<string> {
  const [persona, offer] = await Promise.all([
    ctx.db.agentPersona.findFirst({ orderBy: { createdAt: "asc" } }),
    ctx.db.productOffer.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const personaBlock = persona
    ? `Você é ${persona.name}, SDR. Fala como: ${persona.speaksAs}. Tom: ${persona.tone}. ${persona.emojis ? "Pode usar no máximo 1 emoji." : "Não use emojis."}`
    : "Você é o SDR do workspace. Tom equilibrado, caloroso e direto.";
  const offerBlock = offer ? `Produto que você representa: ${offer.name}.` : "";

  return [
    personaBlock,
    offerBlock,
    "Escreva UMA mensagem curta de abertura (primeira mensagem de WhatsApp) para o prospect informado.",
    "Regras: no máximo 2 frases + 1 pergunta aberta no final; personalize com cargo/empresa quando fizer sentido;",
    "nunca fale de preço, prazo ou promessa; não envie links; não invente fatos sobre o prospect;",
    "português do Brasil, natural, sem parecer robô e sem saudações genéricas.",
    "Responda SOMENTE com o texto da mensagem, sem aspas e sem comentários.",
  ].join("\n");
}

/** Gera abordagem personalizada (Outreach DRAFT) para cada prospect selecionado. */
export async function generateOutreachAction(prospectIds: string[]): Promise<GenerateOutreachResult> {
  const parsed = z.array(z.string().min(1)).min(1, "Selecione ao menos um lead.").max(MAX_AI_BATCH, `Gere no máximo ${MAX_AI_BATCH} abordagens por vez.`).safeParse(prospectIds);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Seleção inválida." };
  }

  try {
    const ctx = await requireWorkspace();

    if (!(await hasAiCredential(ctx.workspaceId))) {
      return {
        ok: false,
        missingCredential: true,
        error: "Configure sua chave da Anthropic em Configurações para usar a IA.",
      };
    }

    const limit = RATE_LIMITS.aiGeneration;
    const rl = await rateLimit(`outreach-gen:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
    if (!rl.allowed) {
      return { ok: false, error: `Muitas gerações seguidas — aguarde ${rl.resetInSeconds}s e tente de novo.` };
    }

    const prospects: ProspectForOutreach[] = await ctx.db.prospect.findMany({
      where: { id: { in: parsed.data }, contacted: false },
      select: { id: true, name: true, role: true, company: true, list: { select: { source: true } } },
    });
    if (prospects.length === 0) {
      return { ok: false, error: "Nenhum prospect elegível — eles podem já ter sido contatados." };
    }

    const system = await buildOutreachSystemPrompt(ctx);
    let generated = 0;
    let failed = 0;

    for (const prospect of prospects) {
      const existingDraft = await ctx.db.outreach.findFirst({
        where: { prospectId: prospect.id, status: "DRAFT" },
        select: { id: true },
      });
      if (existingDraft) continue; // já tem rascunho aguardando revisão

      try {
        const message = await completeWithUsage({
          workspaceId: ctx.workspaceId,
          feature: "prospecting.outreach",
          tier: "chat",
          system,
          messages: [
            {
              role: "user",
              content: `Prospect: ${prospect.name} — ${prospect.role ?? "cargo não informado"} na ${prospect.company ?? "empresa não informada"}.`,
            },
          ],
          maxTokens: 300,
        });
        const text = message.trim();
        if (!text) {
          failed += 1;
          continue;
        }
        await ctx.db.outreach.create({
          data: { prospectId: prospect.id, message: text, status: "DRAFT" },
        });
        generated += 1;
      } catch (error) {
        if (error instanceof MissingAiCredentialError) {
          return { ok: false, missingCredential: true, error: error.message };
        }
        failed += 1;
      }
    }

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "AI",
      type: "prospecting.outreach_generated",
      entity: "ProspectList",
      entityId: prospects[0]?.id ?? "outreach",
      data: { generated, failed },
    });

    revalidatePath("/prospeccao");
    return { ok: true, generated, failed };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Editar abordagem ────────────────────────────────────────────────────────

export interface SimpleResult {
  ok: boolean;
  error?: string;
}

const updateOutreachSchema = z.object({
  outreachId: z.string().min(1),
  message: z.string().trim().min(1, "A mensagem não pode ficar vazia.").max(1200),
});

export async function updateOutreachAction(
  outreachId: string,
  message: string,
): Promise<SimpleResult> {
  const parsed = updateOutreachSchema.safeParse({ outreachId, message });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  try {
    const ctx = await requireWorkspace();
    const outreach = await ctx.db.outreach.findFirst({
      where: { id: parsed.data.outreachId, status: "DRAFT" },
      select: { id: true },
    });
    if (!outreach) return { ok: false, error: "Abordagem não encontrada ou já enviada." };

    await ctx.db.outreach.update({
      where: { id: outreach.id },
      data: { message: parsed.data.message },
    });
    revalidatePath("/prospeccao");
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Enviar para o Pipeline (sem mensagem) ───────────────────────────────────

export interface SendToPipelineResult {
  ok: boolean;
  error?: string;
  created?: number;
  skipped?: number;
}

async function resolveEntryStage(db: WorkspaceContext["db"]) {
  return (
    (await db.pipelineStage.findFirst({ where: { systemKey: "NEW" } })) ??
    (await db.pipelineStage.findFirst({ orderBy: { order: "asc" } }))
  );
}

/** "Enviar para o Pipeline": cria Leads direto a partir dos prospects (sem abordagem). */
export async function sendProspectsToPipelineAction(
  prospectIds: string[],
): Promise<SendToPipelineResult> {
  const parsed = z.array(z.string().min(1)).min(1, "Selecione ao menos um lead.").max(MAX_BATCH).safeParse(prospectIds);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Seleção inválida." };
  }

  try {
    const ctx = await requireWorkspace();
    const stage = await resolveEntryStage(ctx.db);
    if (!stage) return { ok: false, error: "Nenhum estágio configurado no pipeline." };

    const prospects = await ctx.db.prospect.findMany({
      where: { id: { in: parsed.data }, contacted: false },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        leadId: true,
        list: { select: { name: true } },
      },
    });

    let created = 0;
    let skipped = 0;

    for (const prospect of prospects) {
      if (prospect.leadId) {
        // Já é lead do CRM (fontes internas): só marca como tratado.
        await ctx.db.prospect.update({ where: { id: prospect.id }, data: { contacted: true } });
        skipped += 1;
        continue;
      }
      if (!prospect.phone) {
        skipped += 1;
        continue;
      }
      const duplicate = await ctx.db.lead.findFirst({
        where: { phone: prospect.phone },
        select: { id: true },
      });
      if (duplicate) {
        await ctx.db.prospect.update({
          where: { id: prospect.id },
          data: { contacted: true, leadId: duplicate.id },
        });
        skipped += 1;
        continue;
      }

      const lead = await ctx.db.lead.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: prospect.name,
          phone: prospect.phone,
          email: prospect.email,
          source: "prospeccao",
          prospectOrigin: prospect.list.name,
          stageId: stage.id,
          temperature: "COLD",
          aiStatus: "RUNNING",
        },
      });
      await ctx.db.conversation.create({
        data: { workspaceId: ctx.workspaceId, leadId: lead.id, channel: "WHATSAPP", state: "BOT" },
      });
      await ctx.db.prospect.update({
        where: { id: prospect.id },
        data: { contacted: true, leadId: lead.id },
      });
      await logEvent({
        workspaceId: ctx.workspaceId,
        actorType: "USER",
        actorId: ctx.userId,
        type: "lead.created",
        entity: "Lead",
        entityId: lead.id,
        data: { name: lead.name, source: "prospeccao", stageId: stage.id, stageName: stage.name },
        notify: ["pipeline"],
      });
      created += 1;
    }

    revalidatePath("/prospeccao");
    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { ok: true, created, skipped };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Aprovar e enviar abordagens ─────────────────────────────────────────────

export interface ApproveAndSendResult {
  ok: boolean;
  error?: string;
  sent?: number;
  skipped?: number;
}

/**
 * Aprova as abordagens: prospect vira Lead (origem prospecção), ganha Conversation
 * e Message OUT da IA na fila de envio; a conversa continua no Inbox.
 */
export async function approveAndSendAction(outreachIds: string[]): Promise<ApproveAndSendResult> {
  const parsed = z.array(z.string().min(1)).min(1, "Selecione ao menos uma abordagem.").max(MAX_BATCH).safeParse(outreachIds);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Seleção inválida." };
  }

  try {
    const ctx = await requireWorkspace();
    const stage = await resolveEntryStage(ctx.db);
    if (!stage) return { ok: false, error: "Nenhum estágio configurado no pipeline." };

    const outreaches = await ctx.db.outreach.findMany({
      where: { id: { in: parsed.data }, status: "DRAFT" },
      select: {
        id: true,
        message: true,
        prospect: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            leadId: true,
            list: { select: { name: true } },
          },
        },
      },
    });
    if (outreaches.length === 0) {
      return { ok: false, error: "Nenhuma abordagem pendente encontrada." };
    }

    const now = new Date();
    let sent = 0;
    let skipped = 0;

    for (const outreach of outreaches) {
      const prospect = outreach.prospect;
      if (!prospect.phone) {
        skipped += 1;
        continue;
      }

      // Reaproveita o lead existente (mesmo telefone ou fonte interna do CRM).
      let leadId = prospect.leadId;
      let isNewLead = false;
      if (!leadId) {
        const duplicate = await ctx.db.lead.findFirst({
          where: { phone: prospect.phone },
          select: { id: true },
        });
        leadId = duplicate?.id ?? null;
      }
      if (!leadId) {
        const lead = await ctx.db.lead.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: prospect.name,
            phone: prospect.phone,
            email: prospect.email,
            source: "prospeccao",
            prospectOrigin: prospect.list.name,
            stageId: stage.id,
            temperature: "COLD",
            aiStatus: "RUNNING",
            lastInteractionAt: now,
          },
        });
        leadId = lead.id;
        isNewLead = true;
      }

      let conversation = await ctx.db.conversation.findFirst({
        where: { leadId, channel: "WHATSAPP" },
        select: { id: true },
      });
      if (!conversation) {
        conversation = await ctx.db.conversation.create({
          data: { workspaceId: ctx.workspaceId, leadId, channel: "WHATSAPP", state: "BOT" },
          select: { id: true },
        });
      }

      const message = await ctx.db.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUT",
          authorType: "AI",
          kind: "TEXT",
          content: { text: outreach.message },
          status: "QUEUED",
        },
      });
      await ctx.db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: now },
      });

      await safeEnqueue(QUEUES.outbound, "send", {
        workspaceId: ctx.workspaceId,
        conversationId: conversation.id,
        messageId: message.id,
        kind: "TEXT",
        payload: { text: outreach.message },
      });

      await ctx.db.outreach.update({
        where: { id: outreach.id },
        data: { status: "CONVERTED", approvedById: ctx.userId, sentAt: now },
      });
      await ctx.db.prospect.update({
        where: { id: prospect.id },
        data: { contacted: true, leadId },
      });

      if (isNewLead) {
        await logEvent({
          workspaceId: ctx.workspaceId,
          actorType: "USER",
          actorId: ctx.userId,
          type: "lead.created",
          entity: "Lead",
          entityId: leadId,
          data: { name: prospect.name, source: "prospeccao", stageId: stage.id, stageName: stage.name },
          notify: ["pipeline"],
        });
      }
      await logEvent({
        workspaceId: ctx.workspaceId,
        actorType: "AI",
        type: "message.sent",
        entity: "Message",
        entityId: message.id,
        data: { conversationId: conversation.id, leadId, authorType: "AI", outreach: true },
        notify: ["inbox"],
      });

      sent += 1;
    }

    revalidatePath("/prospeccao");
    revalidatePath("/pipeline");
    revalidatePath("/inbox");
    return { ok: true, sent, skipped };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
