"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, Overline } from "@/components/ui/card";
import type { StudioPageData } from "@/server/studio/queries";

import { AddTemplateModal } from "./add-template-modal";
import { FLOW_DEFS } from "./flows";
import { TemplateThumb } from "./template-thumb";

/** CTA da topbar (pílula com seta, padrão do protótipo). */
function HeaderCta({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9.5 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] pl-4.5 pr-1.5 text-[13px] font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110 active:scale-[.98]"
    >
      {children}
      <span className="flex size-6.5 items-center justify-center rounded-full bg-white/20">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </span>
    </button>
  );
}

/** Hub do Criar com IA: hero, grid 3×2 de tipos e biblioteca de templates. */
export function HubView({ data }: { data: StudioPageData }) {
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const scrollToTemplates = () => {
    document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader
        title="Criar com IA"
        subtitle="Gere copy, landing, campanha e mensagens com o seu contexto"
        actions={<HeaderCta onClick={scrollToTemplates}>Ver templates</HeaderCta>}
      />

      <div className="flex flex-col gap-5 p-6">
        <Card
          hero
          className="rise-in border-brand-3/40 p-7 shadow-[0_0_0_1px_rgba(139,92,246,.2),0_24px_64px_-24px_rgba(139,92,246,.5)]"
        >
          <Overline>Criar com IA</Overline>
          <h2 className="font-display mt-2 text-[27px] font-semibold tracking-tight text-ink">
            O que vamos criar hoje?
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-2">
            Tudo puxa do seu produto, contexto e templates — e o resultado vai direto pro módulo
            certo.
          </p>
          <div className="mt-4">
            {data.hasDesignSystem ? (
              <Badge tone="success">✓ Usando o Design System cadastrado</Badge>
            ) : (
              <Badge tone="muted">Sem Design System — cadastre em Contexto para a IA seguir sua marca</Badge>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLOW_DEFS.map((flow, index) => (
            <Link
              key={flow.slug}
              href={`/criar/${flow.slug}`}
              className="rise-in group rounded-2xl border border-hairline bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 ease-[var(--ease-out)] hover:border-brand-3/40 hover:bg-white/[0.05]"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl border"
                style={{
                  color: flow.color,
                  borderColor: `${flow.color}40`,
                  backgroundColor: `${flow.color}1a`,
                }}
                aria-hidden
              >
                {flow.icon}
              </span>
              <p className="mt-6 text-[14.5px] font-semibold text-ink group-hover:text-accent">
                {flow.title}
              </p>
              <p className="mt-0.5 text-[12.5px] text-ink-3">{flow.description}</p>
            </Link>
          ))}
        </div>

        <section id="templates" className="scroll-mt-20">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[17px] font-semibold tracking-tight text-ink">
              Biblioteca de templates
            </h3>
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="rounded-full border border-hairline bg-surface-2 px-4 py-2 text-[12.5px] font-semibold text-ink transition-all duration-[130ms] hover:border-brand-3/40 hover:bg-surface-3"
            >
              Adicionar template
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.templates.map((template, index) => (
              <TemplateThumb key={template.id} name={template.name} source={template.source} seed={index} />
            ))}
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-hairline text-[13px] font-medium text-accent transition-all duration-[130ms] hover:border-brand-3/50 hover:bg-brand-soft/40"
            >
              + Adicionar template
            </button>
          </div>
        </section>
      </div>

      <AddTemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />
    </>
  );
}
