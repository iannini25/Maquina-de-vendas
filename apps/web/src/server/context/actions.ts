"use server";

import { QUEUES } from "@vendaflow/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { getQueue } from "@/lib/queues";
import { requireWorkspace, type WorkspaceContext } from "@/lib/session";
import { deleteObject, putObject } from "@/lib/storage";

import type { ContextActionResult } from "./types";

/** Server Actions do módulo Contexto (arquivos de conhecimento da IA). */

const CONTEXT_TYPES = [
  "DESIGN_SYSTEM",
  "TEXT",
  "PDF",
  "FAQ",
  "PRICING",
  "OBJECTIONS",
  "TONE",
  "ICP",
  "SCRIPTS",
] as const;

const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Enfileira a ingestão RAG; retorna false se a fila estiver indisponível. */
async function enqueueIngest(workspaceId: string, contextFileId: string): Promise<boolean> {
  try {
    // Nome do job = contrato do worker (CONTEXT_INGEST_JOBS.ingestFile)
    await getQueue(QUEUES.contextIngest).add("ingest-file", {
      workspaceId,
      contextFileId,
    });
    return true;
  } catch {
    return false;
  }
}

/** Marca PROCESSING quando a fila aceitou o job; PENDING quando não (estado honesto). */
async function startIndexing(ctx: WorkspaceContext, contextFileId: string): Promise<void> {
  const queued = await enqueueIngest(ctx.workspaceId, contextFileId);
  await ctx.db.contextFile.update({
    where: { id: contextFileId },
    data: { status: queued ? "PROCESSING" : "PENDING", error: null },
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").slice(0, 120);
}

/** Deriva o nome do arquivo a partir da primeira linha do conteúdo colado. */
function nameFromContent(content: string, fallback: string): string {
  const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? "";
  if (!firstLine) return fallback;
  const cleaned = firstLine.replace(/^#+\s*/, "");
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned;
}

const linkSchema = z
  .string()
  .regex(/^(product|campaign):.+$/)
  .or(z.literal(""));

async function resolveLink(
  ctx: WorkspaceContext,
  link: string,
): Promise<{ productOfferId: string | null; campaignId: string | null } | null> {
  if (!link) return { productOfferId: null, campaignId: null };
  const [kind, id] = link.split(":", 2) as [string, string];
  if (kind === "product") {
    const product = await ctx.db.productOffer.findUnique({ where: { id }, select: { id: true } });
    if (!product) return null;
    return { productOfferId: product.id, campaignId: null };
  }
  const campaign = await ctx.db.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return null;
  return { productOfferId: null, campaignId: campaign.id };
}

const createSchema = z.object({
  type: z.enum(CONTEXT_TYPES),
  link: linkSchema,
  content: z.string().max(200_000),
});

/**
 * Cria um arquivo de contexto (texto colado e/ou arquivo PDF/texto),
 * sobe o binário para o storage e enfileira a indexação RAG.
 */
export async function createContextFile(formData: FormData): Promise<ContextActionResult> {
  const parsed = createSchema.safeParse({
    type: formData.get("type"),
    link: formData.get("link") ?? "",
    content: String(formData.get("content") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Dados inválidos — revise o formulário." };

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const content = parsed.data.content.trim();

  if (!hasFile && !content) {
    return { ok: false, error: "Cole o texto do contexto ou anexe um arquivo." };
  }

  try {
    const ctx = await requireWorkspace();

    let rawText: string | null = content || null;
    let fileName: string | null = null;
    let uploadBody: Buffer | null = null;
    let contentType = "text/plain; charset=utf-8";

    if (hasFile) {
      const lower = file.name.toLowerCase();
      const isPdf = lower.endsWith(".pdf");
      const isText = TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
      if (!isPdf && !isText) {
        return { ok: false, error: "Formato não suportado — envie PDF ou arquivo de texto (.txt/.md/.csv)." };
      }
      if (file.size > MAX_FILE_BYTES) {
        return { ok: false, error: "Arquivo acima de 8 MB." };
      }
      fileName = file.name;
      uploadBody = Buffer.from(await file.arrayBuffer());
      contentType = isPdf ? "application/pdf" : "text/plain; charset=utf-8";
      if (isText && !rawText) rawText = uploadBody.toString("utf8");
    }

    const linkIds = await resolveLink(ctx, parsed.data.link);
    if (!linkIds) return { ok: false, error: "Vínculo não encontrado — recarregue a página." };

    const typeLabel = parsed.data.type === "PDF" ? "Documento PDF" : "Contexto";
    const name = fileName ?? nameFromContent(content, typeLabel);

    let storageKey: string | null = null;
    if (uploadBody && fileName) {
      storageKey = `context/${ctx.workspaceId}/${Date.now()}-${sanitizeFileName(fileName)}`;
      try {
        await putObject(storageKey, uploadBody, contentType);
      } catch {
        if (!rawText) {
          return { ok: false, error: "Falha ao subir o arquivo para o storage. Verifique o MinIO/S3." };
        }
        storageKey = null; // segue só com o texto — o binário pode ser reenviado depois
      }
    }

    const created = await ctx.db.contextFile.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: parsed.data.type,
        name,
        rawText,
        storageKey,
        status: "PENDING",
        productOfferId: linkIds.productOfferId,
        campaignId: linkIds.campaignId,
      },
    });

    await startIndexing(ctx, created.id);

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "context.file_created",
      entity: "ContextFile",
      entityId: created.id,
      data: { name: created.name, type: created.type },
    });

    revalidatePath("/contexto");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar o contexto. Tente de novo." };
  }
}

const updateTextSchema = z.object({
  id: z.string().min(1),
  rawText: z.string().trim().min(1, "O conteúdo não pode ficar vazio.").max(200_000),
});

/** Edita o texto de um arquivo de contexto e reindexa. */
export async function updateContextFileText(input: unknown): Promise<ContextActionResult> {
  const parsed = updateTextSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const ctx = await requireWorkspace();
    const existing = await ctx.db.contextFile.findUnique({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Arquivo não encontrado." };

    await ctx.db.contextFile.update({
      where: { id: existing.id },
      data: { rawText: parsed.data.rawText },
    });
    await startIndexing(ctx, existing.id);

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "context.file_updated",
      entity: "ContextFile",
      entityId: existing.id,
      data: {},
    });

    revalidatePath("/contexto");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível salvar a edição. Tente de novo." };
  }
}

