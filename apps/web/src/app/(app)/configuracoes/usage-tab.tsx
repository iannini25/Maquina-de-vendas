"use client";

import { Overline } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { ProgressBar } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Espelho serializável de UsageSummary (src/server/setup/queries). */
export interface UsageAiRowDTO {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

export interface UsageSummaryDTO {
  aiRows: UsageAiRowDTO[];
  totalCostMicros: number;
  whatsappOut: number;
  emailsOut: number;
}

// ── Formatação ────────────────────────────────────────────────────────────

function formatUsd(micros: number): string {
  return `US$ ${(micros / 1e6).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`;
  }
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return count.toLocaleString("pt-BR");
}

function apiNameOf(model: string): string {
  if (model.toLowerCase().includes("claude")) return "Claude · Anthropic";
  if (model.toLowerCase().includes("voyage")) return "Voyage AI";
  return model;
}

const FEATURE_LABELS: Record<string, string> = {
  sdr: "IA · SDR",
  copy: "IA · copies",
  landing: "IA · landing pages",
  ads: "IA · anúncios",
  funnel: "IA · analista de funil",
  embeddings: "Embeddings · RAG",
};

function featureLabelOf(feature: string): string {
  return FEATURE_LABELS[feature] ?? `IA · ${feature}`;
}

function dotClassOf(name: string): string {
  if (name.startsWith("Claude")) return "bg-brand-2";
  if (name.startsWith("Voyage")) return "bg-cold";
  if (name.startsWith("WhatsApp")) return "bg-success";
  if (name.startsWith("Resend")) return "bg-danger";
  return "bg-warm";
}

interface UsageRow {
  key: string;
  name: string;
  sub: string;
  usageLabel: string;
  percent: number;
  price: string;
  cost: string;
  active: boolean;
}

function buildRows(usage: UsageSummaryDTO): UsageRow[] {
  const maxTokens = Math.max(
    1,
    ...usage.aiRows.map((row) => row.inputTokens + row.outputTokens),
  );
  const maxMessages = Math.max(1, usage.whatsappOut, usage.emailsOut);

  const aiRows: UsageRow[] =
    usage.aiRows.length > 0
      ? usage.aiRows.map((row) => {
          const tokens = row.inputTokens + row.outputTokens;
          const name = apiNameOf(row.model);
          const pricePerMillionMicros = tokens > 0 ? (row.costMicros / tokens) * 1_000_000 : 0;
          return {
            key: `${row.feature}::${row.model}`,
            name,
            sub: featureLabelOf(row.feature),
            usageLabel: `${formatTokens(tokens)} tokens · ${formatTokens(row.inputTokens)} in / ${formatTokens(row.outputTokens)} out`,
            percent: (tokens / maxTokens) * 100,
            price:
              pricePerMillionMicros > 0
                ? `≈ ${formatUsd(pricePerMillionMicros)} / 1M tokens`
                : "—",
            cost: formatUsd(row.costMicros),
            active: tokens > 0,
          };
        })
      : [
          {
            key: "anthropic-zero",
            name: "Claude · Anthropic",
            sub: "IA · geração",
            usageLabel: "0 tokens no mês",
            percent: 0,
            price: "—",
            cost: formatUsd(0),
            active: false,
          },
        ];

  return [
    ...aiRows,
    {
      key: "whatsapp",
      name: "WhatsApp · Evolution",
      sub: "Mensagens",
      usageLabel: `${usage.whatsappOut.toLocaleString("pt-BR")} msgs no mês`,
      percent: (usage.whatsappOut / maxMessages) * 100,
      price: "— (self-host)",
      cost: "—",
      active: usage.whatsappOut > 0,
    },
    {
      key: "resend",
      name: "Resend",
      sub: "E-mail",
      usageLabel: `${usage.emailsOut.toLocaleString("pt-BR")} e-mails no mês`,
      percent: (usage.emailsOut / maxMessages) * 100,
      price: "—",
      cost: "—",
      active: usage.emailsOut > 0,
    },
  ];
}

/** Aba Uso & Custos das APIs — AiUsage + contadores reais do mês atual. */
export function UsageTab({ usage }: { usage: UsageSummaryDTO }) {
  const rows = buildRows(usage);

  return (
    <div className="rise-in space-y-4">
      {/* Banner + custo estimado */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-white/[0.03] px-4.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <svg
          viewBox="0 0 24 24"
          className="size-[18px] shrink-0 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4v16h16" />
          <path d="m7.5 14 3.5-4 3 2.5 4.5-5.5" />
        </svg>
        <p className="min-w-56 flex-1 text-[12.5px] text-ink-2">
          Você usa suas próprias chaves — estes são os tokens, créditos e custos das APIs ativas
          neste ambiente, no mês atual.
        </p>
        <div className="ml-auto text-right">
          <Overline className="text-[10px]">Custo estimado do mês</Overline>
          <p className="font-display tnum text-[19px] font-semibold text-accent">
            {formatUsd(usage.totalCostMicros)}
          </p>
        </div>
      </div>

      {/* Tabela de consumo */}
      <Table>
        <THead>
          <TH>API</TH>
          <TH>Uso</TH>
          <TH>Preço</TH>
          <TH className="text-right">Custo · mês</TH>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.key}>
              <TD>
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotClassOf(row.name))} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{row.name}</span>
                    <span className="block text-[11px] text-ink-3">{row.sub}</span>
                  </span>
                </span>
              </TD>
              <TD>
                <span className="block text-[12.5px] text-ink-2">{row.usageLabel}</span>
                <ProgressBar value={row.percent} className="mt-1.5 w-40" />
              </TD>
              <TD className="text-[12px]">{row.price}</TD>
              <TD className="text-right">
                <span className="tnum block text-[13px] font-semibold text-ink">{row.cost}</span>
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1.5 text-[11px]",
                    row.active ? "text-success" : "text-ink-3",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", row.active ? "bg-success" : "bg-ink-3/60")}
                  />
                  {row.active ? "Ativo" : "Inativo"}
                </span>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <p className="text-[11.5px] text-ink-3">
        Os preços são os das próprias APIs (pago direto ao provedor). O Sales4U não cobra markup —
        é self-host.
      </p>
    </div>
  );
}
