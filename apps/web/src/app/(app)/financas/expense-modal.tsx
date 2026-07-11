"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createExpense, updateExpense, type ExpenseInput } from "@/server/finance/actions";
import { EXPENSE_CATEGORIES } from "@/server/finance/categories";
import type { CampaignOption, ExpenseRow } from "@/server/finance/queries";

import { formatBRLShort } from "./brl";

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function todayInput(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Modal "Lançar despesa" (também usado para editar uma despesa existente). */
export function ExpenseModal({
  open,
  onClose,
  campaigns,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  campaigns: CampaignOption[];
  editing: ExpenseRow | null;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<ExpenseInput["category"]>("PAID_TRAFFIC");
  const [valueRaw, setValueRaw] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(todayInput());
  const [campaignId, setCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(editing?.category ?? "PAID_TRAFFIC");
    setValueRaw(editing ? formatBRLShort(editing.valueCents) : "");
    setDescription(editing?.description ?? "");
    setPaidBy(editing?.paidBy ?? "");
    setDate(editing ? toDateInput(editing.dateIso) : todayInput());
    setCampaignId(editing?.campaignId ?? "");
    setError(null);
  }, [open, editing]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const input: ExpenseInput = {
      category,
      valueRaw,
      description,
      paidBy: paidBy || undefined,
      date,
      campaignId: campaignId || null,
    };
    const result = editing ? await updateExpense(editing.id, input) : await createExpense(input);
    setSaving(false);
    if (result.ok) {
      toast(editing ? "Despesa atualizada." : "Despesa lançada.", "success");
      onClose();
    } else {
      setError(result.error ?? "Não foi possível salvar a despesa.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar despesa" : "Lançar despesa"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {editing ? "Salvar" : "Lançar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Categoria"
          requiredMark
          value={category}
          onChange={(event) => setCategory(event.target.value as ExpenseInput["category"])}
        >
          {EXPENSE_CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor"
            requiredMark
            placeholder="R$ 500"
            value={valueRaw}
            onChange={(event) => setValueRaw(event.target.value)}
          />
          <Input
            label="Data"
            requiredMark
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <Input
          label="Descrição"
          requiredMark
          placeholder="Meta Ads — campanha Live IA"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <Input
          label="Quem pagou"
          placeholder="Você"
          value={paidBy}
          onChange={(event) => setPaidBy(event.target.value)}
        />

        <Select
          label="Campanha"
          hint="opcional — entra no ROI por campanha"
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
        >
          <option value="">Sem campanha</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </Select>

        {error && <ErrorState message={error} />}
      </div>
    </Modal>
  );
}
