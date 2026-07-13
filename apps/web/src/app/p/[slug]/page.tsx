import { detectDevice, pickVariant } from "@sales4u/core";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import type { LandingBlock } from "@/server/landing/blocks";
import {
  findPublishedLandingBySlug,
  recordLandingView,
  resolvePixelIds,
  resolveWhatsappNumber,
} from "@/server/landing/public-queries";

import { LandingBlocksView, type LandingCtaContext } from "../landing-render";
import { SetVisitorCookie } from "../public-interactive";

/**
 * Página pública da landing (/p/[slug]) — SSR sem auth.
 * Variante por dispositivo + bucket A/B estável (visitorId em cookie),
 * VIEW registrada fire-and-forget, pixels por credencial do workspace.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const landing = await findPublishedLandingBySlug(slug);
  return { title: landing ? landing.name : "Página não encontrada" };
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PublicLandingPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);

  const landing = await findPublishedLandingBySlug(slug);
  if (!landing) notFound();

  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const visitorId = cookieStore.get("vf-visitor")?.value ?? randomUUID();
  const device = detectDevice(headerList.get("user-agent") ?? "");
  const utmCampaign = firstParam(search["utm_campaign"]);

  // Link externo: registra a visita e repassa (redirect temporário).
  if (landing.kind === "EXTERNAL_URL" && landing.externalUrl) {
    recordLandingView({
      landingPageId: landing.id,
      variantId: null,
      visitorId,
      device,
      utmCampaign,
    });
    redirect(landing.externalUrl);
  }

  const picked = pickVariant(
    landing.variants.map((variant) => ({
      id: variant.id,
      deviceTarget: variant.deviceTarget,
      weight: variant.weight,
    })),
    device,
    visitorId,
  );
  const variant = landing.variants.find((item) => item.id === picked?.id) ?? landing.variants[0];

  recordLandingView({
    landingPageId: landing.id,
    variantId: variant?.id ?? null,
    visitorId,
    device,
    utmCampaign,
  });

  const [whatsappNumber, pixels] = await Promise.all([
    resolveWhatsappNumber(landing.workspaceId),
    resolvePixelIds(landing.workspaceId),
  ]);

  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Olá! Vim pela página "${landing.name}" e quero saber mais.`,
      )}`
    : null;

  const ctx: LandingCtaContext = {
    landingPageId: landing.id,
    variantId: variant?.id ?? null,
    visitorId,
    goal: landing.goal,
    whatsappLink,
    buyLink: landing.buyLink,
    utmCampaign,
  };

  // Fallback honesto: sem WhatsApp conectado (ou sem link de compra), o CTA
  // principal vira formulário de inscrição.
  const blocks: LandingBlock[] = [...(variant?.blocks ?? [])];
  const hasForm = blocks.some((block) => block.kind === "signup-form");
  const needsForm =
    landing.goal === "LIVE_SIGNUP" ||
    (landing.goal === "WHATSAPP" && !whatsappLink) ||
    (landing.goal === "BUY" && !landing.buyLink);
  if (needsForm && !hasForm) {
    blocks.push({ kind: "signup-form", fields: ["nome", "whatsapp", "email"] });
  }

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <SetVisitorCookie visitorId={visitorId} />
      {pixels.metaPixelId && <MetaPixelScript pixelId={pixels.metaPixelId} />}
      {pixels.googleTagId && <GoogleTagScript tagId={pixels.googleTagId} />}

      {landing.kind === "UPLOADED" ? (
        <iframe
          src={`/p/${landing.slug}/raw`}
          title={landing.name}
          className="h-dvh w-full border-0"
        />
      ) : (
        <>
          <LandingBlocksView blocks={blocks} ctx={ctx} />
          <footer className="pb-10 text-center text-[11px] text-ink-3">
            Feito com Sales4U
          </footer>
        </>
      )}
    </main>
  );
}

function MetaPixelScript({ pixelId }: { pixelId: string }) {
  const code = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

function GoogleTagScript({ tagId }: { tagId: string }) {
  const code = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${tagId}');`;
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`} />
      <script dangerouslySetInnerHTML={{ __html: code }} />
    </>
  );
}
