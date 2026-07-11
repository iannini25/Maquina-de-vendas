import type { Metadata } from "next";

import { hasAiCredential } from "@/lib/ai";
import { requireWorkspace } from "@/lib/session";
import { getCredentialData } from "@/server/credentials/service";

import { AnunciosClient, type AdLibraryItem, type SwipeItem } from "./anuncios-client";

export const metadata: Metadata = { title: "Anúncios & Tráfego" };

interface AdMetricsJson {
  impressions?: unknown;
  clicks?: unknown;
  cplCents?: unknown;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface SwipeDataJson {
  link?: unknown;
  hook?: unknown;
  niche?: unknown;
  cta?: unknown;
  learning?: unknown;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export default async function AnunciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireWorkspace();
  const search = await searchParams;
  const campaignParamRaw = search["campaign"];
  const campaignParam = Array.isArray(campaignParamRaw)
    ? (campaignParamRaw[0] ?? null)
    : (campaignParamRaw ?? null);

  const [products, ads, swipes, campaigns, aiOk, higgsfieldData] = await Promise.all([
    ctx.db.productOffer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
    ctx.db.ad.findMany({
      where: { savedToLibrary: true, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      include: { campaign: { select: { id: true, name: true } } },
    }),
    ctx.db.template.findMany({
      where: { kind: "SWIPE" },
      orderBy: { createdAt: "desc" },
    }),
    ctx.db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    hasAiCredential(ctx.workspaceId),
    getCredentialData(ctx.workspaceId, "HIGGSFIELD"),
  ]);

  const libraryAds: AdLibraryItem[] = ads.map((ad) => {
    const metrics = (ad.metrics ?? {}) as AdMetricsJson;
    const impressions = asNumber(metrics.impressions);
    const clicks = asNumber(metrics.clicks);
    return {
      id: ad.id,
      headline: ad.headline,
      hook: ad.hook,
      channel: ad.channel,
      status: ad.status,
      campaignId: ad.campaign?.id ?? null,
      campaignName: ad.campaign?.name ?? null,
      ctr: impressions && clicks ? (clicks / impressions) * 100 : null,
      cplCents: asNumber(metrics.cplCents),
    };
  });

  const swipeItems: SwipeItem[] = swipes.map((swipe) => {
    const data = (swipe.data ?? {}) as SwipeDataJson;
    return {
      id: swipe.id,
      title: swipe.name,
      link: asText(data.link),
      hook: asText(data.hook),
      niche: asText(data.niche),
      cta: asText(data.cta),
      learning: asText(data.learning),
    };
  });

  return (
    <AnunciosClient
      products={products}
      libraryAds={libraryAds}
      swipes={swipeItems}
      campaigns={campaigns}
      aiOk={aiOk}
      higgsfieldOk={higgsfieldData !== null}
      campaignParam={campaignParam}
    />
  );
}
