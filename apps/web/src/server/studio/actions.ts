"use server";

import { QUEUES } from "@vendaflow/core";
import type { Prisma } from "@vendaflow/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, hasAiCredential, MissingAiCredentialError } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { getQueue } from "@/lib/queues";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace, type WorkspaceContext } from "@/lib/session";
import { putObject } from "@/lib/storage";
import { landingBlockSchema, type LandingBlock } from "@/server/landing/blocks";

/**
 * Server Actions do módulo Criar com IA: geração (com contexto real do
 * workspace + Design System) e criação dos artefatos ("Usar").
 */

export interface StudioActionResult {
  ok: boolean;
  error?: string;
  /** Sem chave da Anthropic — a UI mostra estado honesto. */
  missingCredential?: boolean;
}

// ── Base comum dos fluxos: produto + contexto ────────────────────────────────

const baseSchema = z.object({
  productOfferId: z.string().min(1, "Escolha um produto"),
  contextFileIds: z.array(z.string().min(1)).max(20),
  /** "Criar novo": texto colado que vira ContextFile TEXT ao gerar. */
  newContext: z.string().max(20_000).optional(),
});

export type StudioBaseInput = z.infer<typeof baseSchema>;

interface PreparedGeneration {
  product: {
    id: string;
    name: string;
    priceCents: number;
    guarantee: string | null;
    bonuses: unknown;
    promises: unknown;
    restrictions: unknown;
  };
  /** Bloco de contexto pronto para entrar no prompt. */
  contextPrompt: string;
  designSystemPrompt: string | null;
}

function nameFromContent(content: string): string {
  const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "");
  if (!cleaned) return "Contexto colado no Criar com IA";
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned;
}

/** Cria o ContextFile TEXT do "Criar novo" e tenta enfileirar a indexação RAG. */
async function persistNewContext(ctx: WorkspaceContext, content: string): Promise<void> {
  const file = await ctx.db.contextFile.create({
    data: {
      workspaceId: ctx.workspaceId,
      type: "TEXT",
      name: nameFromContent(content),
      rawText: content,
      status: "PENDING",
    },
  });
  try {
    await getQueue(QUEUES.contextIngest).add("ingest-file", {
      workspaceId: ctx.workspaceId,
      contextFileId: file.id,
    });
    await ctx.db.contextFile.update({ where: { id: file.id }, data: { status: "PROCESSING" } });
  } catch {
    // Fila indisponível: o arquivo fica PENDING (estado honesto) e já entra no prompt.
  }
  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "context.created",
    entity: "ContextFile",
    entityId: file.id,
    data: { source: "studio", name: file.name },
  });
}

async function prepareGeneration(
  ctx: WorkspaceContext,
  input: StudioBaseInput,
  options: { includeDesignSystem: boolean },
): Promise<{ ok: true; data: PreparedGeneration } | { ok: false; error: string }> {
  const limit = await rateLimit(
    `studio-gen:${ctx.workspaceId}`,
    RATE_LIMITS.aiGeneration.max,
    RATE_LIMITS.aiGeneration.windowSeconds,
  );
  if (!limit.allowed) {
    return { ok: false, error: "Limite de gerações atingido — aguarde alguns minutos." };
  }

  const product = await ctx.db.productOffer.findUnique({
    where: { id: input.productOfferId },
    select: {
      id: true,
      name: true,
      priceCents: true,
      guarantee: true,
      bonuses: true,
      promises: true,
      restrictions: true,
    },
  });
  if (!product) return { ok: false, error: "Produto não encontrado" };

  const parts: string[] = [];
  const newContent = input.newContext?.trim() ?? "";
  if (newContent.length >= 10) {
    await persistNewContext(ctx, newContent);
    parts.push(`### Contexto informado agora\n${newContent.slice(0, 6000)}`);
  }

  if (input.contextFileIds.length > 0) {
    const files = await ctx.db.contextFile.findMany({
      where: { id: { in: input.contextFileIds } },
      select: { name: true, rawText: true },
    });
    for (const file of files) {
      if (!file.rawText) continue;
      parts.push(`### ${file.name}\n${file.rawText.slice(0, 4000)}`);
    }
  }

  let designSystemPrompt: string | null = null;
  if (options.includeDesignSystem) {
    const designSystem = await ctx.db.contextFile.findFirst({
      where: { type: "DESIGN_SYSTEM" },
      orderBy: { updatedAt: "desc" },
      select: { rawText: true },
    });
    designSystemPrompt = designSystem?.rawText?.slice(0, 4000) ?? null;
  }

  return {
    ok: true,
    data: {
      product,
      contextPrompt: parts.length > 0 ? parts.join("\n\n") : "",
      designSystemPrompt,
    },
  };
}

