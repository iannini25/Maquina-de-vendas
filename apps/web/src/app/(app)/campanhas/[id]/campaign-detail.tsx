"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Overline } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { CountUp, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDateTimeBR } from "@/lib/format";
import { generateCampaignSuggestion, toggleCampaignStatus } from "@/server/campaigns/actions";
import type {
  CampaignDetailDto,
  CampaignFormOptions,
  CampaignsHeaderStats,
} from "@/server/campaigns/queries";

import { AreaChart } from "../area-chart";
import { CampaignFormModal } from "../campaign-form-modal";
import {
  campaignsSubtitle,
  CampaignStatusDot,
  CampaignTypeBadge,
  NewCampaignButton,
} from "../campaigns-view";
import { formatMoneyCompact, formatMultiplier, formatPercentFraction } from "../money";

type DetailTab = "overview" | "ads" | "leads" | "automation" | "landing";

const TABS: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "Visão geral" },
  { value: "ads", label: "Anúncios" },
  { value: "leads", label: "Leads" },
  { value: "automation", label: "Automação" },
  { value: "landing", label: "Landing" },
];

function AiStatusText({ status }: { status: "RUNNING" | "WAITING_HUMAN" | "PAUSED" }) {
  if (status === "RUNNING") return <span className="font-medium text-accent">IA cuidando</span>;
  if (status === "WAITING_HUMAN")
    return <span className="font-medium text-warm">Aguardando você</span>;
  return <span className="text-ink-3">Pausado</span>;
}

function KpiCard({
  value,
  label,
  accent,
}: {
  value: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <Card className="py-4">
      <p className={cn("font-display tnum text-[22px] font-semibold", accent ? "text-success" : "text-ink")}>
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-ink-3">{label}</p>
    </Card>
  );
}

