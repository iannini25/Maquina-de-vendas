import { z } from "zod";

/**
 * Blocos tipados do editor de landing pages (BUILDER).
 * O mesmo contrato alimenta o editor, o preview e a página pública /p/[slug].
 */

const heroBlockSchema = z.object({
  kind: z.literal("hero"),
  headline: z.string().default(""),
  sub: z.string().default(""),
  cta: z.string().default(""),
});

const painBlockSchema = z.object({
  kind: z.literal("pain"),
  items: z.array(z.string()).default([]),
});

const methodBlockSchema = z.object({
  kind: z.literal("method"),
  steps: z.array(z.string()).default([]),
});

const proofBlockSchema = z.object({
  kind: z.literal("proof"),
  quotes: z.array(z.string()).default([]),
});

const offerBlockSchema = z.object({
  kind: z.literal("offer"),
  priceCents: z.number().int().nonnegative().default(0),
  guarantee: z.string().default(""),
  bonuses: z.array(z.string()).default([]),
});

const faqBlockSchema = z.object({
  kind: z.literal("faq"),
  items: z.array(z.object({ q: z.string().default(""), a: z.string().default("") })).default([]),
});

const ctaWhatsappBlockSchema = z.object({
  kind: z.literal("cta-whatsapp"),
  text: z.string().default(""),
});

const signupFormBlockSchema = z.object({
  kind: z.literal("signup-form"),
  fields: z.array(z.enum(["nome", "whatsapp", "email"])).default(["nome", "whatsapp", "email"]),
});

export const landingBlockSchema = z.discriminatedUnion("kind", [
  heroBlockSchema,
  painBlockSchema,
  methodBlockSchema,
  proofBlockSchema,
  offerBlockSchema,
  faqBlockSchema,
  ctaWhatsappBlockSchema,
  signupFormBlockSchema,
]);

export type LandingBlock = z.infer<typeof landingBlockSchema>;
export type LandingBlockKind = LandingBlock["kind"];

export const BLOCK_KIND_LABELS: Record<LandingBlockKind, string> = {
  hero: "Hero",
  pain: "Dores",
  method: "Método",
  proof: "Prova social",
  offer: "Oferta",
  faq: "FAQ",
  "cta-whatsapp": "CTA WhatsApp",
  "signup-form": "Formulário de inscrição",
};

/** Parse tolerante do Json do banco: descarta blocos inválidos em vez de quebrar a página. */
export function parseBlocks(raw: unknown): LandingBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: LandingBlock[] = [];
  for (const item of raw) {
    const parsed = landingBlockSchema.safeParse(item);
    if (parsed.success) blocks.push(parsed.data);
  }
  return blocks;
}

/** Bloco novo em branco por tipo (botão "Adicionar bloco" do editor). */
export function emptyBlock(kind: LandingBlockKind): LandingBlock {
  switch (kind) {
    case "hero":
      return { kind, headline: "", sub: "", cta: "" };
    case "pain":
      return { kind, items: [] };
    case "method":
      return { kind, steps: [] };
    case "proof":
      return { kind, quotes: [] };
    case "offer":
      return { kind, priceCents: 0, guarantee: "", bonuses: [] };
    case "faq":
      return { kind, items: [] };
    case "cta-whatsapp":
      return { kind, text: "" };
    case "signup-form":
      return { kind, fields: ["nome", "whatsapp", "email"] };
  }
}

export interface ProductForBlocks {
  name: string;
  priceCents: number;
  guarantee: string | null;
  bonuses: string[];
  promises: string[];
}

const GOAL_CTA: Record<string, string> = {
  WHATSAPP: "Quero falar no WhatsApp",
  BUY: "Comprar agora",
  LIVE_SIGNUP: "Garantir minha vaga",
};

/** Blocos default da variante A ao criar uma landing por blocos. */
export function defaultBlocksFor(
  product: ProductForBlocks | null,
  goal: "WHATSAPP" | "BUY" | "LIVE_SIGNUP",
): LandingBlock[] {
  return [
    {
      kind: "hero",
      headline: product ? product.name : "Sua oferta principal",
      sub: product?.promises[0] ?? "",
      cta: GOAL_CTA[goal] ?? "Quero saber mais",
    },
    {
      kind: "offer",
      priceCents: product?.priceCents ?? 0,
      guarantee: product?.guarantee ?? "",
      bonuses: product?.bonuses ?? [],
    },
  ];
}

/** Lê arrays de string de um Json do Prisma com tolerância. */
export function stringArrayFromJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}