function productPrompt(product: PreparedGeneration["product"]): string {
  return [
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
  ]
    .filter(Boolean)
    .join("\n");
}

/** Parse tolerante do JSON vindo do modelo (remove cercas, acha o objeto). */
function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runCompletion(
  ctx: WorkspaceContext,
  feature: string,
  tier: "chat" | "heavy",
  system: string,
  userPrompt: string,
  maxTokens: number,
): Promise<{ ok: true; raw: string } | { ok: false; error: string; missingCredential?: boolean }> {
  try {
    const raw = await completeWithUsage({
      workspaceId: ctx.workspaceId,
      feature,
      tier,
      system,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens,
    });
    return { ok: true, raw };
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, missingCredential: true, error: error.message };
    }
    return {
      ok: false,
      error: "A geração falhou ao chamar a IA. Verifique a credencial e tente de novo.",
    };
  }
}

async function guardAi(ctx: WorkspaceContext): Promise<StudioActionResult | null> {
  if (await hasAiCredential(ctx.workspaceId)) return null;
  return {
    ok: false,
    missingCredential: true,
    error: "Configure sua chave da Anthropic em Configurações para usar a IA.",
  };
}

// ── 1. Copy de anúncio ───────────────────────────────────────────────────────

const adInputSchema = baseSchema.extend({
  objective: z.enum(["Geração de leads", "Consciência", "Venda"]),
  painDesire: z.string().trim().max(300).optional(),
  framework: z.enum(["AIDA", "PAS", "FAB", "4 Ps", "Hook-Story-Offer"]),
});

export type StudioAdInput = z.infer<typeof adInputSchema>;

const adAngleSchema = z.object({
  angle: z.string(),
  hook: z.string(),
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
});

const adResultSchema = z.object({
  bigIdea: z.string(),
  angles: z.array(adAngleSchema).min(1),
});

export type StudioAdResult = z.infer<typeof adResultSchema>;
export type StudioAdAngle = z.infer<typeof adAngleSchema>;

export interface GenerateAdResponse extends StudioActionResult {
  result?: StudioAdResult;
}

export async function generateStudioAd(input: StudioAdInput): Promise<GenerateAdResponse> {
  const ctx = await requireWorkspace();
  const parsed = adInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const missing = await guardAi(ctx);
  if (missing) return missing;

  const prepared = await prepareGeneration(ctx, parsed.data, { includeDesignSystem: false });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const system = [
    "Você é um redator publicitário sênior brasileiro (escola Bernbach/Ogilvy).",
    "Escreve em PT-BR, direto, concreto, sem clichê de anúncio.",
    "Parte de UMA grande ideia central e deriva ângulos dela.",
    "Nunca invente números, provas ou promessas fora do contexto fornecido.",
    `O corpo (body) de cada ângulo segue o framework ${parsed.data.framework}, com as etapas do framework aplicadas de forma natural.`,
    'Responda APENAS com JSON válido: {"bigIdea":"...","angles":[{"angle":"...","hook":"...","headline":"...","body":"...","cta":"..."}]} com exatamente 3 ângulos.',
  ].join("\n");

  const userPrompt = [
    productPrompt(prepared.data.product),
    `Objetivo do anúncio: ${parsed.data.objective}`,
    parsed.data.painDesire ? `Dor ou desejo central: ${parsed.data.painDesire}` : null,
    prepared.data.contextPrompt
      ? `Contexto real do negócio (use como fonte de verdade):\n${prepared.data.contextPrompt}`
      : null,
    "Gere a grande ideia e 3 ângulos distintos (ex.: tempo, medo de ficar pra trás, prova).",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await runCompletion(ctx, "studio.ad", "heavy", system, userPrompt, 3000);
  if (!completion.ok) return completion;

  const result = adResultSchema.safeParse(extractJson(completion.raw));
  if (!result.success) {
    return { ok: false, error: "A IA respondeu em um formato inesperado. Tente gerar de novo." };
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "studio.generated",
    entity: "Ad",
    entityId: parsed.data.productOfferId,
    data: { flow: "anuncio", framework: parsed.data.framework },
  });

  return { ok: true, result: { ...result.data, angles: result.data.angles.slice(0, 3) } };
}

