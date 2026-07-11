"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/misc";
import type { EmailTemplateCardDto, EmailTemplatesPageData } from "@/server/email-templates/queries";

/** Galeria de Templates de E-mail: banner do Design System + grid de cards. */

function StatusDot({ status }: { status: "DRAFT" | "ACTIVE" }) {
  const active = status === "ACTIVE";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-medium", active ? "text-success" : "text-warm")}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {active ? "Ativo" : "Rascunho"}
    </span>
  );
}

function TemplateCard({ template }: { template: EmailTemplateCardDto }) {
  return (
    <Link
      href={`/emails/${template.id}`}
      className="group overflow-hidden rounded-2xl border border-hairline bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 ease-[var(--ease-out)] hover:border-brand-3/40 hover:-translate-y-0.5"
    >
      {/* Mini-preview renderizado do e-mail (mesmo HTML do editor, em escala) */}
      <div className="relative h-40 overflow-hidden border-b border-hairline-soft bg-[#08080B]">
        <iframe
          srcDoc={template.previewHtml}
          title={`Preview de ${template.name}`}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          scrolling="no"
          sandbox=""
          className="pointer-events-none absolute left-1/2 top-0 h-[880px] w-[620px] origin-top -translate-x-1/2 scale-[0.52] border-0"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(180deg,transparent,rgba(8,8,11,.9))]" />
      </div>
      <div className="p-4">
        <h3 className="text-[13.5px] font-semibold text-ink group-hover:text-white">{template.name}</h3>
        <p className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-3">
          <StatusDot status={template.status} />
          <span aria-hidden>·</span>
          {template.categoryLabel}
        </p>
      </div>
    </Link>
  );
}

export function EmailsView({ data }: { data: EmailTemplatesPageData }) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Templates de E-mail"
        subtitle="Conteúdo por IA · estrutura e marca configuráveis"
        actions={
          <Button variant="primary" onClick={() => router.push("/emails/novo")}>
            Novo template
            <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </Button>
        }
      />

      <div className="flex flex-col gap-5 p-6">
        {data.designSystemIndexed ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-success/30 bg-success/[0.08] px-4 py-3 text-[13px] text-success">
            <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 13 4 4L19 7" />
            </svg>
            Usando o Design System cadastrado — a IA segue marca, cores e tom ao gerar o corpo dos e-mails.
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
            <span>Cadastre seu Design System no Contexto para a IA seguir sua marca ao gerar os e-mails.</span>
            <Button size="sm" onClick={() => router.push("/contexto")}>
              Abrir Contexto
            </Button>
          </div>
        )}

        {data.templates.length === 0 ? (
          <EmptyState
            title="Nenhum template de e-mail ainda"
            hint="Crie o primeiro template — a IA escreve o corpo seguindo sua marca e você só ajusta estrutura e CTA."
            action={
              <Button variant="primary" onClick={() => router.push("/emails/novo")}>
                Novo template
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.templates.map((template, index) => (
              <div key={template.id} className="rise-in" style={{ animationDelay: `${index * 40}ms` }}>
                <TemplateCard template={template} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
