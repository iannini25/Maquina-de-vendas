"use server";

import { pickWinner, type VariantStats } from "@vendaflow/core";
import type { Prisma } from "@vendaflow/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";
import { putObject } from "@/lib/storage";

import {
  defaultBlocksFor,
  landingBlockSchema,
  stringArrayFromJson,
  type LandingBlock,
} from "./blocks";

/**
 * Server Actions do módulo Landing Pages.
 * Todas as queries de negócio passam por ctx.db (tenantDb).
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateLandingResult extends ActionResult {
  id?: string;
}

const goalSchema = z.enum(["WHATSAPP", "BUY", "LIVE_SIGNUP"]);
const kindSchema = z.enum(["BUILDER", "EXTERNAL_URL", "UPLOADED"]);

const createLandingSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome").max(120),
  productOfferId: z.string().min(1, "Escolha um produto"),
  goal: goalSchema,
  kind: kindSchema,
  externalUrl: z.string().trim().url("URL inválida").optional(),
});

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "pagina";
}

/** Cria a landing (por blocos, link externo ou arquivo) e a variante A quando BUILDER. */
export async function createLandingAction(formData: FormData): Promise<CreateLandingResult> {
  const ctx = await requireWorkspace();

  const parsed = createLandingSchema.safeParse({
    name: formData.get("name"),
    productOfferId: formData.get("productOfferId"),
    goal: formData.get("goal"),
    kind: formData.get("kind"),
    externalUrl: formData.get("externalUrl") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const input = parsed.data;

  if (input.kind === "EXTERNAL_URL" && !input.externalUrl) {
    return { ok: false, error: "Cole a URL externa da página" };
  }

  const file = formData.get("file");
  if (input.kind === "UPLOADED") {
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Anexe um arquivo .html ou .zip" };
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".html") && !lower.endsWith(".htm") && !lower.endsWith(".zip")) {
      return { ok: false, error: "Formato não suportado — envie .html ou .zip" };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, error: "Arquivo acima de 8 MB" };
    }
  }

  const product = await ctx.db.productOffer.findUnique({
    where: { id: input.productOfferId },
    select: { id: true, name: true, priceCents: true, guarantee: true, bonuses: true, promises: true },
  });
  if (!product) return { ok: false, error: "Produto não encontrado" };

  // Slug único por workspace: sufixo incremental em caso de colisão.
  const base = slugify(input.name);
  let slug = base;
  for (let attempt = 2; attempt < 50; attempt++) {
    const existing = await ctx.db.landingPage.findFirst({ where: { slug }, select: { id: true } });
    if (!existing) break;
    slug = `${base}-${attempt}`;
  }

  let storageKey: string | null = null;
  if (input.kind === "UPLOADED" && file instanceof File) {
    const isZip = file.name.toLowerCase().endsWith(".zip");
    storageKey = `landing/${ctx.workspaceId}/${Date.now()}-${slug}${isZip ? ".zip" : ".html"}`;
    try {
      const body = Buffer.from(await file.arrayBuffer());
      await putObject(storageKey, body, isZip ? "application/zip" : "text/html; charset=utf-8");
    } catch {
      return { ok: false, error: "Falha ao subir o arquivo para o storage. Verifique o MinIO/S3." };
    }
  }

  const landing = await ctx.db.landingPage.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      slug,
      goal: input.goal,
      kind: input.kind,
      externalUrl: input.kind === "EXTERNAL_URL" ? (input.externalUrl ?? null) : null,
      storageKey,
      productOfferId: product.id,
      status: "DRAFT",
    },
  });

  if (input.kind === "BUILDER") {
    const blocks = defaultBlocksFor(
      {
        name: product.name,
        priceCents: product.priceCents,
        guarantee: product.guarantee,
        bonuses: stringArrayFromJson(product.bonuses),
        promises: stringArrayFromJson(product.promises),
      },
      input.goal,
    );
    await ctx.db.landingVariant.create({
      data: {
        landingPageId: landing.id,
        name: "A",
        deviceTarget: "ANY",
        weight: 100,
        blocks: blocks as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "landing.created",
    entity: "LandingPage",
    entityId: landing.id,
    data: { name: input.name, kind: input.kind, goal: input.goal, slug },
  });

  revalidatePath("/landing-pages");
  return { ok: true, id: landing.id };
}

const renameSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Nome muito curto").max(120),
});

export async function renameLandingAction(id: string, name: string): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsed = renameSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await ctx.db.landingPage.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } });
  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${parsed.data.id}`);
  return { ok: true };
}

export async function setLandingPublishedAction(
  id: string,
  published: boolean,
): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const landingId = z.string().min(1).parse(id);

  const landing = await ctx.db.landingPage.findUnique({
    where: { id: landingId },
    select: { id: true, kind: true, externalUrl: true, _count: { select: { variants: true } } },
  });
  if (!landing) return { ok: false, error: "Landing não encontrada" };
  if (published && landing.kind === "BUILDER" && landing._count.variants === 0) {
    return { ok: false, error: "Crie ao menos uma variante antes de publicar" };
  }
  if (published && landing.kind === "EXTERNAL_URL" && !landing.externalUrl) {
    return { ok: false, error: "Informe a URL externa antes de publicar" };
  }

  await ctx.db.landingPage.update({
    where: { id: landingId },
    data: { status: published ? "PUBLISHED" : "DRAFT", publishedAt: published ? new Date() : null },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: published ? "landing.published" : "landing.unpublished",
    entity: "LandingPage",
    entityId: landingId,
  });

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${landingId}`);
  return { ok: true };
}