export function CampaignDetail({
  detail,
  header,
  options,
  hasAi,
}: {
  detail: CampaignDetailDto;
  header: CampaignsHeaderStats;
  options: CampaignFormOptions;
  hasAi: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<DetailTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [suggestion, setSuggestion] = useState(detail.suggestion);
  const [generating, setGenerating] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const subtitleParts = [
    detail.channel,
    detail.productName,
    detail.landing ? `usa a LP "${detail.landing.name}"` : null,
  ].filter(Boolean);

  const landingUrl = detail.landing
    ? (detail.landing.externalUrl ?? `https://sales4u.io/${detail.landing.slug}`)
    : null;

  const revenueValues = detail.revenueSeries.map((p) => p.cumulativeCents);
  const hasRevenue = revenueValues.some((v) => v > 0);

  async function handleToggleStatus() {
    setToggling(true);
    const result = await toggleCampaignStatus(detail.id);
    setToggling(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível alterar o status.", "danger");
      return;
    }
    toast(result.status === "PAUSED" ? "Campanha pausada." : "Campanha reativada.");
  }

  async function handleGenerateSuggestion() {
    setGenerating(true);
    setSuggestionError(null);
    const result = await generateCampaignSuggestion(detail.id);
    setGenerating(false);
    if (result.ok && result.text) {
      setSuggestion(result.text);
      return;
    }
    setSuggestionError(result.error ?? "Não foi possível gerar a sugestão agora.");
  }

  async function handleCopyLandingLink() {
    if (!landingUrl) return;
    try {
      await navigator.clipboard.writeText(landingUrl);
      toast("Link copiado — disponível para o SDR e campanhas.");
    } catch {
      toast("Não foi possível copiar o link.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Campanhas"
        subtitle={campaignsSubtitle(header.activeCount, header.avgCplCents)}
        actions={<NewCampaignButton onClick={() => setCreateOpen(true)} />}
      />

      <div className="flex flex-col gap-5 p-6">
        <Link
          href="/campanhas"
          className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors duration-[130ms] hover:text-ink-2"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
          Voltar para campanhas
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
                {detail.name}
              </h1>
              <CampaignTypeBadge type={detail.type} />
              <CampaignStatusDot status={detail.status} />
            </div>
            {subtitleParts.length > 0 && (
              <p className="mt-1 text-[12.5px] text-ink-3">{subtitleParts.join(" · ")}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Editar
            </Button>
            <Button variant="secondary" onClick={handleToggleStatus} loading={toggling}>
              {detail.status === "ACTIVE"
                ? "Pausar"
                : detail.status === "PAUSED"
                  ? "Reativar"
                  : "Ativar"}
            </Button>
          </div>
        </div>

        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard value={<CountUp value={detail.kpis.leads} />} label="leads" />
              <KpiCard value={<CountUp value={detail.kpis.conversions} />} label="conversões" />
              <KpiCard
                value={
                  detail.kpis.cplCents !== null ? (
                    <CountUp
                      value={detail.kpis.cplCents}
                      format={(v) => formatMoneyCompact(Math.round(v))}
                    />
                  ) : (
                    "—"
                  )
                }
                label="CPL"
              />
              <KpiCard
                value={detail.kpis.roas !== null ? formatMultiplier(detail.kpis.roas) : "—"}
                label="ROAS"
                accent={detail.kpis.roas !== null}
              />
            </div>

            <Card>
              <CardTitle>Receita da campanha</CardTitle>
              {hasRevenue ? (
                <AreaChart
                  values={revenueValues}
                  ariaLabel={`Receita acumulada da campanha ${detail.name} por dia`}
                />
              ) : (
                <div className="flex h-44 items-center justify-center text-[12.5px] text-ink-3">
                  Sem receita registrada nesta campanha ainda — as vendas de leads da campanha
                  aparecem aqui.
                </div>
              )}
            </Card>

            <Card className="border-brand-3/30 bg-[linear-gradient(140deg,rgba(124,58,237,0.10),rgba(13,13,19,0.4))]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-brand-2" />
                  <div className="min-w-0">
                    <Overline>Sugestões da IA</Overline>
                    {hasAi ? (
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
                        {suggestion ??
                          "Nenhuma sugestão gerada ainda — clique em “Gerar sugestão” para a IA analisar as métricas reais desta campanha."}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                        Configure sua chave da Anthropic em Configurações para a IA analisar esta
                        campanha e sugerir melhorias.
                      </p>
                    )}
                    {suggestionError && (
                      <p role="alert" className="mt-1.5 text-xs text-danger">
                        {suggestionError}
                      </p>
                    )}
                  </div>
                </div>
                {hasAi ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateSuggestion}
                    loading={generating}
                  >
                    {suggestion ? "Gerar nova sugestão" : "Gerar sugestão"}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => router.push("/configuracoes")}>
                    Ir para Configurações
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "ads" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => router.push(`/anuncios?campaign=${detail.id}`)}>
                Gerar anúncios
              </Button>
            </div>
            {detail.ads.length === 0 ? (
              <EmptyState
                title="Nenhum anúncio nesta campanha"
                hint="Gere criativos com IA e vincule à campanha para acompanhar CTR e CPL aqui."
                action={
                  <Button variant="primary" size="sm" onClick={() => router.push(`/anuncios?campaign=${detail.id}`)}>
                    Gerar anúncios
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {detail.ads.map((ad, index) => (
                  <Card key={ad.id} className="rise-in" style={{ animationDelay: `${index * 40}ms` }}>
                    <h3 className="text-sm font-semibold text-ink">{ad.title}</h3>
                    <p className="mt-1 text-xs text-ink-3">
                      {[ad.angle, ad.channel].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="tnum mt-3 flex items-center gap-5 text-[12.5px] text-ink-2">
                      <span>CTR {ad.ctr !== null ? formatPercentFraction(ad.ctr) : "—"}</span>
                      <span>CPL {ad.cplCents !== null ? formatMoneyCompact(ad.cplCents) : "—"}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "leads" && (
          <>
            {detail.leadRows.length === 0 ? (
              <EmptyState
                title="Nenhum lead nesta campanha"
                hint="Leads captados pela landing page ou anúncios desta campanha aparecem aqui."
              />
            ) : (
              <Table>
                <THead>
                  <TH>Lead</TH>
                  <TH>Estágio</TH>
                  <TH>Valor</TH>
                  <TH>Status IA</TH>
                </THead>
                <TBody>
                  {detail.leadRows.map((lead) => (
                    <TR key={lead.id} onClick={() => router.push("/pipeline")}>
                      <TD className="font-medium text-ink">{lead.name}</TD>
                      <TD>{lead.stageName}</TD>
                      <TD className="tnum font-medium text-ink">
                        {lead.valueCents !== null ? formatMoneyCompact(lead.valueCents) : "—"}
                      </TD>
                      <TD>
                        <AiStatusText status={lead.aiStatus} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </>
        )}

        {tab === "automation" && (
          <Card>
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              A cadência da IA para leads desta campanha segue o playbook de cada estágio do
              Pipeline.
            </p>
            {detail.type === "LAUNCH_LIVE" && (
              <div className="mt-4 border-t border-hairline-soft pt-4">
                <p className="text-[13px] font-semibold text-ink">
                  Sequência de aquecimento da live
                </p>
                {detail.reminders.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-ink-3">
                    Defina a data da live em “Editar” para agendar os lembretes automáticos.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {detail.reminders.map((reminder) => (
                      <li key={reminder.stage} className="flex flex-wrap items-center gap-2.5">
                        <span aria-hidden className="size-1.5 rounded-full bg-brand-2" />
                        <span className="text-[13px] text-ink-2">{reminder.label}</span>
                        <span className="tnum text-[12px] text-ink-3">
                          {formatDateTimeBR(reminder.atIso)}
                        </span>
                        {!detail.remindersEnabled ? (
                          <Badge tone="muted">Desativado</Badge>
                        ) : reminder.past ? (
                          <Badge tone="muted">Concluído</Badge>
                        ) : (
                          <Badge tone="brand">Agendado</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {detail.reminders.length > 0 && !detail.remindersEnabled && (
                  <p className="mt-3 text-[12px] text-ink-3">
                    Lembretes desativados nesta campanha — ative em “Editar”.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {tab === "landing" && (
          <>
            {detail.landing ? (
              <Card>
                <h3 className="text-sm font-semibold text-ink">{detail.landing.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="text-[13px] font-medium text-accent">
                    {landingUrl?.replace(/^https?:\/\//, "")}
                  </span>
                  <Button variant="secondary" size="sm" onClick={handleCopyLandingLink}>
                    Copiar link
                  </Button>
                </div>
                <p className="mt-3 text-[12px] text-ink-3">
                  É este link que a IA e os anúncios usam para vender.
                </p>
              </Card>
            ) : (
              <EmptyState
                title="Nenhuma landing vinculada"
                hint="Vincule uma landing page para a IA e os anúncios terem um link de venda."
                action={
                  <Button variant="primary" size="sm" onClick={() => setEditOpen(true)}>
                    Editar campanha
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>

      <CampaignFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        options={options}
        initial={{
          id: detail.id,
          name: detail.name,
          type: detail.type,
          productOfferId: detail.productOfferId,
          objective: detail.objective,
          channel: detail.channel,
          landingPageId: detail.landing?.id ?? null,
          budgetCents: detail.budgetCents,
          cplTargetCents: detail.cplTargetCents,
          liveAtIso: detail.liveAtIso,
          warmupEnabled: detail.warmupEnabled,
          remindersEnabled: detail.remindersEnabled,
        }}
      />
      <CampaignFormModal open={createOpen} onClose={() => setCreateOpen(false)} options={options} />
    </>
  );
}
