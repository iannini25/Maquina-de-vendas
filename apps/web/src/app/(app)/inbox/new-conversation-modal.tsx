"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { openingSuggestionAction, startConversationAction } from "@/server/inbox/actions";
import type { LeadOptionDto } from "@/server/inbox/types";

type Recipient = "existing" | "new";

/**
 * Modal "Nova conversa" do protótipo: lead existente ou novo número, canal,
 * primeira mensagem com sugestão da IA e toggle "Deixar a IA conduzir".
 */
export function NewConversationModal({
  open,
  onClose,
  leadOptions,
  initialLeadId,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  leadOptions: LeadOptionDto[];
  initialLeadId: string | null;
  onStarted: (conversationId: string) => void;
}) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState<Recipient>("existing");
  const [leadId, setLeadId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [aiTakes, setAiTakes] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset ao abrir; ?lead= sem conversa pré-seleciona o lead.
  useEffect(() => {
    if (!open) return;
    setRecipient("existing");
    setLeadId(initialLeadId ?? leadOptions[0]?.id ?? "");
    setName("");
    setPhone("");
    setFirstMessage("");
    setAiTakes(true);
    setError(null);
  }, [open, initialLeadId, leadOptions]);

  const canSubmit =
    firstMessage.trim().length > 0 &&
    (recipient === "existing"
      ? leadId.length > 0
      : name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10);

  const handleSuggestion = async () => {
    if (suggesting) return;
    setSuggesting(true);
    const result = await openingSuggestionAction(
      recipient === "existing" ? { leadId } : { name: name.trim() || undefined },
    );
    setSuggesting(false);
    if (result.ok) setFirstMessage(result.text);
    else toast(result.error, result.missingKey ? "brand" : "danger");
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await startConversationAction({
      recipient,
      leadId: recipient === "existing" ? leadId : undefined,
      name: recipient === "new" ? name.trim() : undefined,
      phone: recipient === "new" ? phone : undefined,
      channel: "WHATSAPP",
      firstMessage: firstMessage.trim(),
      aiTakes,
    });
    setSubmitting(false);
    if (result.ok) {
      toast(
        aiTakes
          ? "Conversa iniciada — a IA conduz a partir daqui."
          : "Conversa iniciada — você está no comando.",
      );
      onStarted(result.conversationId);
    } else {
      setError(result.error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova conversa"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            Iniciar conversa
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel required>Destinatário</FieldLabel>
          <Segmented<Recipient>
            options={[
              { value: "existing", label: "Lead existente" },
              { value: "new", label: "Novo número" },
            ]}
            value={recipient}
            onChange={setRecipient}
            className="w-full [&>button]:flex-1"
          />
        </div>

        {recipient === "existing" ? (
          <Select
            label="Lead"
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
          >
            {leadOptions.length === 0 && <option value="">Nenhum lead cadastrado</option>}
            {leadOptions.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name} · {lead.stageName}
              </option>
            ))}
          </Select>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nome"
              requiredMark
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do contato"
            />
            <Input
              label="WhatsApp"
              requiredMark
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(11) 98765-4321"
              inputMode="tel"
            />
          </div>
        )}

        <Select label="Canal" value="WHATSAPP" onChange={() => undefined} hint="Instagram em breve">
          <option value="WHATSAPP">WhatsApp</option>
          <option value="INSTAGRAM" disabled>
            Instagram — em breve
          </option>
        </Select>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel required>Primeira mensagem</FieldLabel>
            <button
              type="button"
              onClick={() => void handleSuggestion()}
              disabled={suggesting}
              className="mb-1.5 flex items-center gap-1.5 rounded-full border border-brand-3/35 bg-brand-soft px-3 py-1 text-[11.5px] font-semibold text-accent transition-colors duration-[130ms] hover:border-brand-3/60 disabled:pointer-events-none disabled:opacity-55"
            >
              {suggesting ? (
                <span
                  aria-hidden
                  className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              ) : (
                <span aria-hidden>✦</span>
              )}
              Sugestão da IA
            </button>
          </div>
          <Textarea
            value={firstMessage}
            onChange={(event) => setFirstMessage(event.target.value)}
            placeholder="Escreva a primeira mensagem…"
            aria-label="Primeira mensagem"
            error={error ?? undefined}
          />
        </div>

        <Toggle
          checked={aiTakes}
          onChange={setAiTakes}
          label="Deixar a IA conduzir a partir daqui"
        />
      </div>
    </Modal>
  );
}
