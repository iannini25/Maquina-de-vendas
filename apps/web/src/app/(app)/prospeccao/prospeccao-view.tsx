"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { saveCredentialAction } from "@/server/credentials/actions";
import {
  approveAndSendAction,
  buildSourceListAction,
  generateOutreachAction,
  sendProspectsToPipelineAction,
  updateOutreachAction,
} from "@/server/prospecting/actions";
import type { ProspectingPageData } from "@/server/prospecting/queries";

import { CsvImportModal } from "./csv-import-modal";
import { VibeChat } from "./vibe-chat";

/** Prospecção Ativa: Fontes | Leads não contatados | Listas | Abordagens. */

type ProspectingTab = "fontes" | "leads" | "listas" | "abordagens";

const TABS: Array<{ value: ProspectingTab; label: string }> = [
  { value: "fontes", label: "Fontes" },
  { value: "leads", label: "Leads não contatados" },
  { value: "listas", label: "Listas" },
  { value: "abordagens", label: "Abordagens" },
];

/** "hoje" · "ontem" · "N dias" (formato da coluna DATA do protótipo). */
function dayLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `${days} dias`;
}

function WarnBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-warm/25 bg-warm/[0.07] px-4 py-3 text-[13px] text-ink">
      <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-warm" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4 2.5 20h19L12 4Z" />
        <path d="M12 10v4m0 3h.01" />
      </svg>
      {children}
    </div>
  );
}

function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 cursor-pointer appearance-none rounded-[5px] border border-hairline bg-surface-2 transition-colors duration-[130ms] checked:border-brand-3 checked:bg-[linear-gradient(135deg,#7C3AED,#A855F7)]"
    />
  );
}

