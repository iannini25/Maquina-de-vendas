"use client";

import { useEffect, useState } from "react";

import {
  createLeadFromLandingAction,
  registerLandingCtaAction,
} from "@/server/landing/public-actions";

import type { LandingCtaContext } from "./landing-render";
import { WhatsappIcon } from "./whatsapp-icon";

/** Interatividade da página pública: CTA rastreado, formulário e cookie do visitante. */

/** Persiste o visitorId gerado no SSR (sticky bucket do A/B). */
export function SetVisitorCookie({ visitorId }: { visitorId: string }) {
  useEffect(() => {
    if (!document.cookie.includes("vf-visitor=")) {
      document.cookie = `vf-visitor=${visitorId}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [visitorId]);
  return null;
}

export function LandingCta({
  label,
  ctx,
  whatsappStyle,
}: {
  label: string;
  ctx: LandingCtaContext;
  whatsappStyle?: boolean;
}) {
  const onClick = () => {
    if (ctx.goal === "WHATSAPP" && ctx.whatsappLink) {
      void registerLandingCtaAction({
        landingPageId: ctx.landingPageId,
        variantId: ctx.variantId,
        type: "CTA_WHATSAPP",
        visitorId: ctx.visitorId,
      });
      window.location.href = ctx.whatsappLink;
      return;
    }
    if (ctx.goal === "BUY" && ctx.buyLink) {
      void registerLandingCtaAction({
        landingPageId: ctx.landingPageId,
        variantId: ctx.variantId,
        type: "CTA_BUY",
        visitorId: ctx.visitorId,
      });
      window.location.href = ctx.buyLink;
      return;
    }
    document.getElementById("vf-signup")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (whatsappStyle) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp px-7 text-sm font-semibold text-[#04250f] transition-transform duration-200 hover:brightness-110 active:scale-[.98]"
      >
        <WhatsappIcon />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-7 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-transform duration-200 hover:brightness-110 active:scale-[.98]"
    >
      {label}
    </button>
  );
}

const inputClass =
  "w-full rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13px] " +
  "text-ink placeholder:text-ink-3 transition-colors duration-[130ms] " +
  "focus:border-brand-3 focus:outline-none";

export function LandingSignupForm({
  fields,
  ctx,
}: {
  fields: Array<"nome" | "whatsapp" | "email">;
  ctx: LandingCtaContext;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ whatsappLink: string | null } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createLeadFromLandingAction({
      landingPageId: ctx.landingPageId,
      variantId: ctx.variantId,
      visitorId: ctx.visitorId,
      name,
      whatsapp,
      email: email || undefined,
      utmCampaign: ctx.utmCampaign ?? undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível enviar. Tente de novo.");
      return;
    }
    setDone({ whatsappLink: result.whatsappLink ?? null });
  };

  if (done) {
    return (
      <section
        id="vf-signup"
        className="flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/[.08] px-6 py-10 text-center"
      >
        <p className="font-display text-xl font-semibold text-ink">Inscrição confirmada 🎉</p>
        <p className="max-w-sm text-[13.5px] text-ink-2">
          Você vai receber as próximas instruções no seu WhatsApp.
        </p>
        {done.whatsappLink && (
          <a
            href={done.whatsappLink}
            className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp px-7 text-sm font-semibold text-[#04250f] transition-transform duration-200 hover:brightness-110 active:scale-[.98]"
          >
            <WhatsappIcon />
            Continuar no WhatsApp
          </a>
        )}
      </section>
    );
  }

  return (
    <section
      id="vf-signup"
      className="rounded-2xl border border-brand-3/30 bg-[linear-gradient(140deg,#1A1330,#0D0D13_60%)] p-6 sm:p-8"
    >
      <h2 className="font-display text-center text-xl font-semibold tracking-tight text-ink">
        Garanta sua vaga
      </h2>
      <form onSubmit={(event) => void submit(event)} className="mx-auto mt-5 flex max-w-sm flex-col gap-3">
        {fields.includes("nome") && (
          <input
            className={inputClass}
            placeholder="Seu nome"
            aria-label="Seu nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        )}
        {fields.includes("whatsapp") && (
          <input
            className={inputClass}
            placeholder="WhatsApp (DDD + número)"
            aria-label="Seu WhatsApp"
            inputMode="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            required
          />
        )}
        {fields.includes("email") && (
          <input
            className={inputClass}
            placeholder="Seu melhor e-mail (opcional)"
            aria-label="Seu e-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
        {error && (
          <p role="alert" className="text-center text-xs text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-7 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-transform duration-200 hover:brightness-110 active:scale-[.98] disabled:pointer-events-none disabled:opacity-55"
        >
          {submitting && (
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          Quero me inscrever
        </button>
      </form>
    </section>
  );
}
