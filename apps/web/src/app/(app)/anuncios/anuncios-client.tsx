"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Overline } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Chip, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatBRL } from "@/lib/format";
import {
  archiveAdAction,
  createSwipeReferenceAction,
  generateAdsAction,
  linkAdToCampaignAction,
  saveAdToLibraryAction,
  type AdGeneration,
  type GeneratedAngle,
} from "@/server/ads/actions";

/** Anúncios & Tráfego: Gerador | Onde achar criativos | Biblioteca | Sugestões. */

export interface AdLibraryItem {
  id: string;
  headline: string;
  hook: string | null;
  channel: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  campaignId: string | null;
  campaignName: string | null;
  ctr: number | null;
  cplCents: number | null;
}

export interface SwipeItem {
  id: string;
  title: string;
  link: string | null;
  hook: string | null;
  niche: string | null;
  cta: string | null;
  learning: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  priceCents: number;
}

interface CampaignOption {
  id: string;
  name: string;
}

type TabKey = "gerador" | "onde-achar" | "biblioteca" | "sugestoes";

const OBJECTIVES = ["Geração de leads", "Consciência", "Venda"] as const;
const CHANNELS = ["Meta (Instagram/Facebook)", "Google", "TikTok"] as const;
const FRAMEWORKS = ["AIDA", "PAS", "FAB", "4 Ps", "Hook-Story-Offer"] as const;

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

export function AnunciosClient({
  products,
  libraryAds,
  swipes,
  campaigns,
  aiOk,
  higgsfieldOk,
  campaignParam,
}: {
  products: ProductOption[];
  libraryAds: AdLibraryItem[];
  swipes: SwipeItem[];
  campaigns: CampaignOption[];
  aiOk: boolean;
  higgsfieldOk: boolean;
  campaignParam: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("gerador");

  // Formulário do gerador
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [objective, setObjective] = useState<(typeof OBJECTIVES)[number]>("Geração de leads");
  const [painDesire, setPainDesire] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Meta (Instagram/Facebook)");
  const [framework, setFramework] = useState<(typeof FRAMEWORKS)[number]>("AIDA");
  const [generating, setGenerating] = useState(false);
  const [generation, setGeneration] = useState<AdGeneration | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const generate = async () => {
    if (generating) return;
    setTab("gerador");
    if (!aiOk) {
      toast("Configure sua chave da Anthropic em Configurações para usar a IA.", "danger");
      return;
    }
    if (!productId) {
      toast("Cadastre um produto antes de gerar anúncios.", "danger");
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    const result = await generateAdsAction({
      productOfferId: productId,
      objective,
      painDesire: painDesire || undefined,
      channel,
      framework,
    });
    setGenerating(false);
    if (!result.ok || !result.generation) {
      setGenerationError(result.error ?? "A geração falhou. Tente de novo.");
      toast(result.error ?? "A geração falhou.", "danger");
      return;
    }
    setGeneration(result.generation);
    toast("A Grande Ideia + 3 ângulos gerados.");
  };

  const generateCreative = () => {
    if (higgsfieldOk) {
      toast("Geração de criativo em breve.");
      return;
    }
    toast("Configure a credencial Higgsfield para gerar criativos.");
    router.push("/configuracoes");
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Anúncios & Tráfego"
        subtitle="Gerador de criativos com IA"
        actions={
          <Button variant="primary" loading={generating} onClick={() => void generate()}>
            Gerar anúncios
          </Button>
        }
      />

      <div className="flex-1 space-y-5 p-6">
        <Tabs<TabKey>
          tabs={[
            { value: "gerador", label: "Gerador" },
            { value: "onde-achar", label: "Onde achar criativos" },
            { value: "biblioteca", label: "Biblioteca" },
            { value: "sugestoes", label: "Sugestões de tráfego" },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "gerador" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
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
                value={objective}
                onChange={(event) => setObjective(event.target.value as (typeof OBJECTIVES)[number])}
              >
                {OBJECTIVES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>

              <Input
                label="Dor ou desejo central"
                placeholder="Falta de tempo do líder"
                value={painDesire}
                onChange={(event) => setPainDesire(event.target.value)}
              />

              <Select
                label="Canal"
                requiredMark
                value={channel}
                onChange={(event) => setChannel(event.target.value as (typeof CHANNELS)[number])}
              >
                {CHANNELS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>

              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Framework de copy</p>
                <div className="flex flex-wrap gap-2">
                  {FRAMEWORKS.map((option) => (
                    <Chip key={option} active={framework === option} onClick={() => setFramework(option)}>
                      {option}
                    </Chip>
                  ))}
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full" loading={generating}>
                <SparkIcon className="size-4" />
                Gerar anúncios
              </Button>
            </form>

            <GeneratorPanel
              aiOk={aiOk}
              generating={generating}
              generation={generation}
              error={generationError}
              framework={framework}
              channel={channel}
              campaignParam={campaignParam}
              onGenerateCreative={generateCreative}
            />
          </div>
        )}

        {tab === "onde-achar" && <WhereToFindTab swipes={swipes} />}

        {tab === "biblioteca" && <LibraryTab ads={libraryAds} campaigns={campaigns} />}

        {tab === "sugestoes" && <TrafficSuggestionsTab />}
      </div>
    </div>
  );
}

// ── Gerador: painel de resultado ─────────────────────────────────────────────

function GeneratorPanel({
  aiOk,
  generating,
  generation,
  error,
  framework,
  channel,
  campaignParam,
  onGenerateCreative,
}: {
  aiOk: boolean;
  generating: boolean;
  generation: AdGeneration | null;
  error: string | null;
  framework: string;
  channel: string;
  campaignParam: string | null;
  onGenerateCreative: () => void;
}) {
  const router = useRouter();

  if (!aiOk) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-accent">
          <SparkIcon className="size-5" />
        </span>
        <p className="text-sm font-semibold text-ink">Configure sua chave da Anthropic</p>
        <p className="max-w-sm text-[12.5px] text-ink-3">
          O gerador usa a IA do seu workspace. Cadastre a chave em Configurações para criar a
          Grande Ideia e os 3 ângulos.
        </p>
        <Button variant="secondary" onClick={() => router.push("/configuracoes")}>
          Configurar IA
        </Button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton h-44" />
        ))}
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-accent">
          <SparkIcon className="size-5" />
        </span>
        <p className="text-sm font-semibold text-ink">A grande ideia primeiro</p>
        <p className="max-w-sm text-[12.5px] text-ink-3">
          A IA cria 1 conceito central no espírito da boa publicidade + 3 ângulos com hook,
          headline, corpo e cena.
        </p>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card glow className="rise-in border-brand-3/40">
        <Overline>A grande ideia</Overline>
        <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-ink">
          {generation.bigIdea.statement}
        </p>
        {generation.bigIdea.rationale && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            {generation.bigIdea.rationale}
          </p>
        )}
      </Card>

      {generation.angles.map((angle, index) => (
        <AngleCard
          key={index}
          angle={angle}
          index={index}
          framework={framework}
          channel={channel}
          campaignParam={campaignParam}
          onGenerateCreative={onGenerateCreative}
        />
      ))}
    </div>
  );
}

