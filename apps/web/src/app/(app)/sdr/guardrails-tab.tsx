"use client";

import { useEffect, useRef, useState } from "react";

import { Toggle } from "@/components/ui/toggle";
import { updateGuardrails } from "@/server/sdr/actions";
import { GUARDRAIL_ITEMS, type GuardrailsDto } from "@/server/sdr/types";

import type { SaveHandler } from "./sdr-view";

/** Aba Guardrails: 6 regras com toggle + tag-input de palavras de handoff. */
export function GuardrailsTab({
  guardrails,
  handoffKeywords,
  onRegisterSave,
}: {
  guardrails: GuardrailsDto;
  handoffKeywords: string[];
  onRegisterSave: (handler: SaveHandler) => void;
}) {
  const [rules, setRules] = useState<GuardrailsDto>(guardrails);
  const [keywords, setKeywords] = useState<string[]>(handoffKeywords);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onRegisterSave(async () => {
      // Palavra digitada e não confirmada com Enter também conta.
      const pending = draft.trim().toLowerCase();
      const finalKeywords =
        pending && !keywords.includes(pending) ? [...keywords, pending] : keywords;
      if (pending) {
        setKeywords(finalKeywords);
        setDraft("");
      }
      return updateGuardrails({ guardrails: rules, handoffKeywords: finalKeywords });
    });
  });

  function addKeyword() {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    setKeywords((current) => (current.includes(value) ? current : [...current, value]));
    setDraft("");
  }

  function removeKeyword(keyword: string) {
    setKeywords((current) => current.filter((k) => k !== keyword));
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col gap-3">
        {GUARDRAIL_ITEMS.map((item, index) => (
          <div
            key={item.key}
            className="rise-in flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-white/[0.03] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span className="text-[13px] text-ink">{item.label}</span>
            <Toggle
              checked={rules[item.key]}
              onChange={(checked) => setRules((current) => ({ ...current, [item.key]: checked }))}
            />
          </div>
        ))}
      </div>

      <h3 className="mt-7 mb-2.5 text-[13px] font-semibold text-ink">
        Palavras que disparam handoff para humano
      </h3>
      <div
        role="presentation"
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-2 rounded-[11px] border border-hairline bg-surface-2 px-3 py-2 transition-colors duration-[130ms] focus-within:border-brand-3"
      >
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface-3 px-3 py-1 text-[12px] font-medium text-ink"
          >
            {keyword}
            <button
              type="button"
              aria-label={`Remover palavra ${keyword}`}
              onClick={() => removeKeyword(keyword)}
              className="text-ink-3 transition-colors duration-[130ms] hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addKeyword();
            } else if (e.key === "Backspace" && draft === "" && keywords.length > 0) {
              setKeywords((current) => current.slice(0, -1));
            }
          }}
          onBlur={addKeyword}
          placeholder="Adicionar palavra…"
          aria-label="Adicionar palavra de handoff"
          className="min-w-36 flex-1 bg-transparent py-1 text-[13px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        Quando o lead usar uma dessas palavras, a IA pausa e chama você na hora.
      </p>
    </div>
  );
}