// ── 2. Seção de landing ──────────────────────────────────────────────────────

const sectionInputSchema = baseSchema.extend({
  section: z.enum(["hero", "oferta", "prova", "faq"]),
});

export type StudioSectionInput = z.infer<typeof sectionInputSchema>;

export interface GenerateTextResponse extends StudioActionResult {
  text?: string;
}

const SECTION_BRIEFS: Record<StudioSectionInput["section"], string> = {
  hero: "a seção HERO: headline forte (até 12 palavras), subheadline de apoio e texto do CTA.",
  oferta:
    "a seção OFERTA: apresentação do preço com ancoragem honesta, bullets do que está incluso, bônus e garantia.",
  prova:
    "a seção PROVA SOCIAL: 3 depoimentos plausíveis baseados nas promessas reais (sem inventar nomes de empresas reais) e uma linha de autoridade.",
  faq: "a seção FAQ: as 5 perguntas mais prováveis com respostas curtas que quebram objeções reais do contexto.",
};

export async function generateStudioSection(
  input: StudioSectionInput,
): Promise<GenerateTextResponse> {
  const ctx = await requireWorkspace();
  const parsed = sectionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const missing = await guardAi(ctx);
  if (missing) return missing;

  const prepared = await prepareGeneration(ctx, parsed.data, { includeDesignSystem: true });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const system = [
    "Você é um copywriter de landing pages brasileiro, direto e sem hype vazio.",
    "Escreve em PT-BR. Benefício antes de recurso. Frases curtas.",
    "Nunca invente números, provas ou promessas fora do contexto fornecido.",
    "Responda com o texto pronto da seção em markdown simples (títulos com ##), sem comentários extras.",
    prepared.data.designSystemPrompt
      ? `Siga o tom de voz do Design System:\n${prepared.data.designSystemPrompt}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    productPrompt(prepared.data.product),
    prepared.data.contextPrompt
      ? `Contexto real do negócio (fonte de verdade):\n${prepared.data.contextPrompt}`
      : null,
    `Escreva ${SECTION_BRIEFS[parsed.data.section]}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await runCompletion(ctx, "studio.section", "chat", system, userPrompt, 1600);
  if (!completion.ok) return completion;

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "studio.generated",
    entity: "LandingPage",
    entityId: parsed.data.productOfferId,
    data: { flow: "secao-landing", section: parsed.data.section },
  });

  return { ok: true, text: completion.raw.trim() };
}

// ── 3. Mensagem de WhatsApp ──────────────────────────────────────────────────

const whatsappInputSchema = baseSchema.extend({
  stageId: z.string().min(1, "Escolha um estágio"),
});

export type StudioWhatsappInput = z.infer<typeof whatsappInputSchema>;

