"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { parseBRLToCents } from "@/lib/format";
import { createLead } from "@/server/pipeline/actions";

const ORIGENS = ["Anúncio Meta", "Live gratuita", "Indicação"] as const;

interface StageOption {
  id: string;
  name: string;
}

/** Modal "Novo lead" do Pipeline (protótipo pipeline--novo-lead.png). */
export function NewLeadModal({
  open,
  onClose,
  stages,
  initialStageId,
  onImportClick,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  stages: StageOption[];
  initialStageId: string | null;
  onImportClick: () => void;
  onCreated: (toastMessage: string) => void;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState<string>(ORIGENS[0]);
  const [valor, setValor] = useState("");
  const [stageId, setStageId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; whatsapp?: string; email?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setWhatsapp("");
    setEmail("");
    setOrigem(ORIGENS[0]);
    setValor("");
    setStageId(initialStageId ?? stages[0]?.id ?? null);
    setErrors({});
    setServerError(null);
    setSaving(false);
  }, [open, initialStageId, stages]);

  // Chips do estágio inicial: 3 primeiros + a coluna de origem, se for outra.
  const chipStages = stages.slice(0, 3);
  if (initialStageId && !chipStages.some((s) => s.id === initialStageId)) {
    const extra = stages.find((s) => s.id === initialStageId);
    if (extra) chipStages.push(extra);
  }

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Informe o nome do lead";
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) nextErrors.whatsapp = "WhatsApp inválido — use DDD + número";
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "E-mail inválido";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !stageId) return;

    setSaving(true);
    setServerError(null);
    const result = await createLead({
      name: name.trim(),
      whatsapp,
      email: email.trim(),
      origem,
      valueCents: valor.trim() ? parseBRLToCents(valor) : null,
      stageId,
    });
    setSaving(false);

    if (result.ok) {
      onCreated("Lead adicionado — a IA já assume pelo playbook do estágio.");
    } else {
      setServerError(result.error ?? "Não foi possível criar o lead.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lead"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={onImportClick}
            className="text-[12.5px] font-medium text-accent transition-colors duration-[130ms] hover:text-brand-2"
          >
            Importar em massa
          </button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
              Adicionar lead
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {serverError && <ErrorState message={serverError} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nome"
            requiredMark
            placeholder="Nome do lead"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Input
            label="WhatsApp"
            requiredMark
            placeholder="+55 (11) 99999-9999"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            error={errors.whatsapp}
          />
        </div>

        <Input
          label="E-mail"
          hint="(opcional)"
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Input
            label="Valor potencial"
            hint="(opcional)"
            placeholder="R$ 1.997"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel>Estágio inicial</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {chipStages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                aria-pressed={stageId === stage.id}
                onClick={() => setStageId(stage.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-[130ms]",
                  stageId === stage.id
                    ? "border-brand-3/50 bg-brand-soft text-ink"
                    : "border-hairline bg-surface-2 text-ink-3 hover:border-brand-3/25 hover:text-ink-2",
                )}
              >
                {stage.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