function AngleCard({
  angle,
  index,
  framework,
  channel,
  campaignParam,
  onGenerateCreative,
}: {
  angle: GeneratedAngle;
  index: number;
  framework: string;
  channel: string;
  campaignParam: string | null;
  onGenerateCreative: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    const text = [angle.hook, angle.headline, angle.body, angle.cta].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Anúncio copiado.");
    } catch {
      toast("Não foi possível copiar.", "danger");
    }
  };

  const save = async () => {
    setSaving(true);
    const result = await saveAdToLibraryAction({
      angle: angle.angle,
      hook: angle.hook,
      headline: angle.headline,
      body: angle.body,
      cta: angle.cta,
      scene: angle.scene || undefined,
      framework,
      channel,
      campaignId: campaignParam,
    });
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível salvar.", "danger");
      return;
    }
    setSaved(true);
    toast("Salvo na biblioteca.");
  };

  return (
    <Card className="rise-in space-y-3" style={{ animationDelay: `${(index + 1) * 40}ms` }}>
      <p className="text-[12px] text-ink-3">Ângulo: {angle.angle}</p>
      <div>
        <Overline className="text-[10px]">Hook</Overline>
        <p className="mt-1 text-[14.5px] font-semibold text-ink">{angle.hook}</p>
      </div>
      <p className="text-[14px] font-semibold text-ink">{angle.headline}</p>
      <p className="text-[13px] leading-relaxed text-ink-2">{angle.body}</p>
      {angle.scene && <p className="text-[12.5px] italic text-ink-3">Cena: {angle.scene}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {angle.cta ? (
          <span className="rounded-full border border-brand-3/30 bg-brand-soft px-3.5 py-1.5 text-[12px] font-medium text-ink">
            {angle.cta}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void copy()}>
            Copiar
          </Button>
          <Button size="sm" variant="secondary" loading={saving} disabled={saved} onClick={() => void save()}>
            {saved ? "Salvo ✓" : "Salvar na biblioteca"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="border-brand-3/40 text-accent"
            onClick={onGenerateCreative}
          >
            Gerar criativo
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Onde achar criativos ─────────────────────────────────────────────────────

const EXTERNAL_SOURCES = [
  {
    title: "Meta Ad Library",
    description: "Espie anúncios ativos de concorrentes.",
    href: "https://www.facebook.com/ads/library",
  },
  {
    title: "TikTok Creative Center",
    description: "Top Ads por nicho e região + tendências.",
    href: "https://ads.tiktok.com/business/creativecenter",
  },
  {
    title: "Pinterest Trends",
    description: "O que está subindo em busca visual.",
    href: "https://trends.pinterest.com",
  },
] as const;

function countChips(swipes: SwipeItem[], key: "hook" | "niche" | "cta", prefix: string): string[] {
  const counts = new Map<string, number>();
  for (const swipe of swipes) {
    const value = swipe[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([value, count]) => `${prefix}: ${value} (${count})`);
}

function WhereToFindTab({ swipes }: { swipes: SwipeItem[] }) {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const chips = [
    ...countChips(swipes, "hook", "Hook"),
    ...countChips(swipes, "niche", "Nicho"),
    ...countChips(swipes, "cta", "CTA"),
  ];

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-[13px] leading-relaxed text-ink-2">
        Onde achar referências que já vendem: anúncio rodando há semanas costuma ser um
        vencedor. Estude o raciocínio, não copie o texto.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {EXTERNAL_SOURCES.map((source) => (
          <a
            key={source.title}
            href={source.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-hairline bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-200 hover:border-brand-3/40"
          >
            <h3 className="text-sm font-semibold text-ink">{source.title} ↗</h3>
            <p className="mt-1 text-[12.5px] text-ink-3">{source.description}</p>
          </a>
        ))}
      </div>

      <Card className="border-brand-3/25">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Cofre de anúncios vencedores</h3>
            <p className="mt-1 text-[12.5px] text-ink-3">
              Seu swipe file — organiza por hook, nicho e CTA. Alimenta a IA ao gerar.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="border-brand-3/40 text-accent"
            onClick={() => setModalOpen(true)}
          >
            + Salvar referência
          </Button>
        </div>

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[11.5px] text-ink-2"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {swipes.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Cofre vazio"
            hint="Salve a primeira referência vencedora — a IA usa o cofre como contexto ao gerar."
          />
        ) : (
          <ul className="mt-4 divide-y divide-[rgba(255,255,255,0.05)]">
            {swipes.map((swipe) => (
              <li key={swipe.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                {swipe.link ? (
                  <a
                    href={swipe.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-medium text-accent hover:underline"
                  >
                    {swipe.title} ↗
                  </a>
                ) : (
                  <span className="text-[13px] font-medium text-ink">{swipe.title}</span>
                )}
                <span className="text-[11.5px] text-ink-3">
                  {[
                    swipe.hook && `hook: ${swipe.hook}`,
                    swipe.niche && `nicho: ${swipe.niche}`,
                    swipe.cta && `CTA: ${swipe.cta}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SwipeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          toast("Referência salva no cofre.");
        }}
      />
    </div>
  );
}

function SwipeModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [hook, setHook] = useState("");
  const [niche, setNiche] = useState("");
  const [cta, setCta] = useState("");
  const [learning, setLearning] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await createSwipeReferenceAction({
      title,
      link: link || undefined,
      hook: hook || undefined,
      niche: niche || undefined,
      cta: cta || undefined,
      learning: learning || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível salvar a referência.");
      return;
    }
    setTitle("");
    setLink("");
    setHook("");
    setNiche("");
    setCta("");
    setLearning("");
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Salvar referência"
      subtitle="Anúncio vencedor para o seu swipe file — alimenta a IA ao gerar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Input
          label="Título"
          requiredMark
          placeholder='Ex.: "Liderar virou outra coisa" — Meta'
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          label="Link"
          type="url"
          placeholder="https://www.facebook.com/ads/library/…"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Hook"
            placeholder="pergunta provocativa"
            value={hook}
            onChange={(event) => setHook(event.target.value)}
          />
          <Input
            label="Nicho"
            placeholder="liderança"
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
          />
        </div>
        <Input
          label="CTA"
          placeholder="urgência"
          value={cta}
          onChange={(event) => setCta(event.target.value)}
        />
        <Textarea
          label="Aprendizado"
          className="min-h-20"
          placeholder="Por que esse anúncio funciona? O que dá pra reaproveitar?"
          value={learning}
          onChange={(event) => setLearning(event.target.value)}
        />
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Biblioteca ───────────────────────────────────────────────────────────────

function LibraryTab({ ads, campaigns }: { ads: AdLibraryItem[]; campaigns: CampaignOption[] }) {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const link = async (adId: string, campaignId: string | null) => {
    setBusyId(adId);
    const result = await linkAdToCampaignAction(adId, campaignId);
    setBusyId(null);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível vincular.", "danger");
      return;
    }
    toast(campaignId ? "Criativo vinculado à campanha." : "Criativo desvinculado.");
  };

  const archive = async (adId: string) => {
    setBusyId(adId);
    const result = await archiveAdAction(adId);
    setBusyId(null);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível arquivar.", "danger");
      return;
    }
    toast("Criativo arquivado.");
  };

  if (ads.length === 0) {
    return (
      <EmptyState
        title="Biblioteca vazia"
        hint='Gere anúncios na aba Gerador e use "Salvar na biblioteca" para guardar os melhores.'
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {ads.map((ad, index) => (
        <Card key={ad.id} className="rise-in space-y-3" style={{ animationDelay: `${index * 40}ms` }}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink">{ad.hook || ad.headline}</h3>
            {ad.status === "DRAFT" && <Badge tone="muted">rascunho</Badge>}
            {ad.status === "ACTIVE" && <Badge tone="success" dot>Ativo</Badge>}
            {ad.status === "PAUSED" && <Badge tone="warn" dot>Pausado</Badge>}
          </div>
          <p className="text-[12.5px] text-ink-3">
            {ad.channel ?? "—"} ·{" "}
            {ad.campaignName ? (
              <>
                vinculado a <span className="text-ink-2">&quot;{ad.campaignName}&quot;</span>
              </>
            ) : (
              "não vinculado"
            )}
          </p>
          {(ad.ctr !== null || ad.cplCents !== null) && (
            <p className="tnum flex gap-4 text-[12px] text-ink-2">
              {ad.ctr !== null && (
                <span>CTR {ad.ctr.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
              )}
              {ad.cplCents !== null && <span>CPL {formatBRL(ad.cplCents)}</span>}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1">
              <Select
                aria-label={`Vincular "${ad.headline}" a uma campanha`}
                value={ad.campaignId ?? ""}
                disabled={busyId === ad.id}
                className="py-1.5 text-[12px]"
                onChange={(event) => void link(ad.id, event.target.value || null)}
              >
                <option value="">Sem campanha</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              variant="ghost"
              loading={busyId === ad.id}
              onClick={() => void archive(ad.id)}
            >
              Arquivar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Sugestões de tráfego ─────────────────────────────────────────────────────

const TRAFFIC_SUGGESTIONS = [
  {
    title: "Líderes 30-45 · Meta",
    description: "Cargos de gestão, interesse em produtividade. Verba sugerida R$ 80/dia.",
  },
  {
    title: 'Busca Google · "curso liderança IA"',
    description: "Intenção alta. Verba sugerida R$ 50/dia. Configure conversão de WhatsApp.",
  },
] as const;

function TrafficSuggestionsTab() {
  const router = useRouter();
  const { toast } = useToast();

  const useInCampaign = () => {
    toast("Crie a campanha com este público e verba — abrindo Campanhas.");
    router.push("/campanhas");
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {TRAFFIC_SUGGESTIONS.map((suggestion) => (
        <Card key={suggestion.title} className="space-y-3">
          <h3 className="text-[14px] font-semibold text-ink">{suggestion.title}</h3>
          <p className="text-[12.5px] text-ink-2">{suggestion.description}</p>
          <Button
            size="sm"
            variant="secondary"
            className={cn("border-brand-3/40 text-accent")}
            onClick={useInCampaign}
          >
            Usar na campanha
          </Button>
        </Card>
      ))}
    </div>
  );
}
