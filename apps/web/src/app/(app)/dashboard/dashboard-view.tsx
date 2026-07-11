"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Overline } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { CountUp, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { cobrarLeadAction } from "@/server/dashboard/actions";
import type { DashboardData, FunnelBar } from "@/server/dashboard/queries";

import { AreaChartCard } from "./area-chart";
import { formatBRLShort, formatNum1 } from "./brl";

/* ── Peças compartilhadas ─────────────────────────────────────────────── */

/** Link estilizado como o botão primário (pílula gradiente do protótipo). */
export function PrimaryLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9.5 items-center justify-center gap-2 whitespace-nowrap rounded-full",
        "bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-4.5 text-[13px] font-semibold text-white",
        "shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)]",
        "transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110 active:scale-[.98]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Selo circular com seta ↗ usado nos CTAs primários do protótipo. */
export function ArrowBadge() {
  return (
    <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white/20">
      <svg
        viewBox="0 0 24 24"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </span>
  );
}

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) {
    return (
      <span className="text-[12px] font-semibold text-ink-3" title="Sem base de comparação">
        —
      </span>
    );
  }
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={cn("tnum text-[12px] font-semibold", good ? "text-success" : "text-danger")}>
      {value >= 0 ? "+" : "-"}
      {formatNum1(Math.abs(value))}%
    </span>
  );
}

/** "4 min" · "1 h" · "2 d" (formato curto do protótipo). */
function shortTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/* ── Hero + gargalo ───────────────────────────────────────────────────── */

function HeroCard({ data }: { data: DashboardData }) {
  const isEmpty = data.totalLeads === 0;
  return (
    <Card
      hero
      glow
      className="rise-in relative col-span-12 overflow-hidden p-6 sm:p-7 xl:col-span-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.35),transparent_70%)]"
      />
      <Overline>Sua máquina hoje</Overline>
      <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
        {isEmpty ? "Sua máquina está pronta para rodar" : "Olá, aqui está sua máquina rodando"}
      </h2>
      {isEmpty ? (
        <>
          <p className="mt-2 max-w-md text-sm text-ink-2">
            Ainda não há leads por aqui. Crie seu primeiro lead ou lance uma campanha — a IA cuida
            da conversa do primeiro oi ao fechamento.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PrimaryLink href="/criar">
              Criar com IA
              <ArrowBadge />
            </PrimaryLink>
            <Link
              href="/leads"
              className="inline-flex h-9.5 items-center rounded-full border border-hairline bg-surface-2 px-4.5 text-[13px] font-semibold text-ink transition-colors duration-200 hover:border-brand-3/40 hover:bg-surface-3"
            >
              Criar primeiro lead
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2">
            {data.activeLeads} {data.activeLeads === 1 ? "lead ativo" : "leads ativos"} ·{" "}
            <strong className="tnum font-semibold text-ink">
              {formatBRLShort(data.openValueCents)}
            </strong>{" "}
            em jogo ·{" "}
            <span className="font-medium text-warm">
              {data.waitingCount} aguardando você
            </span>
          </p>
          <div className="mt-5">
            <PrimaryLink href="/pipeline?filtro=aguardando">
              Ver o que precisa de você
              <ArrowBadge />
            </PrimaryLink>
          </div>
        </>
      )}
    </Card>
  );
}

function BottleneckCard({ data }: { data: DashboardData }) {
  const bottleneck = data.bottleneck;
  return (
    <Card className="rise-in col-span-12 flex flex-col xl:col-span-4" style={{ animationDelay: "40ms" }}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
        <span aria-hidden className="size-1.5 rounded-full bg-brand-2" />
        Gargalo do funil · IA
      </p>
      {bottleneck ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            <span className="tnum font-semibold text-danger">{bottleneck.dropPct}%</span> travam
            entre &ldquo;{bottleneck.fromName}&rdquo; e &ldquo;{bottleneck.toName}&rdquo; —{" "}
            {bottleneck.stuckCount === 1
              ? "veja a 1 conversa"
              : `veja as ${bottleneck.stuckCount} conversas`}
            .
          </p>
          <Link
            href={`/pipeline?stage=${bottleneck.stageId}`}
            className="mt-auto inline-flex h-9.5 w-full items-center justify-center rounded-full border border-brand-3/35 bg-brand-soft pt-px text-[13px] font-semibold text-ink transition-colors duration-200 hover:border-brand-3/60 hover:bg-surface-3"
          >
            Resolver agora
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Nenhum gargalo detectado ainda — mova leads pelo funil para a IA analisar as quedas de
            conversão.
          </p>
          <Link
            href="/pipeline"
            className="mt-auto inline-flex h-9.5 w-full items-center justify-center rounded-full border border-hairline bg-surface-2 text-[13px] font-semibold text-ink-2 transition-colors duration-200 hover:border-brand-3/40 hover:text-ink"
          >
            Abrir Pipeline
          </Link>
        </>
      )}
    </Card>
  );
}

