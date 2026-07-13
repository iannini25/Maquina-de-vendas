import type { TenantDb } from "@sales4u/db";

import { parseBlocks, type LandingBlock } from "./blocks";

/**
 * Queries do módulo de landing pages (sempre via ctx.db / tenantDb).
 * Conversão real = (SIGNUP + CTA_WHATSAPP + CTA_BUY) / VIEW dos LandingEvents.
 */

export interface LandingListItem {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  kind: "BUILDER" | "EXTERNAL_URL" | "UPLOADED";
  variantCount: number;
  views: number;
  conversions: number;
}

const CONVERSION_TYPES = ["SIGNUP", "CTA_WHATSAPP", "CTA_BUY"] as const;

export async function listLandingPages(db: TenantDb): Promise<LandingListItem[]> {
  const [pages, eventGroups] = await Promise.all([
    db.landingPage.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        kind: true,
        _count: { select: { variants: true } },
      },
    }),
    db.landingEvent.groupBy({
      by: ["landingPageId", "type"],
      _count: { _all: true },
    }),
  ]);

  const viewsByPage = new Map<string, number>();
  const convByPage = new Map<string, number>();
  for (const group of eventGroups) {
    const count = group._count._all;
    if (group.type === "VIEW") {
      viewsByPage.set(group.landingPageId, (viewsByPage.get(group.landingPageId) ?? 0) + count);
    } else if ((CONVERSION_TYPES as readonly string[]).includes(group.type)) {
      convByPage.set(group.landingPageId, (convByPage.get(group.landingPageId) ?? 0) + count);
    }
  }

  return pages.map((page) => ({
    id: page.id,
    name: page.name,
    slug: page.slug,
    status: page.status,
    kind: page.kind,
    variantCount: page._count.variants,
    views: viewsByPage.get(page.id) ?? 0,
    conversions: convByPage.get(page.id) ?? 0,
  }));
}

export interface LandingVariantDetail {
  id: string;
  name: string;
  deviceTarget: "ANY" | "MOBILE" | "TABLET" | "DESKTOP";
  weight: number;
  isWinner: boolean;
  blocks: LandingBlock[];
  views: number;
  conversions: number;
}

export interface LandingDetail {
  id: string;
  name: string;
  slug: string;
  goal: "WHATSAPP" | "BUY" | "LIVE_SIGNUP";
  kind: "BUILDER" | "EXTERNAL_URL" | "UPLOADED";
  externalUrl: string | null;
  storageKey: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  productName: string | null;
  variants: LandingVariantDetail[];
}

export async function getLandingDetail(db: TenantDb, id: string): Promise<LandingDetail | null> {
  const page = await db.landingPage.findUnique({
    where: { id },
    include: {
      productOffer: { select: { name: true } },
      variants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!page) return null;

  const eventGroups = await db.landingEvent.groupBy({
    by: ["variantId", "type"],
    where: { landingPageId: id },
    _count: { _all: true },
  });

  const viewsByVariant = new Map<string, number>();
  const convByVariant = new Map<string, number>();
  for (const group of eventGroups) {
    if (!group.variantId) continue;
    const count = group._count._all;
    if (group.type === "VIEW") {
      viewsByVariant.set(group.variantId, (viewsByVariant.get(group.variantId) ?? 0) + count);
    } else if ((CONVERSION_TYPES as readonly string[]).includes(group.type)) {
      convByVariant.set(group.variantId, (convByVariant.get(group.variantId) ?? 0) + count);
    }
  }

  return {
    id: page.id,
    name: page.name,
    slug: page.slug,
    goal: page.goal,
    kind: page.kind,
    externalUrl: page.externalUrl,
    storageKey: page.storageKey,
    status: page.status,
    publishedAt: page.publishedAt?.toISOString() ?? null,
    productName: page.productOffer?.name ?? null,
    variants: page.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      deviceTarget: variant.deviceTarget,
      weight: variant.weight,
      isWinner: variant.isWinner,
      blocks: parseBlocks(variant.blocks),
      views: viewsByVariant.get(variant.id) ?? 0,
      conversions: convByVariant.get(variant.id) ?? 0,
    })),
  };
}