export async function updateLandingExternalUrlAction(
  id: string,
  externalUrl: string,
): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsed = z
    .object({ id: z.string().min(1), externalUrl: z.string().trim().url("URL inválida") })
    .safeParse({ id, externalUrl });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "URL inválida" };
  }

  await ctx.db.landingPage.update({
    where: { id: parsed.data.id },
    data: { externalUrl: parsed.data.externalUrl },
  });
  revalidatePath(`/landing-pages/${parsed.data.id}`);
  return { ok: true };
}

const updateVariantSchema = z.object({
  variantId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  deviceTarget: z.enum(["ANY", "MOBILE", "TABLET", "DESKTOP"]).optional(),
  weight: z.number().int().min(0).max(100).optional(),
  blocks: z.array(landingBlockSchema).optional(),
});

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export async function updateVariantAction(input: UpdateVariantInput): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { variantId, blocks, ...fields } = parsed.data;

  const variant = await ctx.db.landingVariant.findFirst({
    where: { id: variantId },
    select: { id: true, landingPageId: true },
  });
  if (!variant) return { ok: false, error: "Variante não encontrada" };

  await ctx.db.landingVariant.update({
    where: { id: variantId },
    data: {
      ...fields,
      ...(blocks ? { blocks: blocks as unknown as Prisma.InputJsonValue } : {}),
    },
  });

  revalidatePath(`/landing-pages/${variant.landingPageId}`);
  return { ok: true };
}

export interface CreateVariantResult extends ActionResult {
  variantId?: string;
}

/** Nova variante: duplica os blocos da variante de origem (nome = próxima letra). */
export async function createVariantAction(
  landingPageId: string,
  sourceVariantId: string | null,
): Promise<CreateVariantResult> {
  const ctx = await requireWorkspace();
  const pageId = z.string().min(1).parse(landingPageId);

  const variants = await ctx.db.landingVariant.findMany({
    where: { landingPageId: pageId },
    orderBy: { createdAt: "asc" },
    select: { id: true, blocks: true },
  });

  const source =
    (sourceVariantId ? variants.find((v) => v.id === sourceVariantId) : undefined) ?? variants[0];
  const sourceBlocks: LandingBlock[] = source
    ? z.array(landingBlockSchema).catch([]).parse(source.blocks)
    : [];

  const letter = String.fromCharCode("A".charCodeAt(0) + Math.min(variants.length, 25));
  const created = await ctx.db.landingVariant.create({
    data: {
      landingPageId: pageId,
      name: letter,
      deviceTarget: "ANY",
      weight: 50,
      blocks: sourceBlocks as unknown as Prisma.InputJsonValue,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "landing.variant_created",
    entity: "LandingPage",
    entityId: pageId,
    data: { variantId: created.id, name: letter },
  });

  revalidatePath(`/landing-pages/${pageId}`);
  return { ok: true, variantId: created.id };
}

export interface PickWinnerResult extends ActionResult {
  winnerId: string | null;
}

/**
 * Escolhe a vencedora automaticamente com pickWinner (amostra mínima + vantagem
 * relativa de 10%) sobre os LandingEvents reais.
 */
export async function autoPickWinnerAction(landingPageId: string): Promise<PickWinnerResult> {
  const ctx = await requireWorkspace();
  const pageId = z.string().min(1).parse(landingPageId);

  const [variants, eventGroups] = await Promise.all([
    ctx.db.landingVariant.findMany({ where: { landingPageId: pageId }, select: { id: true } }),
    ctx.db.landingEvent.groupBy({
      by: ["variantId", "type"],
      where: { landingPageId: pageId },
      _count: { _all: true },
    }),
  ]);

  const stats = new Map<string, VariantStats>(
    variants.map((v) => [v.id, { id: v.id, views: 0, conversions: 0 }]),
  );
  for (const group of eventGroups) {
    if (!group.variantId) continue;
    const entry = stats.get(group.variantId);
    if (!entry) continue;
    if (group.type === "VIEW") entry.views += group._count._all;
    else entry.conversions += group._count._all;
  }

  const winnerId = pickWinner([...stats.values()]);
  if (!winnerId) return { ok: true, winnerId: null };

  await ctx.db.landingVariant.updateMany({
    where: { landingPageId: pageId },
    data: { isWinner: false },
  });
  await ctx.db.landingVariant.update({ where: { id: winnerId }, data: { isWinner: true } });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "landing.winner_picked",
    entity: "LandingPage",
    entityId: pageId,
    data: { winnerId },
  });

  revalidatePath(`/landing-pages/${pageId}`);
  return { ok: true, winnerId };
}
