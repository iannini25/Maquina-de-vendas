"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { AiStatusBadge, TemperatureBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Dropdown, DropdownItem, EmptyState, ErrorState, ProgressBar } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { SlideOver } from "@/components/ui/slide-over";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatBRL, timeAgo } from "@/lib/format";
import {
  addNote,
  deleteLead,
  getLeadDetail,
  markLeadLost,
  takeoverConversation,
} from "@/server/pipeline/actions";
import {
  formatPhoneBR,
  translateLeadEvent,
  type LeadDetailDto,
} from "@/server/pipeline/types";

type TabKey = "overview" | "conversation" | "notes" | "activity";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline-soft py-2.5 last:border-b-0">
      <span className="shrink-0 text-[12.5px] text-ink-3">{label}</span>
      <span className="truncate text-right text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * Slide-over de detalhe do lead (Pipeline, Leads e demais módulos).
 * Reutilizável: recebe apenas leadId/open/onClose e busca tudo via action.
 */
export function LeadDetail({
  leadId,
  open,
  onClose,
}: {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [detail, setDetail] = useState<LeadDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [lostSaving, setLostSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load(id: string) {
    setLoading(true);
    setError(null);
    const result = await getLeadDetail(id);
    setLoading(false);
    if (result.ok && result.detail) {
      setDetail(result.detail);
    } else {
      setError(result.error ?? "Não foi possível carregar o lead.");
    }
  }

  useEffect(() => {
    if (!open || !leadId) return;
    setDetail(null);
    setTab("overview");
    setNoteText("");
    setMenuOpen(false);
    setLostOpen(false);
    setLostReason("");
    setDeleteOpen(false);
    void load(leadId);
  }, [open, leadId]);

  async function handleAddNote() {
    if (!leadId || !noteText.trim()) return;
    setSavingNote(true);
    const result = await addNote({ leadId, text: noteText.trim() });
    setSavingNote(false);
    if (result.ok && result.note) {
      const note = result.note;
      setDetail((prev) => (prev ? { ...prev, notes: [note, ...prev.notes] } : prev));
      setNoteText("");
      toast("Nota salva.");
    } else {
      toast(result.error ?? "Não foi possível salvar a nota.", "danger");
    }
  }

  async function handleTakeover() {
    if (!leadId) return;
    setTakingOver(true);
    const result = await takeoverConversation(leadId);
    setTakingOver(false);
    if (result.ok) {
      setDetail((prev) => (prev ? { ...prev, aiStatus: "PAUSED" } : prev));
      toast("Você assumiu a conversa — a IA foi pausada para este lead.");
      router.refresh();
    } else {
      toast(result.error ?? "Não foi possível assumir a conversa.", "danger");
    }
  }

  async function handleMarkLost() {
    if (!leadId || !lostReason.trim()) return;
    setLostSaving(true);
    const result = await markLeadLost({ leadId, reason: lostReason.trim() });
    setLostSaving(false);
    if (result.ok) {
      setLostOpen(false);
      onClose();
      toast(result.toastText || "Lead marcado como perdido — motivo registrado.");
      router.refresh();
    } else {
      toast(result.error ?? "Não foi possível marcar como perdido.", "danger");
    }
  }

  async function handleDelete() {
    if (!leadId) return;
    setDeleting(true);
    const result = await deleteLead(leadId);
    setDeleting(false);
    if (result.ok) {
      setDeleteOpen(false);
      onClose();
      toast("Lead excluído — dados apagados definitivamente.");
      router.refresh();
    } else {
      toast(result.error ?? "Não foi possível excluir o lead.", "danger");
    }
  }

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        width="max-w-xl"
        title={
          detail ? (
            <span className="flex items-center gap-3">
              <Avatar name={detail.name} size="lg" />
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold text-ink">
                  {detail.name}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <TemperatureBadge temperature={detail.temperature} />
                  <AiStatusBadge status={detail.aiStatus} />
                </span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <span className="skeleton size-11 rounded-full" />
              <span className="skeleton h-5 w-40" />
            </span>
          )
        }
        footer={
          detail ? (
            <div className="flex w-full items-center gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                loading={takingOver}
                disabled={detail.aiStatus === "PAUSED"}
                onClick={() => void handleTakeover()}
              >
                {detail.aiStatus === "PAUSED" ? "Conversa assumida" : "Assumir conversa"}
              </Button>
              <div className="relative">
                <Button
                  variant="secondary"
                  aria-label="Mais ações"
                  className="w-11 px-0"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  ⋯
                </Button>
                <Dropdown
                  open={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  align="right"
                  className="bottom-full mb-2"
                >
                  <DropdownItem
                    onClick={() => {
                      setMenuOpen(false);
                      setLostOpen(true);
                    }}
                  >
                    Marcar como perdido
                  </DropdownItem>
                  <DropdownItem
                    danger
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteOpen(true);
                    }}
                  >
                    Excluir lead
                  </DropdownItem>
                </Dropdown>
              </div>
            </div>
          ) : undefined
        }
      >
        {error ? (
          <ErrorState message={error} onRetry={() => leadId && void load(leadId)} />
        ) : loading || !detail ? (
          <div className="space-y-4">
            <div className="skeleton h-10 w-full rounded-full" />
            <div className="skeleton h-9 w-72" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="skeleton h-56" />
              <div className="skeleton h-56" />
            </div>
          </div>
        ) : (
          <div>
            <Link
              href={`/inbox?lead=${detail.id}`}
              className="mb-4 flex h-10 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] text-[13px] font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110"
            >
              Abrir conversa
            </Link>

            <Tabs<TabKey>
              tabs={[
                { value: "overview", label: "Visão geral" },
                { value: "conversation", label: "Conversa" },
                { value: "notes", label: "Notas" },
                { value: "activity", label: "Atividade" },
              ]}
              value={tab}
              onChange={setTab}
              className="mb-4"
            />

            {tab === "overview" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    Dados do lead
                  </p>
                  <InfoRow label="WhatsApp" value={formatPhoneBR(detail.phone)} />
                  <InfoRow label="E-mail" value={detail.email ?? "—"} />
                  <InfoRow label="Origem" value={detail.sourceLabel} />
                  <InfoRow label="Campanha" value={detail.campaignName ?? "—"} />
                  <InfoRow label="Estágio" value={detail.stageName} />
                  <InfoRow
                    label="Valor potencial"
                    value={detail.valueCents !== null ? formatBRL(detail.valueCents) : "—"}
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-brand-3/30 bg-brand-soft/40 p-4">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent">
                      Próxima ação recomendada (IA)
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink">
                      {detail.nextActionText ??
                        "Sem próxima ação registrada — a IA atualiza aqui após a próxima interação."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-hairline bg-white/[0.03] p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-ink">Score</span>
                      <span className="tnum text-lg font-bold text-accent">{detail.score}</span>
                    </div>
                    <ProgressBar value={detail.score} className="mt-2" />
                    {detail.tags.length > 0 && (
                      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-3">
                        Fatores: {detail.tags.join(" · ")}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "conversation" &&
              (detail.messages.length === 0 ? (
                <EmptyState
                  title="Sem mensagens ainda"
                  hint="Quando a conversa começar no WhatsApp, as últimas mensagens aparecem aqui."
                />
              ) : (
                <div className="space-y-2.5">
                  {detail.messages.map((message) =>
                    message.authorType === "LEAD" ? (
                      <div
                        key={message.id}
                        className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-3 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink"
                      >
                        {message.text}
                      </div>
                    ) : (
                      <div
                        key={message.id}
                        className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-3.5 py-2.5 text-[13px] leading-relaxed text-white"
                      >
                        {message.text}
                        {message.authorType === "AI" && (
                          <span className="mt-1 block text-right text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70">
                            IA
                          </span>
                        )}
                      </div>
                    ),
                  )}
                  {detail.lastAiReplyAt && (
                    <p className="pt-1 text-center text-[11px] text-ink-3">
                      IA respondeu · {timeAgo(detail.lastAiReplyAt)}
                    </p>
                  )}
                </div>
              ))}

            {tab === "notes" && (
              <div className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Escreva uma nota interna…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={savingNote}
                      disabled={!noteText.trim()}
                      onClick={() => void handleAddNote()}
                    >
                      Salvar nota
                    </Button>
                  </div>
                </div>

                {detail.notes.length === 0 ? (
                  <p className="text-[12.5px] text-ink-3">
                    Nenhuma nota ainda — registre acordos e contexto que a IA não vê.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {detail.notes.map((note) => (
                      <li key={note.id} className="border-l-2 border-brand-3 pl-3">
                        <p className="text-[13px] leading-relaxed text-ink">{note.text}</p>
                        <p className="mt-1 text-[11px] text-ink-3">
                          {note.isYou ? "Você" : note.authorName} · {timeAgo(note.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "activity" &&
              (detail.events.length === 0 ? (
                <EmptyState
                  title="Sem atividade registrada"
                  hint="Cada passo do lead no funil (estágios, mensagens, vendas) aparece aqui."
                />
              ) : (
                <ul className="space-y-4">
                  {detail.events.map((event) => (
                    <li key={event.id} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-2"
                      />
                      <div>
                        <p className="text-[13px] text-ink">
                          {translateLeadEvent(event.type, event.data)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-3">{timeAgo(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        )}
      </SlideOver>

      {/* Marcar como perdido */}
      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title="Marcar como perdido"
        subtitle="Registre o motivo — o analista de funil usa isso para melhorar a máquina."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={lostSaving}
              disabled={!lostReason.trim()}
              onClick={() => void handleMarkLost()}
            >
              Marcar como perdido
            </Button>
          </>
        }
      >
        <Textarea
          label="Motivo da perda"
          requiredMark
          placeholder="ex.: fechou com concorrente, sem orçamento agora…"
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
        />
      </Modal>

      {/* Excluir lead */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir lead"
        subtitle="Ação permanente (LGPD) — não dá para desfazer."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void handleDelete()}>
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-2">
          Isso apaga o lead, as conversas, as mensagens e as notas definitivamente. Pedidos e
          registros financeiros são mantidos para fins fiscais, sem vínculo com o lead.
        </p>
      </Modal>
    </>
  );
}
