"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { generateCadenceText, updateCadence } from "@/server/sdr/actions";
import {
  CADENCE_CHANNEL_OPTIONS,
  MAX_CADENCE_TOUCHES,
  minutesToUnit,
  touchDelayLabel,
  touchTag,
  unitToMinutes,
  type CadenceChannelDto,
  type CadenceDto,
  type CadenceUnit,
} from "@/server/sdr/types";

import type { SaveHandler } from "./sdr-view";

/** Aba Cadências: editor da cadência default (toques, canal, texto com IA). */

interface TouchRow {
  valueStr: string;
  unit: CadenceUnit;
  channel: CadenceChannelDto;
  text: string;
}

const UNIT_OPTIONS: Array<{ value: CadenceUnit; label: string }> = [
  { value: "min", label: "min" },
  { value: "h", label: "h" },
  { value: "d", label: "d" },
];

function toRow(minutes: number, channel: CadenceChannelDto, text: string): TouchRow {
  const { value, unit } = minutesToUnit(minutes);
  return { valueStr: String(value), unit, channel, text };
}

function rowMinutes(row: TouchRow): number | null {
  const value = Number(row.valueStr);
  if (!Number.isInteger(value) || value < 0) return null;
  return unitToMinutes(value, row.unit);
}

const selectClass =
  "rounded-[11px] border border-hairline bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink " +
  "transition-colors duration-[130ms] focus:border-brand-3 focus:outline-none";

export function CadencesTab({
  cadence,
  canUseAi,
  onRegisterSave,
}: {
  cadence: CadenceDto;
  canUseAi: boolean;
  onRegisterSave: (handler: SaveHandler) => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<TouchRow[]>(
    cadence.touches.map((t) => toRow(t.minutes, t.channel, t.text)),
  );
  const [maxTouches, setMaxTouches] = useState(String(cadence.maxTouches));
  const [maxError, setMaxError] = useState<string | undefined>();
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  function patchRow(index: number, changes: Partial<TouchRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  useEffect(() => {
    onRegisterSave(async () => {
      const max = Number(maxTouches);
      if (!Number.isInteger(max) || max < 1 || max > MAX_CADENCE_TOUCHES) {
        const error = `Informe o máximo de toques (1 a ${MAX_CADENCE_TOUCHES}).`;
        setMaxError(error);
        return { ok: false, error };
      }
      setMaxError(undefined);

      if (rows.length === 0) {
        return { ok: false, error: "A cadência precisa de pelo menos 1 toque." };
      }
      const touches = rows.map((row) => ({
        minutes: rowMinutes(row),
        channel: row.channel,
        text: row.text,
      }));
      if (touches.some((t) => t.minutes === null)) {
        return { ok: false, error: "Informe o intervalo de cada toque da cadência." };
      }
      return updateCadence({
        touches: touches.map((t) => ({ ...t, minutes: t.minutes as number })),
        maxTouches: max,
      });
    });
  });

  async function handleGenerate(index: number) {
    if (!canUseAi) {
      toast("Configure sua chave da Anthropic em Configurações para usar a IA.", "danger");
      return;
    }
    const row = rows[index];
    if (!row) return;
    const minutes = rowMinutes(row);
    if (minutes === null) {
      toast("Informe o intervalo do toque antes de gerar o texto.", "danger");
      return;
    }
    setGeneratingIndex(index);
    const result = await generateCadenceText({
      touchIndex: index,
      minutes,
      channel: row.channel,
    });
    setGeneratingIndex(null);
    if (result.ok && result.text) {
      patchRow(index, { text: result.text });
      toast("Texto do toque gerado — salve a configuração para manter.");
    } else {
      toast(result.error ?? "Não foi possível gerar o texto.", "danger");
    }
  }

  function addTouch() {
    if (rows.length >= MAX_CADENCE_TOUCHES) {
      toast(`Máximo de ${MAX_CADENCE_TOUCHES} toques na cadência.`, "danger");
      return;
    }
    setRows((current) => [...current, { valueStr: "1", unit: "d", channel: "whatsapp", text: "" }]);
  }

  return (
    <div className="max-w-3xl">
      <p className="text-[13px] text-ink-3">
        Sequência de toques antes de marcar como &quot;Não respondeu&quot;. Cada toque pode ser
        gerado com IA.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-5"
          title="Nenhum toque na cadência"
          hint="Adicione o primeiro toque — a IA segue esta sequência com cada lead que para de responder."
          action={
            <Button variant="primary" size="sm" onClick={addTouch}>
              Adicionar toque
            </Button>
          }
        />
      ) : (
        <div className="mt-2">
          {rows.map((row, index) => {
            const minutes = rowMinutes(row);
            return (
              <div key={index} className="border-b border-hairline-soft py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tnum w-[72px] shrink-0 font-display text-[13.5px] font-semibold text-accent">
                    {minutes === null ? "T+?" : touchTag(minutes)}
                  </span>

                  <div className="min-w-36 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">
                      {minutes === null ? "intervalo inválido" : touchDelayLabel(minutes)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      canal:{" "}
                      {CADENCE_CHANNEL_OPTIONS.find((c) => c.value === row.channel)?.label}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Intervalo do toque ${index + 1}`}
                      inputMode="numeric"
                      className="w-16 rounded-[11px] border border-hairline bg-surface-2 px-2.5 py-1.5 text-center text-[12.5px] text-ink transition-colors duration-[130ms] focus:border-brand-3 focus:outline-none"
                      value={row.valueStr}
                      onChange={(e) =>
                        patchRow(index, { valueStr: e.target.value.replace(/\D/g, "") })
                      }
                    />
                    <select
                      aria-label={`Unidade do toque ${index + 1}`}
                      className={selectClass}
                      value={row.unit}
                      onChange={(e) => patchRow(index, { unit: e.target.value as CadenceUnit })}
                    >
                      {UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Canal do toque ${index + 1}`}
                      className={selectClass}
                      value={row.channel}
                      onChange={(e) =>
                        patchRow(index, { channel: e.target.value as CadenceChannelDto })
                      }
                    >
                      {CADENCE_CHANNEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    loading={generatingIndex === index}
                    onClick={() => void handleGenerate(index)}
                  >
                    Gerar texto com IA
                  </Button>

                  <button
                    type="button"
                    aria-label={`Remover toque ${index + 1}`}
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    className="flex size-7.5 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-danger/10 hover:text-danger"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <textarea
                  aria-label={`Texto do toque ${index + 1}`}
                  placeholder="Texto do toque — escreva ou gere com IA. Fica salvo como template."
                  className="mt-3 min-h-16 w-full resize-y rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink transition-colors duration-[130ms] placeholder:text-ink-3 focus:border-brand-3 focus:outline-none"
                  value={row.text}
                  onChange={(e) => patchRow(index, { text: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={addTouch}>
          Adicionar toque
        </Button>
      )}

      <div className="mt-6 w-40">
        <FieldLabel required>Máximo de toques</FieldLabel>
        <Input
          aria-label="Máximo de toques"
          inputMode="numeric"
          value={maxTouches}
          onChange={(e) => {
            setMaxTouches(e.target.value.replace(/\D/g, ""));
            setMaxError(undefined);
          }}
        />
        <FieldError>{maxError}</FieldError>
      </div>
    </div>
  );
}