export function ProspeccaoView({ data }: { data: ProspectingPageData }) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<ProspectingTab>("fontes");

  // ── Fontes ────────────────────────────────────────────────────────────────
  const [connectOpen, setConnectOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [buildingSource, setBuildingSource] = useState<"INERT_CONTACTS" | "GHOSTED" | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ── Leads não contatados ──────────────────────────────────────────────────
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [sendingToPipeline, setSendingToPipeline] = useState(false);

  // ── Abordagens ────────────────────────────────────────────────────────────
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState<"selected" | "all" | null>(null);

  function toggleSet(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function handleConnect() {
    if (!apiKey.trim()) return;
    setConnecting(true);
    const result = await saveCredentialAction("EXPLORIUM", { apiKey: apiKey.trim() });
    setConnecting(false);
    if (result.status !== "OK") {
      toast(result.error ?? "Não foi possível conectar. Confira a chave.", "danger");
      return;
    }
    setConnectOpen(false);
    setApiKey("");
    toast("Conectado ao Vibe Prospecting.", "success");
    router.refresh();
  }

  async function handleBuildSource(kind: "INERT_CONTACTS" | "GHOSTED") {
    setBuildingSource(kind);
    const result = await buildSourceListAction(kind);
    setBuildingSource(null);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível montar a lista.", "danger");
      return;
    }
    toast(
      `Lista "${result.listName}" atualizada — ${result.added} novos, ${result.total} no total.`,
      "success",
    );
    setTab("listas");
    router.refresh();
  }

  function handleConfigureIcp() {
    if (!data.vibeConnected) {
      setConnectOpen(true);
      return;
    }
    toast("Varredura via Vibe Prospecting — defina o ICP (consome créditos).");
    chatInputRef.current?.focus();
    chatInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleGenerateOutreach() {
    if (selectedProspects.size === 0) {
      toast("Selecione ao menos um lead para gerar a abordagem.", "danger");
      return;
    }
    setGenerating(true);
    const result = await generateOutreachAction([...selectedProspects]);
    setGenerating(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível gerar as abordagens.", "danger");
      return;
    }
    const failedNote = result.failed ? ` (${result.failed} falharam)` : "";
    toast(`${result.generated} abordagens geradas com IA${failedNote}. Revise antes de enviar.`, "success");
    setSelectedProspects(new Set());
    setTab("abordagens");
    router.refresh();
  }

  async function handleSendToPipeline() {
    if (selectedProspects.size === 0) {
      toast("Selecione ao menos um lead para enviar ao Pipeline.", "danger");
      return;
    }
    setSendingToPipeline(true);
    const result = await sendProspectsToPipelineAction([...selectedProspects]);
    setSendingToPipeline(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível criar os leads.", "danger");
      return;
    }
    const skippedNote = result.skipped ? ` · ${result.skipped} já existiam ou estavam sem WhatsApp` : "";
    toast(`${result.created} leads criados no Pipeline${skippedNote}.`, "success");
    setSelectedProspects(new Set());
    router.refresh();
  }

  async function handleDraftBlur(outreachId: string, original: string) {
    const edited = draftEdits[outreachId];
    if (edited === undefined || edited === original) return;
    if (!edited.trim()) {
      toast("A mensagem não pode ficar vazia.", "danger");
      return;
    }
    const result = await updateOutreachAction(outreachId, edited);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível salvar a edição.", "danger");
      return;
    }
    toast("Abordagem atualizada.");
  }

  async function handleApprove(which: "selected" | "all") {
    const ids = which === "selected" ? [...selectedDrafts] : data.drafts.map((draft) => draft.id);
    if (ids.length === 0) {
      toast("Nenhuma abordagem para aprovar.", "danger");
      return;
    }
    setApproving(which);
    const result = await approveAndSendAction(ids);
    setApproving(null);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível enviar as abordagens.", "danger");
      return;
    }
    const skippedNote = result.skipped ? ` · ${result.skipped} sem WhatsApp foram puladas` : "";
    toast(`${result.sent} abordagens enviadas — leads criados no Pipeline${skippedNote}.`, "success");
    setSelectedDrafts(new Set());
    router.refresh();
  }

  const allProspectsSelected =
    data.uncontacted.length > 0 && data.uncontacted.every((p) => selectedProspects.has(p.id));

  return (
    <>
      <PageHeader
        title="Prospecção Ativa"
        subtitle="Encha o topo do funil com controle humano"
        actions={
          <Button variant="primary" onClick={() => setTab("fontes")}>
            Buscar leads
            <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </Button>
        }
      />

      <div className="flex flex-col gap-5 p-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {/* ── Fontes ─────────────────────────────────────────────────────── */}
        {tab === "fontes" && (
          <div className="flex flex-col gap-5 rise-in">
            <Card className="border-brand-3/30" glow>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="text-accent">✦</span>
                  <h2 className="font-display text-[15px] font-semibold text-ink">Vibe Prospecting</h2>
                  {data.vibeConnected ? (
                    <Badge tone="success" dot>Conectado</Badge>
                  ) : (
                    <Badge tone="muted">Desconectado</Badge>
                  )}
                </div>
                {!data.vibeConnected && (
                  <Button variant="primary" onClick={() => setConnectOpen(true)}>
                    Conectar ao Vibe Prospecting
                  </Button>
                )}
              </div>
              {!data.vibeConnected && (
                <p className="mt-2 text-[13px] text-ink-2">
                  Converse com o assistente e ele encontra leads pra você dentro da plataforma.
                  Consome créditos.
                </p>
              )}
              {data.vibeConnected && <VibeChat ref={chatInputRef} onImported={() => router.refresh()} />}
            </Card>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <h3 className="text-sm font-semibold text-ink">Contatos que não se manifestaram</h3>
                <p className="mt-1.5 text-[12.5px] text-ink-3">
                  {data.inertCount} contatos receberam mensagem e nunca responderam.
                </p>
                <Button
                  className="mt-4"
                  loading={buildingSource === "INERT_CONTACTS"}
                  disabled={data.inertCount === 0}
                  onClick={() => handleBuildSource("INERT_CONTACTS")}
                >
                  Buscar leads
                </Button>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-ink">Leads que sumiram</h3>
                <p className="mt-1.5 text-[12.5px] text-ink-3">
                  {data.ghostedCount} leads pararam de responder no meio da conversa.
                </p>
                <Button
                  className="mt-4"
                  loading={buildingSource === "GHOSTED"}
                  disabled={data.ghostedCount === 0}
                  onClick={() => handleBuildSource("GHOSTED")}
                >
                  Buscar leads
                </Button>
              </Card>

              <Card className="border-brand-3/30">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden className="font-display text-[13px] font-bold text-cold">in</span>
                  Varredura no LinkedIn
                </h3>
                <p className="mt-1.5 text-[12.5px] text-ink-3">
                  Encontre líderes pelo cargo via Vibe Prospecting (consome créditos).
                </p>
                <Button variant="primary" className="mt-4" onClick={handleConfigureIcp}>
                  Configurar ICP
                </Button>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-ink">Importar base</h3>
                <p className="mt-1.5 text-[12.5px] text-ink-3">Suba um CSV e mapeie as colunas.</p>
                <Button className="mt-4" onClick={() => setCsvOpen(true)}>
                  Configurar
                </Button>
              </Card>
            </div>
          </div>
        )}

        {/* ── Leads não contatados ───────────────────────────────────────── */}
        {tab === "leads" && (
          <div className="flex flex-col gap-4 rise-in">
            {data.uncontacted.length === 0 ? (
              <EmptyState
                title="Nenhum lead esperando contato"
                hint="Busque leads nas Fontes — Vibe Prospecting, varredura no LinkedIn, CSV ou o próprio CRM — para encher esta fila."
                action={<Button variant="primary" onClick={() => setTab("fontes")}>Buscar leads</Button>}
              />
            ) : (
              <>
                <WarnBanner>
                  Estes leads ainda não foram contatados. Gere uma abordagem e aprove antes de disparar.
                </WarnBanner>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    className="border-brand-3/40"
                    loading={generating}
                    onClick={handleGenerateOutreach}
                  >
                    Gerar abordagem com IA
                  </Button>
                  <Button variant="primary" loading={sendingToPipeline} onClick={handleSendToPipeline}>
                    Enviar para o Pipeline
                  </Button>
                </div>

                <Table>
                  <THead>
                    <TH className="w-10">
                      <CheckBox
                        label="Selecionar todos"
                        checked={allProspectsSelected}
                        onChange={(checked) =>
                          setSelectedProspects(
                            checked ? new Set(data.uncontacted.map((p) => p.id)) : new Set(),
                          )
                        }
                      />
                    </TH>
                    <TH>Nome</TH>
                    <TH>Empresa / Cargo</TH>
                    <TH>Origem</TH>
                    <TH>Data</TH>
                  </THead>
                  <TBody>
                    {data.uncontacted.map((prospect) => (
                      <TR key={prospect.id}>
                        <TD className="w-10">
                          <CheckBox
                            label={`Selecionar ${prospect.name}`}
                            checked={selectedProspects.has(prospect.id)}
                            onChange={() =>
                              setSelectedProspects((current) => toggleSet(current, prospect.id))
                            }
                          />
                        </TD>
                        <TD className="font-semibold text-ink">{prospect.name}</TD>
                        <TD>
                          {[prospect.role, prospect.company].filter(Boolean).join(" · ") || "—"}
                        </TD>
                        <TD>{prospect.originLabel}</TD>
                        <TD className="text-ink-3">{dayLabel(prospect.createdAtIso)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </>
            )}
          </div>
        )}

        {/* ── Listas ─────────────────────────────────────────────────────── */}
        {tab === "listas" && (
          <div className="flex flex-col gap-3 rise-in">
            {data.lists.length === 0 ? (
              <EmptyState
                title="Nenhuma lista de prospecção ainda"
                hint="Crie listas a partir das Fontes: contatos do CRM, busca no Vibe Prospecting ou importação de CSV."
                action={<Button variant="primary" onClick={() => setTab("fontes")}>Buscar leads</Button>}
              />
            ) : (
              data.lists.map((list, index) => (
                <Card
                  key={list.id}
                  className="flex items-center justify-between gap-3 rise-in py-4"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{list.name}</h3>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {list.sourceLabel} · {list.prospectCount} prospects
                    </p>
                  </div>
                  {list.inOutreach ? (
                    <span className="shrink-0 text-[12px] font-medium text-warm">Em abordagem</span>
                  ) : (
                    <span className="shrink-0 text-[12px] font-medium text-success">Pronta</span>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── Abordagens ─────────────────────────────────────────────────── */}
        {tab === "abordagens" && (
          <div className="flex flex-col gap-4 rise-in">
            {data.drafts.length === 0 ? (
              <EmptyState
                title="Nenhuma abordagem aguardando revisão"
                hint='Selecione leads em "Leads não contatados" e clique em "Gerar abordagem com IA" para criar os rascunhos.'
                action={
                  <Button variant="primary" onClick={() => setTab("leads")}>
                    Ir para leads não contatados
                  </Button>
                }
              />
            ) : (
              <>
                <WarnBanner>
                  Disparos em massa exigem sua aprovação. Revise cada mensagem abaixo.
                </WarnBanner>
                <div className="flex items-start gap-2.5 rounded-2xl border border-brand-3/30 bg-brand-soft px-4 py-3 text-[12.5px] text-ink-2">
                  <span aria-hidden className="mt-0.5 text-accent">→</span>
                  <p>
                    A abordagem usa a mesma persona e contexto do SDR. Ao aprovar: o prospect{" "}
                    <strong className="text-ink">vira lead</strong>, entra no Pipeline (origem
                    Prospecção) e a IA <strong className="text-ink">continua a conversa</strong> a
                    partir desta mensagem, no Inbox.
                  </p>
                </div>

                {data.drafts.map((draft, index) => (
                  <Card key={draft.id} className="rise-in" style={{ animationDelay: `${index * 40}ms` }}>
                    <div className="flex items-center gap-3">
                      <CheckBox
                        label={`Selecionar abordagem de ${draft.name}`}
                        checked={selectedDrafts.has(draft.id)}
                        onChange={() => setSelectedDrafts((current) => toggleSet(current, draft.id))}
                      />
                      <Avatar name={draft.name} size="sm" />
                      <div className="min-w-0">
                        <h3 className="truncate text-[13.5px] font-semibold text-ink">{draft.name}</h3>
                        <p className="truncate text-[11.5px] text-ink-3">
                          {[draft.role, draft.company].filter(Boolean).join(" · ") || "—"} · via{" "}
                          {draft.originLabel}
                        </p>
                      </div>
                    </div>
                    <textarea
                      aria-label={`Mensagem de abordagem para ${draft.name}`}
                      rows={3}
                      value={draftEdits[draft.id] ?? draft.message}
                      onChange={(event) =>
                        setDraftEdits((current) => ({ ...current, [draft.id]: event.target.value }))
                      }
                      onBlur={() => void handleDraftBlur(draft.id, draft.message)}
                      className="mt-3 w-full resize-y rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-3 transition-colors duration-[130ms] focus:border-brand-3 focus:outline-none"
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">
                      <span aria-hidden className="text-accent">→</span>
                      vira lead, entra no Pipeline e a IA continua a conversa a partir desta mensagem
                    </p>
                  </Card>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button
                    loading={approving === "selected"}
                    disabled={selectedDrafts.size === 0 || approving !== null}
                    onClick={() => handleApprove("selected")}
                  >
                    Aprovar selecionados
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    loading={approving === "all"}
                    disabled={approving !== null}
                    onClick={() => handleApprove("all")}
                  >
                    Aprovar e enviar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal: conectar ao Vibe Prospecting (chave do Explorium) */}
      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Conectar ao Vibe Prospecting"
        subtitle="Cole a API Key do Explorium — a busca de prospects consome créditos da sua conta."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConnectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={connecting} disabled={!apiKey.trim()} onClick={handleConnect}>
              Conectar
            </Button>
          </>
        }
      >
        <Input
          label="API Key do Explorium"
          requiredMark
          type="password"
          placeholder="Cole a chave aqui"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          hint="Fica criptografada no workspace"
        />
      </Modal>

      <CsvImportModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImported={() => {
          router.refresh();
        }}
      />
    </>
  );
}