export async function generateStudioWhatsapp(
  input: StudioWhatsappInput,
): Promise<GenerateTextResponse> {
  const ctx = await requireWorkspace();
  const parsed = whatsappInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const missing = await guardAi(ctx);
  if (missing) return missing;

  const [stage, persona] = await Promise.all([
    ctx.db.pipelineStage.findUnique({
      where: { id: parsed.data.stageId },
      select: { name: true, playbook: { select: { objective: true, instructions: true } } },
    }),
    ctx.db.agentPersona.findFirst({
      select: { name: true, speaksAs: true, tone: true, emojis: true, msgLength: true },
    }),
  ]);
  if (!stage) return { ok: false, error: "Estágio não encontrado" };

  const prepared = await prepareGeneration(ctx, parsed.data, { includeDesignSystem: false });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const system = [
    "Você é o SDR de IA do workspace escrevendo uma mensagem de WhatsApp em PT-BR.",
    persona
      ? `Persona: ${persona.name}, fala como ${persona.speaksAs}, tom ${persona.tone}, mensagens ${persona.msgLength === "short" ? "curtas" : "médias"}${persona.emojis ? ", pode usar emoji com moderação" : ", sem emojis"}.`
      : "Tom caloroso e direto, mensagens curtas.",
    "Soa humano: nada de 'Prezado', nada de parágrafo longo, uma pergunta clara no final.",
    "Nunca invente preço, prova ou promessa fora do contexto fornecido.",
    "Responda APENAS com o texto da mensagem, sem aspas nem comentários.",
  ].join("\n");

  const userPrompt = [
    productPrompt(prepared.data.product),
    `Estágio do lead no pipeline: ${stage.name}`,
    stage.playbook?.objective ? `Objetivo do estágio: ${stage.playbook.objective}` : null,
    stage.playbook?.instructions ? `Instruções do playbook: ${stage.playbook.instructions}` : null,
    prepared.data.contextPrompt
      ? `Contexto real do negócio:\n${prepared.data.contextPrompt}`
      : null,
    "Escreva a mensagem ideal para um lead neste estágio.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await runCompletion(ctx, "studio.whatsapp", "chat", system, userPrompt, 600);
  if (!completion.ok) return completion;

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "studio.generated",
    entity: "PipelineStage",
    entityId: parsed.data.stageId,
    data: { flow: "whatsapp" },
  });

  return { ok: true, text: completion.raw.trim() };
}

// ── 4. E-mail de pós-venda ───────────────────────────────────────────────────

const emailPurposeSchema = z.enum([
  "PURCHASE_CONFIRM",
  "ACCESS",
  "WELCOME",
  "NPS",
  "UPSELL",
  "REACTIVATION",
]);

const emailInputSchema = baseSchema.extend({
  purpose: emailPurposeSchema,
});

export type StudioEmailInput = z.infer<typeof emailInputSchema>;

const emailResultSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type StudioEmailResult = z.infer<typeof emailResultSchema>;

export interface GenerateEmailResponse extends StudioActionResult {
  result?: StudioEmailResult;
}

const PURPOSE_LABELS: Record<z.infer<typeof emailPurposeSchema>, string> = {
  PURCHASE_CONFIRM: "confirmação de compra",
  ACCESS: "entrega de acesso",
  WELCOME: "boas-vindas",
  NPS: "pesquisa NPS",
  UPSELL: "upsell",
  REACTIVATION: "reativação",
};

export async function generateStudioEmail(
  input: StudioEmailInput,
): Promise<GenerateEmailResponse> {
  const ctx = await requireWorkspace();
  const parsed = emailInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const missing = await guardAi(ctx);
  if (missing) return missing;

  const prepared = await prepareGeneration(ctx, parsed.data, { includeDesignSystem: true });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const system = [
    "Você escreve e-mails de pós-venda em PT-BR: curtos, calorosos e úteis.",
    "Pode usar as variáveis {nome}, {produto}, {valor} e {link_acesso} no corpo.",
    "Nunca invente números, provas ou promessas fora do contexto fornecido.",
    'Responda APENAS com JSON válido: {"subject":"...","body":"..."} (body em texto com quebras de linha \\n).',
    prepared.data.designSystemPrompt
      ? `Siga o tom de voz do Design System:\n${prepared.data.designSystemPrompt}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    productPrompt(prepared.data.product),
    prepared.data.contextPrompt
      ? `Contexto real do negócio:\n${prepared.data.contextPrompt}`
      : null,
    `Escreva o e-mail de ${PURPOSE_LABELS[parsed.data.purpose]} deste produto.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await runCompletion(ctx, "studio.email", "chat", system, userPrompt, 1200);
  if (!completion.ok) return completion;

  const result = emailResultSchema.safeParse(extractJson(completion.raw));
  if (!result.success) {
    return { ok: false, error: "A IA respondeu em um formato inesperado. Tente gerar de novo." };
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "studio.generated",
    entity: "EmailTemplate",
    entityId: parsed.data.productOfferId,
    data: { flow: "email", purpose: parsed.data.purpose },
  });

  return { ok: true, result: result.data };
}

