import { prisma } from "@vendaflow/db";

import { getCredentialData } from "@/server/credentials/service";

import { parseBlocks, type LandingBlock } from "./blocks";

/**
 * Resolução PÚBLICA de landing pages (rota /p/[slug], sem sessão).
 * Exceção documentada à regra do tenantDb: não há workspace na sessão — o
 * escopo vem da própria landing encontrada. O slug é único por workspace;
 * na resolução global usamos a primeira publicada.
 * TODO(multi-domínio): resolver o workspace pelo host quando houver domínio
 * próprio por workspace, eliminando a ambiguidade de slug entre tenants.
 */

export interface PublicVariant {
  id: string;
  deviceTarget: "ANY" | "MOBILE" | "TABLET" | "DESKTOP";
  weight: number;
  blocks: LandingBlock[];
}

export interface PublicLanding {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  goal: "WHATSAPP" | "BUY" | "LIVE_SIGNUP";
  kind: "BUILDER" | "EXTERNAL_URL" | "UPLOADED";
  externalUrl: string | null;
  storageKey: string | null;
  buyLink: string | null;
  variants: PublicVariant[];
}

interface AccessLinkJson {
  url?: unknown;
}

function firstAccessLink(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object") {
      const url = (item as AccessLinkJson).url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }
  return null;
}

export async function findPublishedLandingBySlug(slug: string): Promise<PublicLanding | null> {
  const landing = await prisma.landingPage.findFirst({
    where: { slug, status: "PUBLISHED" },
    orderBy: { publishedAt: "asc" },
    include: {
      productOffer: { select: { accessLinks: true } },
      variants: {
        orderBy: { createdAt: "asc" },
        select: { id: true, deviceTarget: true, weight: true, blocks: true },
      },
    },
  });
  if (!landing) return null;

  return {
    id: landing.id,
    workspaceId: landing.workspaceId,
    name: landing.name,
    slug: landing.slug,
    goal: landing.goal,
    kind: landing.kind,
    externalUrl: landing.externalUrl,
    storageKey: landing.storageKey,
    buyLink: firstAccessLink(landing.productOffer?.accessLinks),
    variants: landing.variants.map((variant) => ({
      id: variant.id,
      deviceTarget: variant.deviceTarget,
      weight: variant.weight,
      blocks: parseBlocks(variant.blocks),
    })),
  };
}

/**
 * Número de WhatsApp conectado do workspace (credencial EVOLUTION).
 * A instância costuma ser nomeada com o número; sem número identificável,
 * a página esconde o CTA de WhatsApp e mostra o formulário (estado honesto).
 */
export async function resolveWhatsappNumber(workspaceId: string): Promise<string | null> {
  const data = await getCredentialData(workspaceId, "EVOLUTION");
  if (!data) return null;
  const candidates = [data.phoneNumber, data.number, data.instanceName];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return digits;
  }
  return null;
}

export interface PixelIds {
  metaPixelId: string | null;
  googleTagId: string | null;
}

export async function resolvePixelIds(workspaceId: string): Promise<PixelIds> {
  const [meta, google] = await Promise.all([
    getCredentialData(workspaceId, "META_PIXEL"),
    getCredentialData(workspaceId, "GOOGLE_TAG"),
  ]);
  return {
    metaPixelId: meta?.pixelId?.trim() || null,
    googleTagId: google?.tagId?.trim() || null,
  };
}

/** Registra um LandingEvent sem bloquear a renderização (fire-and-forget). */
export function recordLandingView(input: {
  landingPageId: string;
  variantId: string | null;
  visitorId: string;
  device: string;
  utmCampaign?: string | null;
}): void {
  void prisma.landingEvent
    .create({
      data: {
        landingPageId: input.landingPageId,
        variantId: input.variantId,
        type: "VIEW",
        visitorId: input.visitorId,
        meta: { device: input.device, utmCampaign: input.utmCampaign ?? null },
      },
    })
    .catch(() => {
      // métrica de view não pode derrubar a página pública
    });
}
