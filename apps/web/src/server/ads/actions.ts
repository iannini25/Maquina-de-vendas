"use server";

import type { Prisma } from "@vendaflow/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, hasAiCredential, MissingAiCredentialError } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace } from "@/lib/session";

/**
 * Server Actions do módulo Anúncios & Tráfego: geração com IA (Grande Ideia +
 * 3 ângulos), biblioteca de criativos e cofre de referências (swipe file).
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const generateSchema = z.object({
  productOfferId: z.string().min(1, "Escolha um produto"),
  objective: z.enum(["Geração de leads", "Consciência", "Venda"]),
  painDesire: z.string().trim().max(300).optional(),
  channel: z.enum(["Meta (Instagram/Facebook)", "Google", "TikTok"]),
  framework: z.enum(["AIDA", "PAS", "FAB", "4 Ps", "Hook-Story-Offer"]),
});

export type GenerateAdsInput = z.infer<typeof generateSchema>;

const angleSchema = z.object({
  angle: z.string(),
  hook: z.string(),
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
  scene: z.string().default(""),
});

const generationSchema = z.object({
  bigIdea: z.object({
    statement: z.string(),
    rationale: z.string().default(""),
  }),
  angles: z.array(angleSchema).min(1),
});

export type AdGeneration = z.infer<typeof generationSchema>;
export type GeneratedAngle = z.infer<typeof angleSchema>;

export interface GenerateAdsResult extends ActionResult {
  generation?: AdGeneration;
  missingCredential?: boolean;
}

/** Parse tolerante do JSON vindo do modelo (remove cercas, acha o objeto). */
function parseGenerationJson(raw: string): AdGeneration | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    const result = generationSchema.safeParse(parsed);
    if (!result.success) return null;
    return { ...result.data, angles: result.data.angles.slice(0, 3) };
  } catch {
    return null;
  }
}

interface SwipeData {
  hook?: unknown;
  niche?: unknown;
  cta?: unknown;
  learning?: unknown;
}

export async function generateAdsAction(input: GenerateAdsInput): Promise<GenerateAdsResult> {
  const ctx = await requireWorkspace();
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  if (!(await hasAiCredential(ctx.workspaceId))) {
    return {
      ok: false,
      missingCredential: true,
      error: "Configure sua chave da Anthropic em Configurações para usar a IA.",
    };
  }

  const limit = await rateLimit(
    `ads-gen:${ctx.workspaceId}`,
    RATE_LIMITS.aiGeneration.max,
    RATE_LIMITS.aiGeneration.windowSeconds,
  );
  if (!limit.allowed) {
    return { ok: false, error: "Limite de gerações atingido — aguarde alguns minutos." };
  }

  const [product, persona, swipes] = await Promise.all([
    ctx.db.productOffer.findUnique({
      where: { id: parsed.data.productOfferId },
      select: {
        name: true,
        priceCents: true,
        guarantee: true,
        bonuses: true,
        promises: true,
        restrictions: true,
      },
    }),
    ctx.db.agentPersona.findFirst({ select: { icpText: true, tone: true } }),
    ctx.db.template.findMany({
      where: { kind: "SWIPE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true, data: true },
    }),
  ]);
  if (!product) return { ok: false, error: "Produto não encontrado" };

  const swipeNotes = swipes
    .map((swipe) => {
      const data = (swipe.data ?? {}) as SwipeData;
      const parts = [
        `Referência: ${swipe.name}`,
        typeof data.hook === "string" && data.hook ? `hook: ${data.hook}` : null,
        typeof data.niche === "string" && data.niche ? `nicho: ${data.niche}` : null,
        typeof data.cta === "string" && data.cta ? `cta: ${data.cta}` : null,
        typeof data.learning === "string" && data.learning ? `aprendizado: ${data.learning}` : null,
      ].filter(Boolean);
      return parts.join(" · ");
    })
    .join("\n");

  const system = [
    "Você é um redator publicitário sênior brasileiro, no espírito da boa publicidade (Bernbach, Ogilvy).",
    "Escreve em PT-BR, direto, concreto e sem clichê de anúncio.",
    "Sempre parte de UMA grande ideia central e deriva ângulos dela.",
    "Nunca invente números, provas ou promessas que não estejam no contexto do produto.",
    'Responda APENAS com JSON válido no formato: {"bigIdea":{"statement":"...","rationale":"..."},"angles":[{"angle":"...","hook":"...","headline":"...","body":"...","cta":"...","scene":"..."}]} com exatamente 3 ângulos.',
    `O corpo (body) de cada ângulo deve seguir o framework ${parsed.data.framework}, explicitando as etapas do framework de forma natural.`,
    'Em "scene", descreva em uma frase a cena visual do criativo.',
  ].join("\n");

  const userPrompt = [
    `Produto: ${product.name} — preço R$ ${(product.priceCents / 100).toFixed(2)}`,
    product.guarantee ? `Garantia: ${product.guarantee}` : null,
    Array.isArray(product.promises) && product.promises.length > 0
      ? `Promessas registradas: ${JSON.stringify(product.promises)}`
      : null,
    Array.isArray(product.bonuses) && product.bonuses.length > 0
      ? `Bônus: ${JSON.stringify(product.bonuses)}`
      : null,
    Array.isArray(product.restrictions) && product.restrictions.length > 0
      ? `Restrições (nunca violar): ${JSON.stringify(product.restrictions)}`
      : null,
    persona?.icpText ? `ICP: ${persona.icpText}` : null,
    `Objetivo da campanha: ${parsed.data.objective}`,
    `Canal: ${parsed.data.channel}`,
    parsed.data.painDesire ? `Dor ou desejo central: ${parsed.data.painDesire}` : null,
    swipeNotes ? `Referências do cofre de anúncios vencedores:\n${swipeNotes}` : null,
    "Gere a grande ideia e 3 ângulos distintos (ex.: tempo, medo de ficar pra trás, prova).",
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string;
  try {
    raw = await completeWithUsage({
      workspaceId: ctx.workspaceId,
      feature: "ads.generator",
      tier: "heavy",
      system,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 3000,
    });
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, missingCredential: true, error: error.message };
    }
    return {
      ok: false,
      error: "A geração falhou ao chamar a IA. Verifique a credencial e tente de novo.",
    };
  }

  const generation = parseGenerationJson(raw);
  if (!generation) {
    return { ok: false, error: "A IA respondeu em um formato inesperado. Tente gerar de novo." };
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "ads.generated",
    entity: "Ad",
    entityId: parsed.data.productOfferId,
    data: { framework: parsed.data.framework, channel: parsed.data.channel },
  });

  return { ok: true, generation };
}

