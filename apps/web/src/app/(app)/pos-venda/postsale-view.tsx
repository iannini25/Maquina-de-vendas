"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown, DropdownItem, EmptyState } from "@/components/ui/misc";
import { FieldLabel, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { timeAgo } from "@/lib/format";
import {
  markManualUsage,
  updatePostSaleFlow,
  updateUpsellWindow,
} from "@/server/postsale/actions";
import type { AccessUsageDto, PostSalePageData } from "@/server/postsale/queries";

type PostSaleTab = "clientes" | "fluxos" | "acessos";

const TABS: Array<{ value: PostSaleTab; label: string }> = [
  { value: "clientes", label: "Clientes" },
  { value: "fluxos", label: "Fluxos de pós-venda" },
  { value: "acessos", label: "Acessos & uso" },
];

const UPSELL_WINDOWS = [3, 7, 14, 30];

function UsageText({ usage }: { usage: AccessUsageDto | null }) {
  if (usage === "ACTIVE") return <span className="font-medium text-success">Ativo</span>;
  if (usage === "ACCESSED") return <span className="font-medium text-warm">Logou</span>;
  if (usage === "NEVER") return <span className="font-medium text-danger">Nunca usou</span>;
  if (usage === "IDLE") return <span className="font-medium text-warm">Parado</span>;
  return <span className="text-ink-3">—</span>;
}

function nextAction(usage: AccessUsageDto | null): string {
  if (usage === "ACTIVE") return "Pedir depoimento";
  if (usage === "ACCESSED") return "Enviar guia do dia 2";
  if (usage === "NEVER" || usage === "IDLE") return "“Aconteceu algo? Posso ajudar?”";
  return "—";
}

/** 7800s → "2h 10min"; 0 → "—". */
function formatActiveTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

const ACCESS_LINK_SNIPPET = "/a/{token}";
const HEARTBEAT_SNIPPET = '<script src="/api/usage/{token}/beacon.js"></script>';

export function PostSaleView({ data }: { data: PostSalePageData }) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<PostSaleTab>("clientes");
  const [createOpen, setCreateOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [flowState, setFlowState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.flows.map((f) => [f.key, f.enabled])),
  );
  const [windowDays, setWindowDays] = useState(String(data.upsellWindowDays));
  const [savingWindow, setSavingWindow] = useState(false);
  const [markingGrantId, setMarkingGrantId] = useState<string | null>(null);

  async function handleToggleFlow(key: string, next: boolean) {
    setFlowState((state) => ({ ...state, [key]: next }));
    const result = await updatePostSaleFlow(key, next);
    if (!result.ok) {
      setFlowState((state) => ({ ...state, [key]: !next }));
      toast(result.error ?? "Não foi possível salvar o fluxo.", "danger");
      return;
    }
    toast(next ? "Fluxo ativado." : "Fluxo desativado.");
  }

  async function handleWindowChange(value: string) {
    const previous = windowDays;
    setWindowDays(value);
    setSavingWindow(true);
    const result = await updateUpsellWindow(Number(value));
    setSavingWindow(false);
    if (!result.ok) {
      setWindowDays(previous);
      toast(result.error ?? "Não foi possível salvar a janela.", "danger");
      return;
    }
    toast("Janela do upsell atualizada.");
  }

  async function handleMarkUsage(grantId: string) {
    setMarkingGrantId(grantId);
    const result = await markManualUsage(grantId);
    setMarkingGrantId(null);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível registrar o uso.", "danger");
      return;
    }
    toast("Uso registrado — cliente marcado como ativo.");
  }

  async function handleCopy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("Não foi possível copiar.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Pós-venda"
        subtitle="Clientes, uso e fluxos automáticos"
        actions={
          <div className="relative">
            <Button variant="primary" onClick={() => setCreateOpen((open) => !open)}>
              Criar
              <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white/20">
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </span>
            </Button>
            <Dropdown open={createOpen} onClose={() => setCreateOpen(false)} align="right">
              <DropdownItem
                onClick={() => {
                  setCreateOpen(false);
                  router.push("/financas?tab=vendas");
                }}
              >
                Lançar venda
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  setCreateOpen(false);
                  setTab("fluxos");
                }}
              >
                Novo fluxo
              </DropdownItem>
            </Dropdown>
          </div>
        }
      />

      <div className="flex flex-col gap-5 p-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {data.inactiveCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-warm/30 bg-warm/[0.08] px-4 py-3">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand-2" />
            <p className="text-[13px] text-ink">
              {data.inactiveCount === 1
                ? "1 cliente não usou o acesso"
                : `${data.inactiveCount} clientes não usaram o acesso`}{" "}
              — a IA já está cuidando da reativação.
            </p>
          </div>
        )}

        {tab === "clientes" && (
          <>
            {data.clients.length === 0 ? (
              <EmptyState
                title="Nenhum cliente ainda"
                hint="Quando uma venda for registrada, o cliente aparece aqui com uso do acesso e a próxima ação da IA."
                action={
                  <Button variant="primary" size="sm" onClick={() => router.push("/financas?tab=vendas")}>
                    Lançar venda
                  </Button>
                }
              />
            ) : (
              <Table>
                <THead>
                  <TH>Cliente</TH>
                  <TH>Uso</TH>
                  <TH>NPS</TH>
                  <TH>Próxima ação (IA)</TH>
                </THead>
                <TBody>
                  {data.clients.map((client) => (
                    <TR key={client.leadId}>
                      <TD className="font-medium text-ink">{client.name}</TD>
                      <TD>
                        <UsageText usage={client.usage} />
                      </TD>
                      <TD className="tnum">—</TD>
                      <TD>{nextAction(client.usage)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </>
        )}

        {tab === "fluxos" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {data.flows.map((flow, index) => (
              <Card key={flow.key} className="rise-in" style={{ animationDelay: `${index * 40}ms` }}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink">{flow.title}</h3>
                  <Toggle
                    checked={flowState[flow.key] ?? flow.enabled}
                    onChange={(next) => handleToggleFlow(flow.key, next)}
                  />
                </div>
                {flow.key === "upsell" && (
                  <div className="mt-4">
                    <FieldLabel required>Janela de tempo</FieldLabel>
                    <Select
                      aria-label="Janela de tempo do upsell"
                      value={windowDays}
                      disabled={savingWindow}
                      onChange={(e) => handleWindowChange(e.target.value)}
                    >
                      {UPSELL_WINDOWS.map((days) => (
                        <option key={days} value={String(days)}>
                          {days} dias após a compra
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push(`/emails?purpose=${flow.emailPurpose}`)}
                >
                  Editar mensagem
                </Button>
              </Card>
            ))}
          </div>
        )}

        {tab === "acessos" && (
          <>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setAccessModalOpen(true)}>
                Configurar links de acesso
              </Button>
            </div>
            {data.accessRows.length === 0 ? (
              <EmptyState
                title="Nenhum acesso monitorado"
                hint="Cada venda gera um link de acesso rastreado — o uso do cliente aparece aqui automaticamente."
              />
            ) : (
              <Table>
                <THead>
                  <TH>Cliente</TH>
                  <TH>Logou?</TH>
                  <TH>Tempo ativo</TH>
                  <TH>Última atividade</TH>
                  <TH className="text-right">Ações</TH>
                </THead>
                <TBody>
                  {data.accessRows.map((row) => (
                    <TR key={row.grantId}>
                      <TD className="font-medium text-ink">{row.leadName}</TD>
                      <TD>
                        {row.logged ? (
                          <span className="font-medium text-success">Sim</span>
                        ) : (
                          <span className="font-medium text-danger">Não</span>
                        )}
                      </TD>
                      <TD className="tnum">{formatActiveTime(row.totalActiveSeconds)}</TD>
                      <TD>{row.lastActivityIso ? timeAgo(row.lastActivityIso) : "—"}</TD>
                      <TD className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={markingGrantId === row.grantId}
                          onClick={() => handleMarkUsage(row.grantId)}
                        >
                          Marcar uso manual
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </>
        )}
      </div>

      <Modal
        open={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        title="Links de acesso rastreados"
        subtitle="Como o Sales4U mede login e tempo ativo dos seus clientes"
        footer={
          <Button variant="secondary" onClick={() => setAccessModalOpen(false)}>
            Fechar
          </Button>
        }
      >
        <div className="space-y-4 text-[13px] leading-relaxed text-ink-2">
          <p>
            Cada venda gera um <strong className="text-ink">link rastreado</strong> no formato
            abaixo. Entregue esse link ao cliente — ao abrir, o Sales4U registra o primeiro
            acesso e redireciona para a sua área de membros.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5">
            <code className="truncate text-[12.5px] text-accent">{ACCESS_LINK_SNIPPET}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                handleCopy(`${window.location.origin}${ACCESS_LINK_SNIPPET}`, "Link copiado.")
              }
            >
              Copiar
            </Button>
          </div>
          <p>
            Para medir o <strong className="text-ink">tempo ativo</strong> dentro da área de
            membros, adicione o snippet de heartbeat nas páginas do curso:
          </p>
          <div className="flex items-center justify-between gap-3 rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5">
            <code className="truncate text-[12.5px] text-accent">{HEARTBEAT_SNIPPET}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                handleCopy(
                  `<script src="${window.location.origin}/api/usage/{token}/beacon.js"></script>`,
                  "Snippet copiado.",
                )
              }
            >
              Copiar
            </Button>
          </div>
          <p className="text-[12px] text-ink-3">
            Substitua <code className="text-accent">{"{token}"}</code> pelo token de cada cliente —
            a IA preenche isso automaticamente ao entregar o acesso.
          </p>
        </div>
      </Modal>
    </>
  );
}
