"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Chip, EmptyState } from "@/components/ui/misc";
import type { CampaignCardDto, CampaignsPageData, CampaignStatusDto } from "@/server/campaigns/queries";

import { CampaignFormModal } from "./campaign-form-modal";
import { formatMoneyCompact } from "./money";

type Filter = "all" | "active" | "paused" | "draft";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "paused", label: "Pausadas" },
  { value: "draft", label: "Rascunhos" },
];

const FILTER_STATUS: Record<Exclude<Filter, "all">, CampaignStatusDto> = {
  active: "ACTIVE",
  paused: "PAUSED",
  draft: "DRAFT",
};

export function campaignsSubtitle(activeCount: number, avgCplCents: number | null): string {
  const actives = activeCount === 1 ? "1 ativa" : `${activeCount} ativas`;
  const cpl = avgCplCents !== null ? formatMoneyCompact(avgCplCents) : "—";
  return `${actives} · CPL médio ${cpl}`;
}

export function CampaignStatusDot({ status }: { status: CampaignStatusDto }) {
  const config: Record<CampaignStatusDto, { label: string; className: string }> = {
    ACTIVE: { label: "Ativa", className: "text-success" },
    PAUSED: { label: "Pausada", className: "text-warm" },
    DRAFT: { label: "Rascunho", className: "text-ink-3" },
    FINISHED: { label: "Encerrada", className: "text-ink-3" },
  };
  const { label, className } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-medium", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function CampaignTypeBadge({ type }: { type: "STANDARD" | "LAUNCH_LIVE" }) {
  return type === "LAUNCH_LIVE" ? (
    <Badge tone="brand">Lançamento/Live</Badge>
  ) : (
    <Badge tone="info">Padrão</Badge>
  );
}

function Metric({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={cn("tnum truncate text-[17px] font-semibold", accent ? "text-success" : "text-ink")}>
        {value}
      </p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

function CampaignCard({ campaign, index }: { campaign: CampaignCardDto; index: number }) {
  return (
    <Link
      href={`/campanhas/${campaign.id}`}
      className="rise-in block rounded-2xl border border-hairline bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-200 hover:border-brand-3/40"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display truncate text-[15px] font-semibold text-ink">
          {campaign.name}
        </h3>
        <CampaignStatusDot status={campaign.status} />
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <CampaignTypeBadge type={campaign.type} />
        {campaign.channel && <span className="truncate text-xs text-ink-3">{campaign.channel}</span>}
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        <Metric value={String(campaign.leads)} label="leads" />
        <Metric value={String(campaign.conversions)} label="conversões" />
        <Metric
          value={campaign.cplCents !== null ? formatMoneyCompact(campaign.cplCents) : "—"}
          label="CPL"
        />
        <Metric
          value={campaign.revenueCents > 0 ? formatMoneyCompact(campaign.revenueCents) : "—"}
          label="receita"
          accent
        />
      </div>
    </Link>
  );
}

/** Botão pílula "Nova campanha" com seta (CTA do protótipo). */
export function NewCampaignButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" onClick={onClick}>
      Nova campanha
      <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white/20">
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </span>
    </Button>
  );
}

export function CampaignsView({ data }: { data: CampaignsPageData }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(() => {
    if (filter === "all") return data.campaigns;
    return data.campaigns.filter((c) => c.status === FILTER_STATUS[filter]);
  }, [data.campaigns, filter]);

  return (
    <>
      <PageHeader
        title="Campanhas"
        subtitle={campaignsSubtitle(data.header.activeCount, data.header.avgCplCents)}
        actions={<NewCampaignButton onClick={() => setModalOpen(true)} />}
      />

      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={
              filter === "all"
                ? "Nenhuma campanha ainda"
                : `Nenhuma campanha ${filter === "active" ? "ativa" : filter === "paused" ? "pausada" : "em rascunho"}`
            }
            hint={
              filter === "all"
                ? "Crie sua primeira campanha para acompanhar leads, CPL e receita em um só lugar."
                : "Ajuste o filtro acima ou crie uma nova campanha."
            }
            action={
              <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                Nova campanha
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visible.map((campaign, index) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={index} />
            ))}
          </div>
        )}
      </div>

      <CampaignFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        options={data.options}
      />
    </>
  );
}
