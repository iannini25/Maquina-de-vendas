"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Chip, EmptyState, ErrorState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { saveAdToLibraryAction } from "@/server/ads/actions";
import type { LandingBlock } from "@/server/landing/blocks";
import {
  createStudioCampaign,
  createStudioEmailTemplate,
  createStudioLanding,
  generateStudioAd,
  generateStudioCampaign,
  generateStudioEmail,
  generateStudioFullLanding,
  generateStudioSection,
  generateStudioWhatsapp,
  type StudioAdResult,
  type StudioCampaignResult,
  type StudioEmailResult,
  type StudioFullLandingResult,
} from "@/server/studio/actions";
import type { StudioPageData } from "@/server/studio/queries";

import { AddTemplateModal } from "../add-template-modal";
import { flowBySlug, type FlowSlug } from "../flows";
import { TemplateThumb } from "../template-thumb";

type ContextSource = "existente" | "novo";
type SectionKind = "hero" | "oferta" | "prova" | "faq";
type Framework = "AIDA" | "PAS" | "FAB" | "4 Ps" | "Hook-Story-Offer";
type Objective = "Geração de leads" | "Consciência" | "Venda";
type Channel = "Meta (Instagram/Facebook)" | "Google" | "TikTok";
type EmailPurpose = "PURCHASE_CONFIRM" | "ACCESS" | "WELCOME" | "NPS" | "UPSELL" | "REACTIVATION";

type FlowResult =
  | { kind: "ad"; data: StudioAdResult }
  | { kind: "section"; data: string }
  | { kind: "whatsapp"; data: string }
  | { kind: "email"; data: StudioEmailResult }
  | { kind: "landing"; data: StudioFullLandingResult }
  | { kind: "campaign"; data: StudioCampaignResult };

const FRAMEWORKS: Framework[] = ["AIDA", "PAS", "FAB", "4 Ps", "Hook-Story-Offer"];

const SECTIONS: Array<{ value: SectionKind; label: string }> = [
  { value: "hero", label: "Hero" },
  { value: "oferta", label: "Oferta" },
  { value: "prova", label: "Prova social" },
  { value: "faq", label: "FAQ" },
];

const EMAIL_PURPOSES: Array<{ value: EmailPurpose; label: string }> = [
  { value: "PURCHASE_CONFIRM", label: "Confirmação de compra" },
  { value: "ACCESS", label: "Entrega de acesso" },
  { value: "WELCOME", label: "Boas-vindas" },
  { value: "NPS", label: "Pesquisa NPS" },
  { value: "UPSELL", label: "Upsell" },
  { value: "REACTIVATION", label: "Reativação" },
];

const BLOCK_LABELS: Record<string, string> = {
  hero: "Hero",
  pain: "Dores",
  method: "Método",
  proof: "Prova social",
  offer: "Oferta",
  faq: "FAQ",
  "cta-whatsapp": "CTA WhatsApp",
  "signup-form": "Formulário",
};

function priceBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function blockSnippet(block: LandingBlock): string {
  switch (block.kind) {
    case "hero":
      return block.headline;
    case "pain":
      return block.items.join(" · ");
    case "method":
      return block.steps.join(" · ");
    case "proof":
      return block.quotes[0] ?? "";
    case "offer":
      return `${priceBRL(block.priceCents)}${block.guarantee ? ` · ${block.guarantee}` : ""}`;
    case "faq":
      return block.items.map((item) => item.q).join(" · ");
    case "cta-whatsapp":
      return block.text;
    case "signup-form":
      return block.fields.join(" · ");
  }
}

/** Ícone ✦ do botão Gerar e do empty state. */
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6L12 3Z" />
    </svg>
  );
}

