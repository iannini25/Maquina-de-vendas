"use server";

import { prisma } from "@vendaflow/db";
import { headers } from "next/headers";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";

import { resolveWhatsappNumber } from "./public-queries";

/**
 * Server Actions PÚBLICAS da landing (/p/[slug]) — sem sessão.
 * Exceção documentada à regra do tenantDb: o workspace vem da própria landing
 * PUBLISHED validada por id/slug, nunca de input solto do visitante.
 */

async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
}

const ctaSchema = z.object({
  landingPageId: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  type: z.enum(["CTA_WHATSAPP", "CTA_BUY"]),
  visitorId: z.string().min(1).max(80),
});

export interface PublicActionResult {
  ok: boolean;
  error?: string;
}

/** Registra clique de CTA (WhatsApp/Compra) da página pública. */
export async function registerLandingCtaAction(
  input: z.infer<typeof ctaSchema>,
): Promise<PublicActionResult> {
  const parsed = ctaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const ip = await clientIp();
  const limit = await rateLimit(`landing-cta:${ip}`, 30, 60);
  if (!limit.allowed) return { ok: false, error: "Muitas requisições" };

  const landing = await prisma.landingPage.findFirst({
    where: { id: parsed.data.landingPageId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!landing) return { ok: false, error: "Página não encontrada" };

  // variantId precisa pertencer a ESTA landing (integridade das métricas A/B).
  let variantId: string | null = null;
  if (parsed.data.variantId) {
    const variant = await prisma.landingVariant.findFirst({
      where: { id: parsed.data.variantId, landingPageId: landing.id },
      select: { id: true },
    });
    variantId = variant?.id ?? null;
  }

  await prisma.landingEvent.create({
    data: {
      landingPageId: parsed.data.landingPageId,
      variantId,
      type: parsed.data.type,
      visitorId: parsed.data.visitorId,
    },
  });
  return { ok: true };
}

const signupSchema = z.object({
  landingPageId: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  visitorId: z.string().min(1).max(80),
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  whatsapp: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().min(10, "WhatsApp inválido — use DDD + número").max(15, "WhatsApp inválido")),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(160)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  utmCampaign: z.string().trim().max(160).optional(),
});

export interface SignupResult extends PublicActionResult {
  whatsappLink?: string | null;
}

/**
 * Formulário público da landing: cria Lead (origem landing) + Conversation,
 * registra LandingEvent SIGNUP e notifica o workspace via SSE.
 */
export async function createLeadFromLandingAction(
  input: z.infer<typeof signupSchema>,
): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const data = parsed.data;

  const ip = await clientIp();
  const limit = await rateLimit(`landing-signup:${ip}`, 5, 60);
  if (!limit.allowed) {
    return { ok: false, error: "Muitas tentativas — aguarde um minuto e tente de novo." };
  }

  const landing = await prisma.landingPage.findFirst({
    where: { id: data.landingPageId, status: "PUBLISHED" },
    select: { id: true, workspaceId: true, name: true },
  });
  if (!landing) return { ok: false, error: "Página não encontrada" };

  // Campanha por UTM: aceita id ou nome exato dentro do workspace da landing.
  let campaignId: string | null = null;
  if (data.utmCampaign) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        workspaceId: landing.workspaceId,
        OR: [{ id: data.utmCampaign }, { name: data.utmCampaign }],
      },
      select: { id: true },
    });
    campaignId = campaign?.id ?? null;
  }

  const newStage = await prisma.pipelineStage.findFirst({
    where: { workspaceId: landing.workspaceId, systemKey: "NEW" },
    select: { id: true },
  });
  const fallbackStage =
    newStage ??
    (await prisma.pipelineStage.findFirst({
      where: { workspaceId: landing.workspaceId },
      orderBy: { order: "asc" },
      select: { id: true },
    }));
  if (!fallbackStage) return { ok: false, error: "Funil do workspace não configurado" };

  // Dedupe por telefone: reaproveita o lead existente em vez de duplicar.
  const existing = await prisma.lead.findFirst({
    where: { workspaceId: landing.workspaceId, phone: data.whatsapp },
    select: { id: true },
  });

  const lead =
    existing ??
    (await prisma.lead.create({
      data: {
        workspaceId: landing.workspaceId,
        name: data.name,
        phone: data.whatsapp,
        email: data.email ?? null,
        source: "landing",
        landingPageId: landing.id,
        campaignId,
        stageId: fallbackStage.id,
        lastInteractionAt: new Date(),
      },
      select: { id: true },
    }));

  if (!existing) {
    await prisma.conversation.create({
      data: {
        workspaceId: landing.workspaceId,
        leadId: lead.id,
        channel: "WHATSAPP",
        state: "BOT",
      },
    });
  }

  // variantId validado contra a própria landing (integridade das métricas A/B)
  const signupVariant = data.variantId
    ? await prisma.landingVariant.findFirst({
        where: { id: data.variantId, landingPageId: landing.id },
        select: { id: true },
      })
    : null;

  await prisma.landingEvent.create({
    data: {
      landingPageId: landing.id,
      variantId: signupVariant?.id ?? null,
      type: "SIGNUP",
      visitorId: data.visitorId,
      leadId: lead.id,
      meta: { utmCampaign: data.utmCampaign ?? null },
    },
  });

  await logEvent({
    workspaceId: landing.workspaceId,
    actorType: "SYSTEM",
    type: existing ? "landing.signup_repeated" : "lead.created",
    entity: "Lead",
    entityId: lead.id,
    data: { source: "landing", landingPageId: landing.id, landingName: landing.name, campaignId },
    notify: ["pipeline", "notify"],
  });

  const number = await resolveWhatsappNumber(landing.workspaceId);
  const message = encodeURIComponent(`Olá! Acabei de me inscrever pela página "${landing.name}".`);
  return {
    ok: true,
    whatsappLink: number ? `https://wa.me/${number}?text=${message}` : null,
  };
}

/**
 * Variante FormData da captura (progressive enhancement): o <form action>
 * funciona antes da hidratação e até sem JavaScript.
 */
export async function createLeadFromLandingFormAction(
  _prev: SignupResult | null,
  formData: FormData,
): Promise<SignupResult> {
  return createLeadFromLandingAction({
    landingPageId: String(formData.get("landingPageId") ?? ""),
    variantId: (formData.get("variantId") as string) || null,
    visitorId: String(formData.get("visitorId") ?? ""),
    name: String(formData.get("name") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    email: (formData.get("email") as string) || undefined,
    utmCampaign: (formData.get("utmCampaign") as string) || undefined,
  });
}
