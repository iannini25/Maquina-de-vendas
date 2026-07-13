"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { formatBRL } from "@/lib/format";
import { createLandingAction } from "@/server/landing/actions";
import type { LandingListItem } from "@/server/landing/queries";

/** Tela Landing Pages: banner + grid de cards + modal "Nova landing page". */

interface ProductOption {
  id: string;
  name: string;
  priceCents: number;
}

type StartMode = "BUILDER" | "EXTERNAL_URL" | "UPLOADED";

const GOAL_OPTIONS = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "BUY", label: "Compra direta" },
  { value: "LIVE_SIGNUP", label: "Inscrição live" },
] as const;

function displayUrl(base: string, slug: string): string {
  return `${base.replace(/^https?:\/\//, "")}/p/${slug}`;
}

function convLabel(views: number, conversions: number): string {
  if (views === 0) return "—";
  const rate = (conversions / views) * 100;
  return `${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function LandingPagesClient({
  pages,
  products,
  landingBaseUrl,
}: {
  pages: LandingListItem[];
  products: ProductOption[];
  landingBaseUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const published = pages.filter((page) => page.status === "PUBLISHED").length;
  const drafts = pages.length - published;

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${landingBaseUrl}/p/${slug}`);
      toast("Link copiado — disponível para o SDR e campanhas.");
    } catch {
      toast("Não foi possível copiar o link.", "danger");
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Landing Pages"
        subtitle={`${published} publicada${published === 1 ? "" : "s"} · ${drafts} rascunho${drafts === 1 ? "" : "s"} · links usados pela IA`}
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Nova landing page
          </Button>
        }
      />

      <div className="flex-1 space-y-5 p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-brand-3/25 bg-brand-soft px-4 py-3 text-[13px] text-ink">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-4.5 shrink-0 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5" />
            <path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5" />
          </svg>
          Os links cadastrados aqui são os que o SDR de IA e as campanhas usam para vender.
        </div>

        {pages.length === 0 ? (
          <EmptyState
            title="Nenhuma landing page ainda"
            hint="Crie a primeira — o SDR de IA e as campanhas usam esses links para vender."
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Nova landing page
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pages.map((page, index) => (
              <article
                key={page.id}
                className="rise-in group cursor-pointer overflow-hidden rounded-2xl border border-hairline bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-200 hover:border-brand-3/40"
                style={{ animationDelay: `${index * 40}ms` }}
                onClick={() => router.push(`/landing-pages/${page.id}`)}
              >
                <div className="flex h-36 items-center justify-center bg-[radial-gradient(120%_140%_at_30%_0%,rgba(124,58,237,.28),rgba(13,13,19,.4)_70%)]">
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="size-8 text-accent/70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                  >
                    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                    <path d="M3.5 9.5h17" />
                  </svg>
                </div>
                <div className="space-y-2 border-t border-hairline-soft p-4">
                  <h3 className="text-[14px] font-semibold text-ink">{page.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-medium text-accent">
                      {displayUrl(landingBaseUrl, page.slug)}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyLink(page.slug);
                      }}
                      className="shrink-0 rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-2 transition-colors duration-[130ms] hover:border-brand-3/40 hover:text-ink"
                    >
                      Copiar
                    </button>
                  </div>
                  <p className="flex items-center gap-3 text-[11.5px] text-ink-3">
                    <span>{page.status === "PUBLISHED" ? "Publicada" : "Rascunho"}</span>
                    <span className="tnum">conv. {convLabel(page.views, page.conversions)}</span>
                    <span className="tnum">
                      {page.variantCount} variante{page.variantCount === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <NewLandingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        products={products}
      />
    </div>
  );
}

function NewLandingModal({
  open,
  onClose,
  products,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<StartMode>("BUILDER");
  const [name, setName] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [goal, setGoal] = useState<string>("WHATSAPP");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("productOfferId", productId);
    formData.set("goal", goal);
    formData.set("kind", mode);
    if (mode === "EXTERNAL_URL") formData.set("externalUrl", externalUrl);
    if (mode === "UPLOADED" && file) formData.set("file", file);

    const result = await createLandingAction(formData);
    setSubmitting(false);
    if (!result.ok || !result.id) {
      setError(result.error ?? "Não foi possível criar a landing page.");
      return;
    }
    toast("Landing page criada.");
    onClose();
    router.push(`/landing-pages/${result.id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova landing page"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={submitting} onClick={() => void submit()}>
            Criar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Como começar</p>
          <Segmented<StartMode>
            options={[
              { value: "BUILDER", label: "Por blocos" },
              { value: "EXTERNAL_URL", label: "Anexar link" },
              { value: "UPLOADED", label: "Anexar arquivo" },
            ]}
            value={mode}
            onChange={setMode}
            className="w-full"
          />
          <p className="mt-2 rounded-[11px] border border-dashed border-hairline px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-3">
            Por blocos: monte do zero no editor. Anexar link: cole a URL e o sistema emula a
            página dentro do Sales4U. Anexar arquivo: suba HTML/zip e edite no emulador.
          </p>
        </div>

        <Input
          label="Nome"
          requiredMark
          placeholder="Ex.: Oferta Curso R$ 1.997"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Produto"
            requiredMark
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            {products.length === 0 && <option value="">Cadastre um produto primeiro</option>}
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatBRL(product.priceCents)}
              </option>
            ))}
          </Select>
          <Select
            label="Objetivo"
            requiredMark
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          >
            {GOAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {mode === "EXTERNAL_URL" && (
          <Input
            label="URL externa"
            requiredMark
            type="url"
            placeholder="https://sua-pagina.com/oferta"
            value={externalUrl}
            onChange={(event) => setExternalUrl(event.target.value)}
          />
        )}

        {mode === "UPLOADED" && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">
              Arquivo <span className="text-accent">*</span>
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-[11px] border border-dashed border-hairline px-4 py-6 text-center transition-colors duration-[130ms] hover:border-brand-3/40">
              <span className="text-[13px] font-medium text-ink-2">
                {file ? file.name : "Clique para escolher um .html ou .zip"}
              </span>
              <span className="text-[11px] text-ink-3">Até 8 MB</span>
              <input
                type="file"
                accept=".html,.htm,.zip"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