const saveAdSchema = z.object({
  angle: z.string().trim().max(200),
  hook: z.string().trim().max(500),
  headline: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(4000),
  cta: z.string().trim().max(200),
  scene: z.string().trim().max(500).optional(),
  framework: z.string().trim().max(40),
  channel: z.string().trim().max(60),
  campaignId: z.string().min(1).nullable(),
});

export type SaveAdInput = z.infer<typeof saveAdSchema>;

/** "Salvar na biblioteca": persiste o ângulo gerado como Ad rascunho. */
export async function saveAdToLibraryAction(input: SaveAdInput): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsed = saveAdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  let campaignId: string | null = null;
  if (parsed.data.campaignId) {
    const campaign = await ctx.db.campaign.findUnique({
      where: { id: parsed.data.campaignId },
      select: { id: true },
    });
    campaignId = campaign?.id ?? null;
  }

  const ad = await ctx.db.ad.create({
    data: {
      workspaceId: ctx.workspaceId,
      angle: parsed.data.angle,
      hook: parsed.data.hook,
      headline: parsed.data.headline,
      body: parsed.data.body,
      cta: parsed.data.cta,
      visualHint: parsed.data.scene ?? null,
      framework: parsed.data.framework,
      channel: parsed.data.channel,
      status: "DRAFT",
      savedToLibrary: true,
      campaignId,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "ad.saved_to_library",
    entity: "Ad",
    entityId: ad.id,
    data: { headline: parsed.data.headline, campaignId },
  });

  revalidatePath("/anuncios");
  return { ok: true };
}

const swipeSchema = z.object({
  title: z.string().trim().min(2, "Informe um título").max(160),
  link: z.string().trim().url("Link inválido").optional().or(z.literal("").transform(() => undefined)),
  hook: z.string().trim().max(200).optional(),
  niche: z.string().trim().max(120).optional(),
  cta: z.string().trim().max(120).optional(),
  learning: z.string().trim().max(1000).optional(),
});

export type SwipeInput = z.infer<typeof swipeSchema>;

/** "+ Salvar referência" do Cofre de anúncios vencedores (Template kind SWIPE). */
export async function createSwipeReferenceAction(input: SwipeInput): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsed = swipeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const data: Prisma.InputJsonValue = {
    link: parsed.data.link ?? null,
    hook: parsed.data.hook ?? null,
    niche: parsed.data.niche ?? null,
    cta: parsed.data.cta ?? null,
    learning: parsed.data.learning ?? null,
  };

  const template = await ctx.db.template.create({
    data: {
      workspaceId: ctx.workspaceId,
      kind: "SWIPE",
      name: parsed.data.title,
      source: parsed.data.link ? "LINK" : "UPLOADED",
      data,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "swipe.saved",
    entity: "Template",
    entityId: template.id,
    data: { title: parsed.data.title },
  });

  revalidatePath("/anuncios");
  return { ok: true };
}

/** Vincula/desvincula um criativo da biblioteca a uma campanha. */
export async function linkAdToCampaignAction(
  adId: string,
  campaignId: string | null,
): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsedAdId = z.string().min(1).parse(adId);

  if (campaignId) {
    const campaign = await ctx.db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };
  }

  await ctx.db.ad.update({ where: { id: parsedAdId }, data: { campaignId } });
  revalidatePath("/anuncios");
  return { ok: true };
}

/** Arquiva um criativo da biblioteca. */
export async function archiveAdAction(adId: string): Promise<ActionResult> {
  const ctx = await requireWorkspace();
  const parsedAdId = z.string().min(1).parse(adId);

  await ctx.db.ad.update({ where: { id: parsedAdId }, data: { status: "ARCHIVED" } });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "ad.archived",
    entity: "Ad",
    entityId: parsedAdId,
  });

  revalidatePath("/anuncios");
  return { ok: true };
}
