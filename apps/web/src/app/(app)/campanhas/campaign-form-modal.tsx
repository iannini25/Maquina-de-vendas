"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { createCampaign, updateCampaign, type CampaignFormInput } from "@/server/campaigns/actions";
import type { CampaignFormOptions, CampaignTypeDto } from "@/server/campaigns/queries";

import { formatMoneyCompact } from "./money";

/** Valores iniciais serializáveis para o modo edição. */
export interface CampaignFormInitial {
  id: string;
  name: string;
  type: CampaignTypeDto;
  productOfferId: string | null;
  objective: string | null;
  channel: string | null;
  landingPageId: string | null;
  budgetCents: number | null;
  cplTargetCents: number | null;
  liveAtIso: string | null;
  warmupEnabled: boolean;
  remindersEnabled: boolean;
}

const OBJECTIVES = ["Gerar leads", "Venda direta", "Inscrição na live"];
const CHANNELS = ["Meta", "Google", "Orgânico", "Outro"];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Modal Nova campanha / Editar campanha (campos exatos do protótipo). */
export function CampaignFormModal({
  open,
  onClose,
  options,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  options: CampaignFormOptions;
  initial?: CampaignFormInitial;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(initial);

  const [type, setType] = useState<CampaignTypeDto>("STANDARD");
  const [name, setName] = useState("");
  const [productOfferId, setProductOfferId] = useState("");
  const [objective, setObjective] = useState(OBJECTIVES[0] ?? "Gerar leads");
  const [channel, setChannel] = useState(CHANNELS[0] ?? "Meta");
  const [landingPageId, setLandingPageId] = useState("");
  const [budget, setBudget] = useState("");
  const [cplTarget, setCplTarget] = useState("");
  const [liveAt, setLiveAt] = useState("");
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reseta/preenche o formulário sempre que o modal abre.
  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? "STANDARD");
    setName(initial?.name ?? "");
    setProductOfferId(initial?.productOfferId ?? options.products[0]?.id ?? "");
    setObjective(initial?.objective ?? OBJECTIVES[0] ?? "Gerar leads");
    setChannel(initial?.channel ?? CHANNELS[0] ?? "Meta");
    setLandingPageId(initial?.landingPageId ?? "");
    setBudget(initial?.budgetCents != null ? formatMoneyCompact(initial.budgetCents) : "");
    setCplTarget(initial?.cplTargetCents != null ? formatMoneyCompact(initial.cplTargetCents) : "");
    setLiveAt(toDatetimeLocal(initial?.liveAtIso ?? null));
    setWarmupEnabled(initial ? initial.warmupEnabled : true);
    setRemindersEnabled(initial ? initial.remindersEnabled : true);
    setError(null);
  }, [open, initial, options.products]);

  // Campanhas antigas podem ter objetivo/canal fora das opções padrão.
  const objectiveOptions = useMemo(() => {
    const base = [...OBJECTIVES];
    if (initial?.objective && !base.includes(initial.objective)) base.unshift(initial.objective);
    return base;
  }, [initial]);
  const channelOptions = useMemo(() => {
    const base = [...CHANNELS];
    if (initial?.channel && !base.includes(initial.channel)) base.unshift(initial.channel);
    return base;
  }, [initial]);

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres");
      return;
    }
    if (!productOfferId) {
      setError("Escolha um produto");
      return;
    }
    if (type === "LAUNCH_LIVE" && !liveAt) {
      setError("Informe a data da live");
      return;
    }

    const payload: CampaignFormInput = {
      name: name.trim(),
      type,
      productOfferId,
      objective,
      channel,
      landingPageId: landingPageId || null,
      budgetRaw: budget || undefined,
      cplTargetRaw: cplTarget || undefined,
      liveAt: type === "LAUNCH_LIVE" ? liveAt : undefined,
      warmupEnabled: type === "LAUNCH_LIVE" ? warmupEnabled : false,
      remindersEnabled: type === "LAUNCH_LIVE" ? remindersEnabled : false,
    };

    setSaving(true);
    const result = initial
      ? await updateCampaign(initial.id, payload)
      : await createCampaign(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Não foi possível salvar. Tente novamente.");
      return;
    }
    toast(isEdit ? "Campanha atualizada." : "Campanha criada.");
    if (result.warning) toast(result.warning, "danger");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar campanha" : "Nova campanha"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Salvar alterações" : "Criar campanha"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel required>Tipo</FieldLabel>
          <Segmented
            className="w-full [&>button]:flex-1"
            options={[
              { value: "STANDARD", label: "Padrão" },
              { value: "LAUNCH_LIVE", label: "Lançamento (Live)" },
            ]}
            value={type}
            onChange={setType}
          />
        </div>

        <Input
          label="Nome"
          requiredMark
          placeholder="Ex.: Live IA na Liderança"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Produto"
            requiredMark
            value={productOfferId}
            onChange={(e) => setProductOfferId(e.target.value)}
          >
            {options.products.length === 0 && <option value="">Nenhum produto cadastrado</option>}
            {options.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatMoneyCompact(product.priceCents)}
              </option>
            ))}
          </Select>
          <Select
            label="Objetivo"
            requiredMark
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          >
            {objectiveOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Canal de aquisição"
            requiredMark
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {channelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Select
            label="Landing page"
            value={landingPageId}
            onChange={(e) => setLandingPageId(e.target.value)}
          >
            <option value="">Nenhuma</option>
            {options.landings.map((landing) => (
              <option key={landing.id} value={landing.id}>
                {landing.name} · sales4u.io/{landing.slug}
              </option>
            ))}
          </Select>
        </div>

        {type === "LAUNCH_LIVE" && (
          <div className="space-y-4 rounded-2xl border border-brand-3/25 bg-brand-soft/40 p-4">
            <Input
              label="Data da live"
              requiredMark
              type="datetime-local"
              value={liveAt}
              onChange={(e) => setLiveAt(e.target.value)}
            />
            <Toggle
              checked={warmupEnabled}
              onChange={setWarmupEnabled}
              label="Aquecimento"
              hint="A IA aquece os inscritos com conteúdo até o dia da live."
            />
            <Toggle
              checked={remindersEnabled}
              onChange={setRemindersEnabled}
              label="Lembretes"
              hint="T-1d · T-3h · T-15min antes da live, automáticos."
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Orçamento previsto"
            hint="(opcional)"
            placeholder="R$ 5.000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <Input
            label="CPL alvo"
            hint="(opcional)"
            placeholder="R$ 8,00"
            value={cplTarget}
            onChange={(e) => setCplTarget(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