/* ── KPIs ─────────────────────────────────────────────────────────────── */

const KPI_ICON_TONES = {
  cold: "bg-cold/[.14] text-cold",
  success: "bg-success/[.14] text-success",
  brand: "bg-brand-soft text-accent",
} as const;

function KpiCard({
  tone,
  delta,
  invertDelta,
  value,
  format,
  label,
  delay,
}: {
  tone: keyof typeof KPI_ICON_TONES;
  delta: number | null;
  invertDelta?: boolean;
  value: number;
  format?: (value: number) => string;
  label: string;
  delay: number;
}) {
  return (
    <Card className="rise-in col-span-12 sm:col-span-6 xl:col-span-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <span
          aria-hidden
          className={cn("flex size-9 items-center justify-center rounded-[10px]", KPI_ICON_TONES[tone])}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[17px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 16 6-6 4 4 8-9" />
            <path d="M15 5h6v6" />
          </svg>
        </span>
        <Delta value={delta} invert={invertDelta} />
      </div>
      <p className="font-display mt-4 text-[28px] font-semibold leading-none tracking-tight text-ink">
        <CountUp value={value} format={format} />
      </p>
      <p className="mt-2 text-[12.5px] text-ink-3">{label}</p>
    </Card>
  );
}

/* ── Funil ────────────────────────────────────────────────────────────── */

function FunnelCard({ funnel }: { funnel: FunnelBar[] }) {
  const max = Math.max(...funnel.map((bar) => bar.count), 1);
  const total = funnel.reduce((sum, bar) => sum + bar.count, 0);
  return (
    <Card className="rise-in col-span-12 xl:col-span-8" style={{ animationDelay: "160ms" }}>
      <CardTitle hint="conversão entre etapas">Funil</CardTitle>
      {total === 0 ? (
        <EmptyState
          className="h-44"
          title="Seu funil ainda está vazio"
          hint="Assim que os primeiros leads entrarem, você acompanha a conversão etapa a etapa aqui."
        />
      ) : (
        <div className="flex h-44 items-end gap-3 pt-2 sm:gap-4">
          {funnel.map((bar) => (
            <div
              key={bar.id}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${bar.name}: ${bar.count} ${bar.count === 1 ? "lead" : "leads"}`}
            >
              <span className="tnum text-[13px] font-semibold text-ink">{bar.count}</span>
              <div
                className="w-full rounded-[10px] bg-[linear-gradient(180deg,#A855F7,#7C3AED)] transition-[height] duration-[440ms] ease-[var(--ease-out)]"
                style={{ height: bar.count === 0 ? "4px" : `${Math.max(8, (bar.count / max) * 82)}%` }}
              />
              <span className="truncate text-[11px] text-ink-3">{bar.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Faixa inferior ───────────────────────────────────────────────────── */

function PendingConversationsCard({ data }: { data: DashboardData }) {
  return (
    <Card className="rise-in col-span-12 md:col-span-6 xl:col-span-4" style={{ animationDelay: "240ms" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Conversas pendentes</h3>
        {data.pendingCount > 0 && (
          <Badge tone="warn">{data.pendingCount} aguardando</Badge>
        )}
      </div>
      {data.pendingConversations.length === 0 ? (
        <EmptyState
          title="Nenhuma conversa pendente"
          hint="A IA está dando conta de todas as conversas por enquanto."
        />
      ) : (
        <div className="-mx-2 flex flex-col">
          {data.pendingConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/inbox?c=${conversation.id}`}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-[130ms] hover:bg-surface-2"
            >
              <Avatar name={conversation.leadName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {conversation.leadName}
                </p>
                <p className="truncate text-xs text-ink-3">{conversation.lastText}</p>
              </div>
              <span suppressHydrationWarning className="shrink-0 text-[11px] text-ink-3">
                {shortTime(conversation.lastAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function CobrarButton({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await cobrarLeadAction(leadId);
      if (result.ok) {
        setSent(true);
        toast("Cobrança enviada pela IA pelo WhatsApp.");
      } else {
        toast(result.error ?? "Não foi possível enviar a cobrança.", "danger");
      }
    });
  };

  return (
    <Button size="sm" variant="secondary" loading={pending} disabled={sent} onClick={handleClick}>
      {sent ? "Cobrada" : "Cobrar"}
    </Button>
  );
}

function FollowupsCard({ data }: { data: DashboardData }) {
  return (
    <Card className="rise-in col-span-12 md:col-span-6 xl:col-span-4" style={{ animationDelay: "280ms" }}>
      <CardTitle>Follow-ups atrasados</CardTitle>
      {data.overdueFollowups.length === 0 ? (
        <EmptyState
          title="Nenhum follow-up atrasado"
          hint="A IA está mantendo todos os leads aquecidos dentro da cadência."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {data.overdueFollowups.map((followup) => (
            <div key={followup.leadId} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{followup.name}</p>
                <p className="truncate text-xs text-danger">
                  sem resposta há {followup.daysSilent} dias
                </p>
              </div>
              <CobrarButton leadId={followup.leadId} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const CAMPAIGN_DOTS = ["bg-success", "bg-cold", "bg-warm"] as const;

function CampaignsCard({ data }: { data: DashboardData }) {
  return (
    <Card className="rise-in col-span-12 md:col-span-6 xl:col-span-4" style={{ animationDelay: "320ms" }}>
      <CardTitle>Campanhas ativas</CardTitle>
      {data.campaigns.length === 0 ? (
        <EmptyState
          title="Nenhuma campanha ativa"
          hint="Lance uma campanha para encher o funil de leads."
          action={
            <Link href="/campanhas" className="text-[12.5px] font-semibold text-accent hover:underline">
              Criar campanha →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-1">
          {data.campaigns.map((campaign, index) => (
            <Link
              key={campaign.id}
              href="/campanhas"
              className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors duration-[130ms] hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    CAMPAIGN_DOTS[index % CAMPAIGN_DOTS.length],
                  )}
                />
                <span className="truncate text-[13px] font-medium text-ink">{campaign.name}</span>
              </span>
              <span className="tnum shrink-0 text-xs text-ink-3">
                {campaign.paused
                  ? "pausada"
                  : `${campaign.leads} ${campaign.leads === 1 ? "lead" : "leads"}`}
              </span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-4 mb-2 border-t border-hairline-soft pt-3 text-[12px] font-semibold text-ink">
        Landing pages publicadas
      </p>
      {data.landings.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">
          Nenhuma landing page ainda —{" "}
          <Link href="/landing-pages" className="font-semibold text-accent hover:underline">
            crie a primeira
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {data.landings.map((landing) => (
            <Link
              key={landing.id}
              href="/landing-pages"
              className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors duration-[130ms] hover:bg-surface-2"
            >
              <span className="truncate text-[13px] font-medium text-ink">{landing.name}</span>
              {landing.published ? (
                <span className="tnum shrink-0 text-xs text-success">
                  Publicada
                  {landing.convPct !== null ? ` · ${formatNum1(landing.convPct)}% conv.` : ""}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-ink-3">Rascunho</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── View ─────────────────────────────────────────────────────────────── */

export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-12 gap-4 p-6">
      <HeroCard data={data} />
      <BottleneckCard data={data} />

      <KpiCard
        tone="cold"
        delta={data.kpis.leadsDeltaPct}
        value={data.activeLeads}
        label="Leads ativos"
        delay={80}
      />
      <KpiCard
        tone="success"
        delta={data.kpis.revenueDeltaPct}
        value={data.kpis.monthRevenueCents}
        format={(value) => formatBRLShort(value)}
        label="Receita do mês"
        delay={120}
      />
      <KpiCard
        tone="brand"
        delta={data.kpis.conversionDeltaPp}
        value={data.kpis.conversionPct}
        format={(value) => `${formatNum1(value)}%`}
        label="Taxa de conversão"
        delay={160}
      />

      <FunnelCard funnel={data.funnel} />
      <AreaChartCard
        revenue={data.revenueSeries}
        expenses={data.expenseSeries}
        className="rise-in col-span-12 xl:col-span-4"
      />

      <PendingConversationsCard data={data} />
      <FollowupsCard data={data} />
      <CampaignsCard data={data} />
    </div>
  );
}
