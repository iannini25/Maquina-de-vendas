"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { LeadDetail } from "@/components/lead/lead-detail";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { AiStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { CountUp, EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useSse } from "@/lib/use-sse";
import type { LeadRowDto, LeadsStatsDto, TemperatureDto } from "@/server/pipeline/types";

type SortKey = "name" | "score";
type SortDir = "asc" | "desc";

const TEMP_TEXT: Record<TemperatureDto, { label: string; className: string }> = {
  HOT: { label: "Quente", className: "text-hot" },
  WARM: { label: "Morno", className: "text-warm" },
  COLD: { label: "Frio", className: "text-cold" },
};

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordenar por ${label}`}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-[0.1em] transition-colors duration-[130ms]",
        active ? "text-ink-2" : "hover:text-ink-2",
      )}
    >
      {label}
      <span aria-hidden>{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

/** Espelho do Pipeline em lista (visão de leitura). */
export function LeadsClient({ rows, stats }: { rows: LeadRowDto[]; stats: LeadsStatsDto }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);

  useSse(["pipeline"], () => router.refresh());

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) =>
      sortKey === "name"
        ? a.name.localeCompare(b.name, "pt-BR") * factor
        : (a.score - b.score) * factor,
    );
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "score" ? "desc" : "asc");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Leads"
        subtitle="Visão de leitura · espelho do Pipeline"
        actions={
          <Button variant="primary" onClick={() => router.push("/pipeline")}>
            Abrir Pipeline
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {/* Banner informativo */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-cold/30 bg-cold/[.08] px-4 py-3">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="mt-0.5 size-4 shrink-0 text-cold"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M12 11v5" />
          </svg>
          <p className="text-[12.5px] leading-relaxed text-cold">
            Esta é uma cópia do Pipeline, só para visualizar todos os leads em lista. Para agir
            (mover estágio, conversar, configurar IA), use o Pipeline.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(
            [
              { value: stats.total, label: "total de leads", className: "text-ink" },
              { value: stats.novos, label: "novos", className: "text-ink" },
              { value: stats.emNegociacao, label: "em negociação", className: "text-ink" },
              { value: stats.quentes, label: "quentes", className: "text-hot" },
            ] as const
          ).map((stat, index) => (
            <div
              key={stat.label}
              className="rise-in rounded-2xl border border-hairline bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <p className={cn("font-display text-2xl font-bold", stat.className)}>
                <CountUp value={stat.value} />
              </p>
              <p className="mt-0.5 text-[12px] text-ink-3">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabela */}
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum lead ainda"
            hint="Crie o primeiro lead no Pipeline ou importe uma lista CSV — tudo que entrar aparece aqui em lista."
            action={
              <Button variant="primary" size="sm" onClick={() => router.push("/pipeline")}>
                Abrir Pipeline
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>
                <SortButton
                  label="Nome"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
              </TH>
              <TH>Estágio</TH>
              <TH>Temp.</TH>
              <TH>Canal</TH>
              <TH>
                <SortButton
                  label="Score"
                  active={sortKey === "score"}
                  dir={sortDir}
                  onClick={() => toggleSort("score")}
                />
              </TH>
              <TH>Status IA</TH>
            </THead>
            <TBody>
              {sorted.map((lead) => (
                <TR key={lead.id} onClick={() => setDetailLeadId(lead.id)}>
                  <TD>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={lead.name} size="sm" />
                      <span className="font-semibold text-ink">{lead.name}</span>
                    </span>
                  </TD>
                  <TD>{lead.stageName}</TD>
                  <TD>
                    <span className={cn("font-medium", TEMP_TEXT[lead.temperature].className)}>
                      {TEMP_TEXT[lead.temperature].label}
                    </span>
                  </TD>
                  <TD>{lead.channel}</TD>
                  <TD>
                    <span className="tnum font-bold text-accent">{lead.score}</span>
                  </TD>
                  <TD>
                    <AiStatusBadge status={lead.aiStatus} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <LeadDetail
        leadId={detailLeadId}
        open={detailLeadId !== null}
        onClose={() => setDetailLeadId(null)}
      />
    </div>
  );
}
