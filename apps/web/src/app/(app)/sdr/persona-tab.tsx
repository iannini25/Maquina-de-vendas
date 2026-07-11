"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, Overline } from "@/components/ui/card";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { generatePersonaPreview, updatePersona } from "@/server/sdr/actions";
import {
  buildPersonaPreview,
  MSG_LENGTH_OPTIONS,
  SPEAKS_AS_OPTIONS,
  TONE_OPTIONS,
  type MsgLengthDto,
  type PersonaDto,
  type SpeaksAsDto,
  type ToneDto,
} from "@/server/sdr/types";

import type { SaveHandler } from "./sdr-view";

/** Aba Persona: configurações do assistente + painel PRÉVIA DA MENSAGEM. */
export function PersonaTab({
  persona,
  productName,
  productPriceCents,
  canUseAi,
  onRegisterSave,
}: {
  persona: PersonaDto;
  productName: string | null;
  productPriceCents: number | null;
  canUseAi: boolean;
  onRegisterSave: (handler: SaveHandler) => void;
}) {
  const { toast } = useToast();

  const [name, setName] = useState(persona.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [speaksAs, setSpeaksAs] = useState<SpeaksAsDto>(persona.speaksAs);
  const [tone, setTone] = useState<ToneDto>(persona.tone);
  const [msgLength, setMsgLength] = useState<MsgLengthDto>(persona.msgLength);
  const [emojis, setEmojis] = useState(persona.emojis);
  const [always, setAlways] = useState(persona.always);
  const [windowStart, setWindowStart] = useState(persona.windowStart);
  const [windowEnd, setWindowEnd] = useState(persona.windowEnd);

  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    onRegisterSave(async () => {
      if (!name.trim()) {
        const error = "Dê um nome ao assistente.";
        setNameError(error);
        return { ok: false, error };
      }
      setNameError(undefined);
      return updatePersona({
        name: name.trim(),
        speaksAs,
        tone,
        msgLength,
        emojis,
        always,
        windowStart,
        windowEnd,
      });
    });
  });

  // A prévia gerada com IA vale até a configuração mudar de novo.
  useEffect(() => {
    setAiPreview(null);
  }, [name, speaksAs, tone, msgLength, emojis]);

  const previewText =
    aiPreview ??
    buildPersonaPreview({
      assistantName: name.trim() || "Nina",
      tone,
      msgLength,
      emojis,
      productName,
      priceCents: productPriceCents,
    });

  async function handleGeneratePreview() {
    if (!canUseAi) {
      toast("Configure sua chave da Anthropic em Configurações para usar a IA.", "danger");
      return;
    }
    setGenerating(true);
    const result = await generatePersonaPreview({
      assistantName: name.trim() || "Nina",
      speaksAs,
      tone,
      msgLength,
      emojis,
    });
    setGenerating(false);
    if (result.ok && result.text) setAiPreview(result.text);
    else toast(result.error ?? "Não foi possível gerar a prévia.", "danger");
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Input
          label="Nome do assistente"
          requiredMark
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />

        <Select
          label="Fala como"
          value={speaksAs}
          onChange={(e) => setSpeaksAs(e.target.value as SpeaksAsDto)}
        >
          {SPEAKS_AS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div>
          <FieldLabel>Tom</FieldLabel>
          <Segmented<ToneDto>
            className="w-full [&>button]:flex-1"
            options={TONE_OPTIONS}
            value={tone}
            onChange={setTone}
          />
        </div>

        <div>
          <FieldLabel>Tamanho das mensagens</FieldLabel>
          <Segmented<MsgLengthDto>
            options={MSG_LENGTH_OPTIONS}
            value={msgLength}
            onChange={setMsgLength}
          />
        </div>

        <div className="divide-y divide-hairline-soft border-t border-hairline-soft">
          <div className="flex items-center justify-between gap-4 py-4">
            <span className="text-[13px] text-ink">Usa emojis</span>
            <Toggle checked={emojis} onChange={setEmojis} />
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-[13px] text-ink">Ativa 24/7</p>
              <p className="mt-0.5 text-xs text-ink-3">
                Desligue para limitar a uma janela de horário.
              </p>
            </div>
            <Toggle checked={always} onChange={setAlways} />
          </div>
        </div>

        {!always && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Início da janela"
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
            <Input
              label="Fim da janela"
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Painel direito: PRÉVIA DA MENSAGEM */}
      <Card>
        <Overline className="mb-4">Prévia da mensagem</Overline>
        <div className="space-y-3">
          <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink">
            Oi! Quanto custa o curso?
          </div>
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
            {previewText}
          </div>
          <p className="text-right text-[11px] text-ink-3">{name.trim() || "Nina"} · IA</p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="mt-4 w-full"
          loading={generating}
          onClick={() => void handleGeneratePreview()}
        >
          Gerar prévia com IA
        </Button>
        {!canUseAi && (
          <p className="mt-2 text-[11.5px] text-ink-3">
            Configure sua chave da Anthropic em Configurações para gerar com IA — a prévia acima
            é simulada a partir das suas configurações.
          </p>
        )}
      </Card>
    </div>
  );
}
