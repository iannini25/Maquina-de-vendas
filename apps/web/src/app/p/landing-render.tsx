import { formatBRL } from "@/lib/format";
import type { LandingBlock } from "@/server/landing/blocks";

import { LandingCta, LandingSignupForm } from "./public-interactive";
import { WhatsappIcon } from "./whatsapp-icon";

/**
 * Renderizador dos blocos da landing (design system da marca: dark + roxo).
 * Usado pela página pública /p/[slug] (interativo) e pelo preview do editor
 * (estático, sem ctx) — por isso não tem hooks nem directive.
 */

export interface LandingCtaContext {
  landingPageId: string;
  variantId: string | null;
  visitorId: string;
  goal: "WHATSAPP" | "BUY" | "LIVE_SIGNUP";
  whatsappLink: string | null;
  buyLink: string | null;
  utmCampaign: string | null;
}

function PrimaryCtaPill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-7 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)]">
      {label}
    </span>
  );
}

function WhatsappPill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp px-7 text-sm font-semibold text-[#04250f]">
      <WhatsappIcon />
      {label}
    </span>
  );
}

function CtaSlot({
  label,
  ctx,
  whatsappStyle = false,
}: {
  label: string;
  ctx: LandingCtaContext | null;
  whatsappStyle?: boolean;
}) {
  if (!label) return null;
  if (!ctx) {
    return whatsappStyle ? <WhatsappPill label={label} /> : <PrimaryCtaPill label={label} />;
  }
  return <LandingCta label={label} ctx={ctx} whatsappStyle={whatsappStyle} />;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
      {children}
    </h2>
  );
}

export function LandingBlocksView({
  blocks,
  ctx,
}: {
  blocks: LandingBlock[];
  /** null = preview estático do editor (CTAs sem ação). */
  ctx: LandingCtaContext | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-14 px-6 py-14">
      {blocks.map((block, index) => (
        <LandingBlockSection key={`${block.kind}-${index}`} block={block} ctx={ctx} />
      ))}
    </div>
  );
}

function LandingBlockSection({
  block,
  ctx,
}: {
  block: LandingBlock;
  ctx: LandingCtaContext | null;
}) {
  switch (block.kind) {
    case "hero":
      return (
        <section className="flex flex-col items-center gap-5 text-center">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[42px]">
            {block.headline || "Sua headline principal"}
          </h1>
          {block.sub && <p className="max-w-lg text-[15px] leading-relaxed text-ink-2">{block.sub}</p>}
          <CtaSlot
            label={block.cta}
            ctx={ctx}
            whatsappStyle={ctx?.goal === "WHATSAPP" && Boolean(ctx?.whatsappLink)}
          />
        </section>
      );

    case "pain":
      if (block.items.length === 0) return null;
      return (
        <section className="space-y-4">
          <SectionHeading>Isso te soa familiar?</SectionHeading>
          <ul className="space-y-2.5">
            {block.items.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-3 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-3 text-[14px] text-ink-2"
              >
                <span aria-hidden className="mt-0.5 text-hot">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      );

    case "method":
      if (block.steps.length === 0) return null;
      return (
        <section className="space-y-4">
          <SectionHeading>Como funciona</SectionHeading>
          <ol className="space-y-2.5">
            {block.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3 text-[14px] text-ink-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-accent">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      );

    case "proof":
      if (block.quotes.length === 0) return null;
      return (
        <section className="space-y-4">
          <SectionHeading>Quem já viveu isso</SectionHeading>
          <div className="space-y-3">
            {block.quotes.map((quote, index) => (
              <blockquote
                key={index}
                className="rounded-2xl border border-hairline bg-white/[0.03] px-5 py-4 text-[14px] italic leading-relaxed text-ink-2"
              >
                “{quote}”
              </blockquote>
            ))}
          </div>
        </section>
      );

    case "offer":
      return (
        <section className="rounded-2xl border border-brand-3/30 bg-[linear-gradient(140deg,#1A1330,#0D0D13_60%)] p-6 text-center sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
            Oferta
          </p>
          <p className="tnum mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
            {formatBRL(block.priceCents)}
          </p>
          {block.bonuses.length > 0 && (
            <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left">
              {block.bonuses.map((bonus, index) => (
                <li key={index} className="flex items-start gap-2 text-[13.5px] text-ink-2">
                  <span aria-hidden className="mt-0.5 text-success">+</span>
                  {bonus}
                </li>
              ))}
            </ul>
          )}
          {block.guarantee && (
            <p className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/[.12] px-3 py-1 text-[12px] font-medium text-success">
              ✓ {block.guarantee}
            </p>
          )}
          <div className="mt-6">
            <CtaSlot
              label={
                ctx?.goal === "BUY"
                  ? "Comprar agora"
                  : ctx?.goal === "LIVE_SIGNUP"
                    ? "Garantir minha vaga"
                    : "Quero começar agora"
              }
              ctx={ctx}
              whatsappStyle={ctx?.goal === "WHATSAPP" && Boolean(ctx?.whatsappLink)}
            />
          </div>
        </section>
      );

    case "faq":
      if (block.items.length === 0) return null;
      return (
        <section className="space-y-4">
          <SectionHeading>Perguntas frequentes</SectionHeading>
          <div className="space-y-2">
            {block.items.map((item, index) => (
              <details
                key={index}
                className="group rounded-2xl border border-hairline bg-white/[0.03] px-5 py-3.5"
              >
                <summary className="cursor-pointer list-none text-[14px] font-semibold text-ink">
                  {item.q}
                </summary>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case "cta-whatsapp":
      // Sem número conectado no modo interativo, o bloco some (estado honesto).
      if (ctx && !ctx.whatsappLink) return null;
      return (
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-whatsapp/25 bg-whatsapp/[0.07] px-6 py-8 text-center">
          <p className="max-w-md text-[15px] font-medium text-ink">
            {block.text || "Fale agora com a gente no WhatsApp"}
          </p>
          <CtaSlot label="Chamar no WhatsApp" ctx={ctx} whatsappStyle />
        </section>
      );

    case "signup-form":
      if (!ctx) {
        return (
          <section className="rounded-2xl border border-hairline bg-white/[0.03] p-6">
            <p className="text-[14px] font-semibold text-ink">Formulário de inscrição</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              Campos: {block.fields.join(", ")} — funcional na página publicada.
            </p>
          </section>
        );
      }
      return <LandingSignupForm fields={block.fields} ctx={ctx} />;
  }
}