/** Reindexa um arquivo: limpa os chunks antigos e enfileira a ingestão de novo. */
export async function reindexContextFile(id: string): Promise<ContextActionResult> {
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Arquivo inválido." };
  try {
    const ctx = await requireWorkspace();
    const existing = await ctx.db.contextFile.findUnique({
      where: { id: parsed.data },
      select: { id: true, name: true },
    });
    if (!existing) return { ok: false, error: "Arquivo não encontrado." };

    const queued = await enqueueIngest(ctx.workspaceId, existing.id);
    if (!queued) {
      return { ok: false, error: "Fila de indexação indisponível — tente de novo em instantes." };
    }
    await ctx.db.contextFile.update({
      where: { id: existing.id },
      data: { status: "PROCESSING", error: null },
    });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "context.file_reindexed",
      entity: "ContextFile",
      entityId: existing.id,
      data: { name: existing.name },
    });

    revalidatePath("/contexto");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível reindexar. Tente de novo." };
  }
}

/** Exclui o arquivo de contexto (chunks caem em cascata) e o binário do storage. */
export async function deleteContextFile(id: string): Promise<ContextActionResult> {
  const parsed = z.string().min(1).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Arquivo inválido." };
  try {
    const ctx = await requireWorkspace();
    const existing = await ctx.db.contextFile.findUnique({
      where: { id: parsed.data },
      select: { id: true, name: true, storageKey: true },
    });
    if (!existing) return { ok: false, error: "Arquivo não encontrado." };

    if (existing.storageKey) {
      try {
        await deleteObject(existing.storageKey);
      } catch {
        // Binário órfão no storage não impede a exclusão do registro.
      }
    }
    await ctx.db.contextFile.delete({ where: { id: existing.id } });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "context.file_deleted",
      entity: "ContextFile",
      entityId: existing.id,
      data: { name: existing.name },
    });

    revalidatePath("/contexto");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível excluir o arquivo." };
  }
}

/** Envia/substitui o Design System (.md) — o card destaque da tela. */
export async function uploadDesignSystem(formData: FormData): Promise<ContextActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Anexe um arquivo .md." };
  }
  if (!file.name.toLowerCase().endsWith(".md")) {
    return { ok: false, error: "Formato não suportado — envie um arquivo .md." };
  }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Arquivo acima de 8 MB." };

  try {
    const ctx = await requireWorkspace();
    const rawText = Buffer.from(await file.arrayBuffer()).toString("utf8");
    if (!rawText.trim()) return { ok: false, error: "O arquivo está vazio." };

    let storageKey: string | null = `context/${ctx.workspaceId}/design-system.md`;
    try {
      await putObject(storageKey, Buffer.from(rawText, "utf8"), "text/markdown");
    } catch {
      storageKey = null; // o texto já foi lido — segue sem o binário
    }

    const existing = await ctx.db.contextFile.findFirst({
      where: { type: "DESIGN_SYSTEM" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const saved = existing
      ? await ctx.db.contextFile.update({
          where: { id: existing.id },
          data: {
            name: file.name,
            rawText,
            ...(storageKey ? { storageKey } : {}),
            status: "PENDING",
            error: null,
          },
        })
      : await ctx.db.contextFile.create({
          data: {
            workspaceId: ctx.workspaceId,
            type: "DESIGN_SYSTEM",
            name: file.name,
            rawText,
            storageKey,
            status: "PENDING",
          },
        });

    await startIndexing(ctx, saved.id);

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "context.design_system_updated",
      entity: "ContextFile",
      entityId: saved.id,
      data: { name: file.name },
    });

    revalidatePath("/contexto");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível enviar o Design System. Tente de novo." };
  }
}