/** Fluxo interno do Criar com IA (formulário à esquerda, resultado à direita). */
export function FlowView({ slug, data }: { slug: FlowSlug; data: StudioPageData }) {
  const flow = flowBySlug(slug);
  const router = useRouter();
  const { toast } = useToast();

  const [source, setSource] = useState<ContextSource>("existente");
  const [newContext, setNewContext] = useState("");
  const [productOfferId, setProductOfferId] = useState(data.products[0]?.id ?? "");
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>(
    data.contextFiles.slice(0, 2).map((file) => file.id),
  );

  const [objective, setObjective] = useState<Objective>("Geração de leads");
  const [painDesire, setPainDesire] = useState("");
  const [framework, setFramework] = useState<Framework>("AIDA");
  const [section, setSection] = useState<SectionKind>("hero");
  const [stageId, setStageId] = useState(data.stages[0]?.id ?? "");
  const [purpose, setPurpose] = useState<EmailPurpose>("PURCHASE_CONFIRM");
  const [channel, setChannel] = useState<Channel>("Meta (Instagram/Facebook)");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCredential, setMissingCredential] = useState(!data.hasAi);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [usingIndex, setUsingIndex] = useState<number | null>(null);

  if (!flow) return null;

  const toggleContext = (id: string) => {
    setSelectedContextIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  };

  const base = {
    productOfferId,
    contextFileIds: source === "existente" ? selectedContextIds : [],
    newContext: source === "novo" ? newContext : undefined,
  };

  const generate = async () => {
    if (slug === "landing-completa" && !templateId) {
      setError("Selecionar um template é obrigatório.");
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);

    let response:
      | { ok: boolean; error?: string; missingCredential?: boolean }
      | null = null;

    if (slug === "anuncio") {
      const r = await generateStudioAd({ ...base, objective, painDesire: painDesire || undefined, framework });
      if (r.ok && r.result) setResult({ kind: "ad", data: r.result });
      response = r;
    } else if (slug === "secao-landing") {
      const r = await generateStudioSection({ ...base, section });
      if (r.ok && r.text) setResult({ kind: "section", data: r.text });
      response = r;
    } else if (slug === "whatsapp") {
      const r = await generateStudioWhatsapp({ ...base, stageId });
      if (r.ok && r.text) setResult({ kind: "whatsapp", data: r.text });
      response = r;
    } else if (slug === "email") {
      const r = await generateStudioEmail({ ...base, purpose });
      if (r.ok && r.result) setResult({ kind: "email", data: r.result });
      response = r;
    } else if (slug === "landing-completa") {
      const r = await generateStudioFullLanding({ ...base, templateId: templateId ?? "" });
      if (r.ok && r.result) setResult({ kind: "landing", data: r.result });
      response = r;
    } else {
      const r = await generateStudioCampaign({ ...base, objective, channel });
      if (r.ok && r.result) setResult({ kind: "campaign", data: r.result });
      response = r;
    }

    setGenerating(false);
    if (response && !response.ok) {
      if (response.missingCredential) setMissingCredential(true);
      setError(response.error ?? "A geração falhou. Tente de novo.");
    }
  };

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("Não consegui copiar — selecione o texto e copie manualmente.", "danger");
    }
  };

  const useAdAngle = async (index: number) => {
    if (result?.kind !== "ad") return;
    const angle = result.data.angles[index];
    if (!angle) return;
    setUsingIndex(index);
    const saved = await saveAdToLibraryAction({
      angle: angle.angle,
      hook: angle.hook,
      headline: angle.headline,
      body: angle.body,
      cta: angle.cta,
      scene: "",
      framework,
      channel: "",
      campaignId: null,
    });
    setUsingIndex(null);
    if (saved.ok) toast("Anúncio salvo na biblioteca.", "success");
    else toast(saved.error ?? "Não foi possível salvar o anúncio.", "danger");
  };

  const useLanding = async () => {
    if (result?.kind !== "landing") return;
    setUsingIndex(0);
    const created = await createStudioLanding({
      name: result.data.name,
      productOfferId,
      blocks: result.data.blocks,
    });
    setUsingIndex(null);
    if (created.ok) {
      toast("Landing criada como rascunho.", "success");
      router.push("/landing-pages");
    } else {
      toast(created.error ?? "Não foi possível criar a landing.", "danger");
    }
  };

  const useEmail = async () => {
    if (result?.kind !== "email") return;
    setUsingIndex(0);
    const created = await createStudioEmailTemplate({
      purpose,
      subject: result.data.subject,
      body: result.data.body,
    });
    setUsingIndex(null);
    if (created.ok) toast("Template de e-mail criado como rascunho.", "success");
    else toast(created.error ?? "Não foi possível criar o template.", "danger");
  };

  const useCampaign = async () => {
    if (result?.kind !== "campaign") return;
    setUsingIndex(0);
    const created = await createStudioCampaign({
      name: result.data.name,
      objective: result.data.objective,
      channel: result.data.channel,
      audience: result.data.audience,
      productOfferId,
    });
    setUsingIndex(null);
    if (created.ok) {
      toast("Campanha criada como rascunho.", "success");
      router.push("/campanhas");
    } else {
      toast(created.error ?? "Não foi possível criar a campanha.", "danger");
    }
  };

  const canGenerate =
    !missingCredential &&
    data.products.length > 0 &&
    productOfferId !== "" &&
    (slug !== "landing-completa" || templateId !== null) &&
    (slug !== "whatsapp" || stageId !== "");

  return (
    <>
      <PageHeader
        title="Criar com IA"
        subtitle="Gere copy, landing, campanha e mensagens com o seu contexto"
        actions={
          <Link
            href="/criar#templates"
            className="flex h-9.5 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] pl-4.5 pr-1.5 text-[13px] font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110 active:scale-[.98]"
          >
            Ver templates
            <span className="flex size-6.5 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </Link>
        }
      />

      <div className="p-6">
        <Link
          href="/criar"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors duration-[130ms] hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
          Todos os tipos
        </Link>
        <h2 className="font-display mt-2 text-[22px] font-semibold tracking-tight text-ink">
          {flow.flowTitle}
        </h2>

        <div className="mt-5 grid grid-cols-12 gap-6">
          {/* ── Formulário ─────────────────────────────────────────────── */}
          <div className="col-span-12 flex flex-col gap-4 xl:col-span-5">
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Fonte de contexto</p>
              <Segmented<ContextSource>
                value={source}
                onChange={setSource}
                options={[
                  { value: "existente", label: "Usar existente" },
                  { value: "novo", label: "Criar novo" },
                ]}
              />
            </div>

            {source === "novo" && (
              <Textarea
                label="Contexto novo"
                hint="vira um arquivo de contexto ao gerar"
                placeholder="Cole aqui oferta, objeções, tom de voz…"
                value={newContext}
                onChange={(event) => setNewContext(event.target.value)}
              />
            )}

            <Select
              label="Produto"
              requiredMark
              value={productOfferId}
              onChange={(event) => setProductOfferId(event.target.value)}
              error={data.products.length === 0 ? "Cadastre um produto no Setup para gerar." : undefined}
            >
              {data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {priceBRL(product.priceCents)}
                </option>
              ))}
            </Select>

            {source === "existente" && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Arquivos de contexto</p>
                {data.contextFiles.length === 0 ? (
                  <p className="text-[12px] text-ink-3">
                    Nenhum arquivo indexado — adicione em Contexto ou use &quot;Criar novo&quot;.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.contextFiles.map((file) => {
                      const active = selectedContextIds.includes(file.id);
                      return (
                        <Chip key={file.id} active={active} onClick={() => toggleContext(file.id)}>
                          {file.name}
                          {active ? " ✓" : ""}
                        </Chip>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {slug === "anuncio" && (
              <>
                <Select
                  label="Objetivo"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value as Objective)}
                >
                  <option value="Geração de leads">Geração de leads</option>
                  <option value="Consciência">Consciência</option>
                  <option value="Venda">Venda</option>
                </Select>
                <Input
                  label="Dor ou desejo"
                  placeholder="Falta de tempo do líder"
                  value={painDesire}
                  onChange={(event) => setPainDesire(event.target.value)}
                />
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Framework</p>
                  <div className="flex flex-wrap gap-2">
                    {FRAMEWORKS.map((item) => (
                      <Chip key={item} active={framework === item} onClick={() => setFramework(item)}>
                        {item}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}

            {slug === "secao-landing" && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Seção</p>
                <div className="flex flex-wrap gap-2">
                  {SECTIONS.map((item) => (
                    <Chip
                      key={item.value}
                      active={section === item.value}
                      onClick={() => setSection(item.value)}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {slug === "landing-completa" && (
              <>
                <div className="rounded-xl border border-warm/30 bg-warm/[.08] px-3.5 py-2.5 text-[12px] leading-relaxed text-warm">
                  Selecionar um template é obrigatório. A IA só reformula conteúdo, imagens e cores
                  — mantém a estrutura.
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">
                    Template<span className="ml-0.5 text-accent">*</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {data.templates.map((template, index) => (
                      <TemplateThumb
                        key={template.id}
                        name={template.name}
                        source={template.source}
                        seed={index}
                        selected={templateId === template.id}
                        onClick={() => setTemplateId(template.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setTemplateModalOpen(true)}
                      className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-hairline text-[12.5px] font-medium text-accent transition-all duration-[130ms] hover:border-brand-3/50 hover:bg-brand-soft/40"
                    >
                      + Inserir outro
                    </button>
                  </div>
                </div>
              </>
            )}

            {slug === "whatsapp" && (
              <Select
                label="Estágio"
                hint="a mensagem segue o playbook do estágio"
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
              >
                {data.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            )}

            {slug === "campanha" && (
              <>
                <Select
                  label="Objetivo"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value as Objective)}
                >
                  <option value="Geração de leads">Geração de leads</option>
                  <option value="Consciência">Consciência</option>
                  <option value="Venda">Venda</option>
                </Select>
                <Select
                  label="Canal principal"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as Channel)}
                >
                  <option value="Meta (Instagram/Facebook)">Meta (Instagram/Facebook)</option>
                  <option value="Google">Google</option>
                  <option value="TikTok">TikTok</option>
                </Select>
              </>
            )}

            {slug === "email" && (
              <Select
                label="Tipo de e-mail"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as EmailPurpose)}
              >
                {EMAIL_PURPOSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            )}

            <Button
              variant="primary"
              size="lg"
              loading={generating}
              disabled={!canGenerate}
              onClick={() => void generate()}
              className="w-full"
            >
              <SparkleIcon className="size-4" />
              Gerar
            </Button>

            {missingCredential && (
              <p className="rounded-xl border border-warm/30 bg-warm/[.08] px-3.5 py-2.5 text-[12px] text-warm">
                Configure sua chave da Anthropic em Configurações para usar a IA.
              </p>
            )}
          </div>

          {/* ── Painel de resultado ────────────────────────────────────── */}
          <div className="col-span-12 xl:col-span-7">
            <div
              className={cn(
                "min-h-[420px] rounded-2xl border p-5",
                result ? "border-hairline bg-white/[0.02]" : "border-dashed border-hairline",
              )}
            >
              {generating ? (
                <div className="flex flex-col gap-3" aria-label="Gerando…">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-5/6" />
                  <div className="skeleton h-28 w-full" />
                  <div className="skeleton h-28 w-full" />
                </div>
              ) : error ? (
                <ErrorState message={error} onRetry={() => void generate()} />
              ) : !result ? (
                <div className="flex h-full min-h-[380px] items-center justify-center">
                  <EmptyState
                    className="border-0"
                    icon={<SparkleIcon className="size-6" />}
                    title="Preencha e gere"
                    hint="O resultado usa seu produto e contexto reais."
                  />
                </div>
              ) : (
                <div className="rise-in flex flex-col gap-4">
                  {result.kind === "ad" && (
                    <>
                      <div className="rounded-xl border border-brand-3/30 bg-brand-soft/50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                          Grande ideia
                        </p>
                        <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-ink">
                          {result.data.bigIdea}
                        </p>
                      </div>
                      {result.data.angles.map((angle, index) => (
                        <div key={index} className="rounded-xl border border-hairline bg-white/[0.02] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                              Ângulo {index + 1} · {angle.angle}
                            </p>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={usingIndex === index}
                              onClick={() => void useAdAngle(index)}
                            >
                              Usar
                            </Button>
                          </div>
                          <p className="mt-2 text-[12.5px] italic text-ink-2">{angle.hook}</p>
                          <p className="mt-1.5 text-[14px] font-semibold text-ink">{angle.headline}</p>
                          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                            {angle.body}
                          </p>
                          <p className="mt-2 text-[12.5px] font-semibold text-accent">{angle.cta}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {(result.kind === "section" || result.kind === "whatsapp") && (
                    <div className="rounded-xl border border-hairline bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                          {result.kind === "section" ? "Bloco gerado" : "Mensagem gerada"}
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void copyText(
                              result.data,
                              result.kind === "section"
                                ? "Bloco copiado — cole na sua landing."
                                : "Mensagem copiada.",
                            )
                          }
                        >
                          Usar
                        </Button>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">
                        {result.data}
                      </p>
                    </div>
                  )}

                  {result.kind === "email" && (
                    <div className="rounded-xl border border-hairline bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                          E-mail gerado
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={usingIndex === 0}
                          onClick={() => void useEmail()}
                        >
                          Usar
                        </Button>
                      </div>
                      <p className="mt-3 text-[14px] font-semibold text-ink">
                        {result.data.subject}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                        {result.data.body}
                      </p>
                    </div>
                  )}

                  {result.kind === "landing" && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                            Landing gerada
                          </p>
                          <p className="mt-1 text-[15px] font-semibold text-ink">{result.data.name}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={usingIndex === 0}
                          onClick={() => void useLanding()}
                        >
                          Usar
                        </Button>
                      </div>
                      {result.data.blocks.map((block, index) => (
                        <div key={index} className="rounded-xl border border-hairline bg-white/[0.02] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                            {BLOCK_LABELS[block.kind] ?? block.kind}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">
                            {blockSnippet(block)}
                          </p>
                        </div>
                      ))}
                    </>
                  )}

                  {result.kind === "campaign" && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                            Campanha gerada
                          </p>
                          <p className="mt-1 text-[15px] font-semibold text-ink">{result.data.name}</p>
                          <p className="mt-0.5 text-[12.5px] text-ink-3">
                            {result.data.objective} · {result.data.channel}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={usingIndex === 0}
                          onClick={() => void useCampaign()}
                        >
                          Usar
                        </Button>
                      </div>
                      <div className="rounded-xl border border-brand-3/30 bg-brand-soft/50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                          Grande ideia
                        </p>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
                          {result.data.bigIdea}
                        </p>
                        <p className="mt-2 text-[12.5px] text-ink-2">
                          <span className="font-semibold">Público:</span> {result.data.audience}
                        </p>
                      </div>
                      <div className="rounded-xl border border-hairline bg-white/[0.02] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                          Ângulos
                        </p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {result.data.angles.map((angle, index) => (
                            <li key={index} className="text-[13px] text-ink-2">
                              <span className="font-semibold text-ink">{angle.angle}:</span>{" "}
                              {angle.headline}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-hairline bg-white/[0.02] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                          Landing sugerida
                        </p>
                        <ol className="mt-2 list-inside list-decimal text-[13px] text-ink-2">
                          {result.data.landingOutline.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ol>
                      </div>
                      <div className="rounded-xl border border-hairline bg-white/[0.02] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                          Cadência de follow-up
                        </p>
                        <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
                          {result.data.cadence.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddTemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} />
    </>
  );
}