/** "[Usar]" do e-mail: cria EmailTemplate DRAFT com corpo gerado pela IA. */
export async function createStudioEmailTemplate(input: {
  purpose: string;
  subject: string;
  body: string;
}): Promise<StudioActionResult> {
  const ctx = await requireWorkspace();
  const parsed = z
    .object({
      purpose: emailPurposeSchema,
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(20_000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const template = await ctx.db.emailTemplate.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.subject,
      purpose: parsed.data.purpose,
      structure: { subject: parsed.data.subject },
      bodySource: "AI",
      bodyText: parsed.data.body,
      status: "DRAFT",
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "emailtemplate.created",
    entity: "EmailTemplate",
    entityId: template.id,
    data: { source: "studio", purpose: parsed.data.purpose },
  });

  revalidatePath("/templates-email");
  return { ok: true };
}

// ── 5. Landing completa (template obrigatório) ───────────────────────────────

const fullLandingInputSchema = baseSchema.extend({
  templateId: z.string().min(1, "Selecionar um template é obrigatório."),
});

export type StudioFullLandingInput = z.infer<typeof fullLandingInputSchema>;

const fullLandingResultSchema = z.object({
  name: z.string().min(1),
  blocks: z.array(landingBlockSchema).min(2),
});

export interface StudioFullLandingResult {
  name: string;
  blocks: LandingBlock[];
  templateId: string;
}

export interface GenerateFullLandingResponse extends StudioActionResult {
  result?: StudioFullLandingResult;
}

export async function generateStudioFullLanding(
  input: StudioFullLandingInput,
): Promise<GenerateFullLandingResponse> {
  const ctx = await requireWorkspace();
  const parsed = fullLandingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const missing = await guardAi(ctx);
  if (missing) return missing;

  const template = await ctx.db.template.findUnique({
    where: { id: parsed.data.templateId },
    select: { name: true, data: true },
  });
  if (!template) return { ok: false, error: "Template não encontrado" };

  const prepared = await prepareGeneration(ctx, parsed.data, { includeDesignSystem: true });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const templateBlocks =
    template.data && typeof template.data === "object" && !Array.isArray(template.data)
      ? (template.data as Record<string, unknown>)["blocks"]
      : null;
  const structure = Array.isArray(templateBlocks) ? templateBlocks.join(" → ") : "livre";

  const system = [
    "Você monta o conteúdo de uma landing page completa em PT-BR a partir de um template.",
    "A estrutura vem do template — você só escreve conteúdo, não muda a ordem das seções.",
    "Nunca invente números, provas ou promessas fora do contexto fornecido.",
    "Responda APENAS com JSON válido no formato:",
    '{"name":"nome da página","blocks":[',
    '{"kind":"hero","headline":"...","sub":"...","cta":"..."},',
    '{"kind":"pain","items":["...","..."]},',
    '{"kind":"method","steps":["...","..."]},',
    '{"kind":"proof","quotes":["...","..."]},',
    '{"kind":"offer","priceCents":0,"guarantee":"...","bonuses":["..."]},',
    '{"kind":"faq","items":[{"q":"...","a":"..."}]},',
    '{"kind":"cta-whatsapp","text":"..."}',
    "]}",
    "Use apenas os kinds mostrados acima. priceCents é o preço em centavos.",
    prepared.data.designSystemPrompt
      ? `Siga o tom de voz do Design System:\n${prepared.data.designSystemPrompt}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    productPrompt(prepared.data.product),
    `Template escolhido: ${template.name} — estrutura: ${structure}`,
    prepared.data.contextPrompt
      ? `Contexto real do negócio (fonte de verdade):\n${prepared.data.contextPrompt}`
      : null,
    `Escreva a landing completa. No bloco offer, use priceCents=${prepared.data.product.priceCents}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await runCompletion(ctx, "studio.landing", "heavy", system, userPrompt, 3500);
  if (!completion.ok) return completion;

  const result = fullLandingResultSchema.safeParse(extractJson(completion.raw));
  if (!result.success) {
    return { ok: false, error: "A IA respondeu em um formato inesperado. Tente gerar de novo." };
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "studio.generated",
    entity: "Template",
    entityId: parsed.data.templateId,
    data: { flow: "landing-completa" },
  });

  return {
    ok: true,
    result: { ...result.data, templateId: parsed.data.templateId },
  };
}

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "pagina";
}

export interface CreateStudioLandingResult extends StudioActionResult {
  id?: string;
}

/** "[Usar]" da landing completa: cria LandingPage DRAFT + variante A com os blocos. */
export async function createStudioLanding(input: {
  name: string;
  productOfferId: string;
  blocks: unknown[];
}): Promise<CreateStudioLandingResult> {
  const ctx = await requireWorkspace();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      productOfferId: z.string().min(1),
      blocks: z.array(landingBlockSchema).min(1).max(20),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Blocos gerados inválidos — gere de novo." };

  const product = await ctx.db.productOffer.findUnique({
    where: { id: parsed.data.productOfferId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Produto não encontrado" };

  const kinds = new Set(parsed.data.blocks.map((block) => block.kind));
  const goal = kinds.has("signup-form") ? "LIVE_SIGNUP" : kinds.has("cta-whatsapp") ? "WHATSAPP" : "BUY";

  const base = slugify(parsed.data.name);
  let slug = base;
  for (let attempt = 2; attempt < 50; attempt++) {
    const existing = await ctx.db.landingPage.findFirst({ where: { slug }, select: { id: true } });
    if (!existing) break;
    slug = `${base}-${attempt}`;
  }

  const landing = await ctx.db.landingPage.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      slug,
      goal,
      kind: "BUILDER",
      productOfferId: product.id,
      status: "DRAFT",
    },
  });
  await ctx.db.landingVariant.create({
    data: {
      landingPageId: landing.id,
      name: "A",
      weight: 100,
      blocks: parsed.data.blocks as Prisma.InputJsonValue,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "landing.created",
    entity: "LandingPage",
    entityId: landing.id,
    data: { source: "studio", goal },
  });

  revalidatePath("/landing-pages");
  return { ok: true, id: landing.id };
}

// ── 6. Campanha completa ─────────────────────────────────────────────────────

const campaignInputSchema = baseSchema.extend({
  objective: z.enum(["Geração de leads", "Consciência", "Venda"]),
  channel: z.enum(["Meta (Instagram/Facebook)", "Google", "TikTok"]),
});

export type StudioCampaignInput = z.infer<typeof campaignInputSchema>;

const campaignResultSchema = z.object({
  name: z.string().min(1),
  audience: z.string().min(1),
  bigIdea: z.string().min(1),
  angles: z.array(z.object({ angle: z.string(), headline: z.string() })).min(1),
  landingOutline: z.array(z.string()).min(1),
  cadence: z.array(z.string()).min(1),
});

export interface StudioCampaignResult extends z.infer<typeof campaignResultSchema> {
  objective: string;
  channel: string;
}

export interface GenerateCampaignResponse extends StudioActionResult {
  result?: StudioCampaignResult;
}

export async function generateStudioCampaign(
  input: StudioCampaignInput,
): Promise<GenerateCampaignResponse> {
  const ctx = await requireWorkspace();
  const parsed = campaignInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const missing = await guardAi(ctx);
  if (missing) return missing;

  const prepared = await prepareGeneration(ctx, parsed.data, { includeDesignSystem: true });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const system = [
    "Você é um estrategista de aquisição brasileiro: monta campanhas completas (ângulos + landing + cadência).",
    "Escreve em PT-BR, concreto e prático. Nunca invente números fora do contexto.",
    "Responda APENAS com JSON válido:",
    '{"name":"nome curto da campanha","audience":"público-alvo em 1 frase","bigIdea":"...","angles":[{"angle":"...","headline":"..."}],"landingOutline":["seção 1","seção 2"],"cadence":["D0: ...","D1: ..."]}',
    "3 ângulos, 5-7 seções de landing e cadência de follow-up de 4-6 toques.",
  ].join("\n");

  const userPrompt = [
    productPrompt(prepared.data.product),
    `Objetivo: ${parsed.data.objective}`,
    `Canal principal: ${parsed.data.channel}`,
    prepared.data.contextPrompt
      ? `Contexto real do negócio (fonte de verdade):\n${prepared.data.contextPrompt}`
      : null,
    "Monte a campanha completa.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await runCompletion(ctx, "studio.campaign", "heavy", system, userPrompt, 3000);
  if (!completion.ok) return completion;

  const result = campaignResultSchema.safeParse(extractJson(completion.raw));
  if (!result.success) {
    return { ok: false, error: "A IA respondeu em um formato inesperado. Tente gerar de novo." };
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "studio.generated",
    entity: "Campaign",
    entityId: parsed.data.productOfferId,
    data: { flow: "campanha", objective: parsed.data.objective },
  });

  return {
    ok: true,
    result: { ...result.data, objective: parsed.data.objective, channel: parsed.data.channel },
  };
}

export interface CreateStudioCampaignResult extends StudioActionResult {
  id?: string;
}

/** "[Usar]" da campanha: cria Campaign DRAFT preenchida com o plano gerado. */
export async function createStudioCampaign(input: {
  name: string;
  objective: string;
  channel: string;
  audience: string;
  productOfferId: string;
}): Promise<CreateStudioCampaignResult> {
  const ctx = await requireWorkspace();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      objective: z.string().trim().min(1).max(80),
      channel: z.string().trim().min(1).max(80),
      audience: z.string().trim().max(300),
      productOfferId: z.string().min(1),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const product = await ctx.db.productOffer.findUnique({
    where: { id: parsed.data.productOfferId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Produto não encontrado" };

  const campaign = await ctx.db.campaign.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      type: "STANDARD",
      objective: parsed.data.objective,
      channel: parsed.data.channel,
      audience: parsed.data.audience || null,
      productOfferId: product.id,
      status: "DRAFT",
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "campaign.created",
    entity: "Campaign",
    entityId: campaign.id,
    data: { source: "studio", name: parsed.data.name },
  });

  revalidatePath("/campanhas");
  return { ok: true, id: campaign.id };
}

// ── Biblioteca de templates (+ Adicionar template) ───────────────────────────

const TEMPLATE_FILE_EXTENSIONS = [".html", ".htm", ".zip", ".png", ".jpg", ".jpeg", ".webp"];

/** "+ Adicionar template": upload de arquivo ou link → Template LANDING UPLOADED/LINK. */
export async function addStudioTemplate(formData: FormData): Promise<StudioActionResult> {
  const ctx = await requireWorkspace();

  const parsed = z
    .object({
      name: z.string().trim().min(2, "Informe um nome").max(120),
      mode: z.enum(["upload", "link"]),
      url: z.string().trim().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      mode: formData.get("mode"),
      url: formData.get("url") ?? undefined,
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  let source: "UPLOADED" | "LINK";
  let storageKey: string | null = null;
  let data: Prisma.InputJsonValue = {};

  if (parsed.data.mode === "link") {
    const url = z.string().url("Link inválido").safeParse(parsed.data.url ?? "");
    if (!url.success) return { ok: false, error: "Cole um link válido (https://…)" };
    source = "LINK";
    data = { url: url.data };
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Anexe o arquivo do template (.html, .zip ou imagem)" };
    }
    const lower = file.name.toLowerCase();
    if (!TEMPLATE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return { ok: false, error: "Formato não suportado — envie .html, .zip ou imagem" };
    }
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Arquivo acima de 8 MB" };

    const safeName = lower.replace(/[^\w.-]+/g, "-").slice(0, 80);
    storageKey = `templates/${ctx.workspaceId}/${Date.now()}-${safeName}`;
    try {
      const body = Buffer.from(await file.arrayBuffer());
      await putObject(storageKey, body, file.type || "application/octet-stream");
    } catch {
      return { ok: false, error: "Falha ao subir o arquivo para o storage. Verifique o MinIO/S3." };
    }
    source = "UPLOADED";
    data = { fileName: file.name };
  }

  const template = await ctx.db.template.create({
    data: {
      workspaceId: ctx.workspaceId,
      kind: "LANDING",
      name: parsed.data.name,
      source,
      data,
      storageKey,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "template.added",
    entity: "Template",
    entityId: template.id,
    data: { source, name: parsed.data.name },
  });

  revalidatePath("/criar");
  return { ok: true };
}
