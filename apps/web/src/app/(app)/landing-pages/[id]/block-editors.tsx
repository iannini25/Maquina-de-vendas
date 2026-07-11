"use client";

import { useState } from "react";

import { Input, Textarea } from "@/components/ui/field";
import { formatBRL, parseBRLToCents } from "@/lib/format";
import type { LandingBlock } from "@/server/landing/blocks";

/** Editores inline por tipo de bloco (coluna central do editor de landing). */

function ListEditor({
  label,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder?: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <Textarea
      label={label}
      hint="um por linha"
      placeholder={placeholder}
      value={items.join("\n")}
      onChange={(event) =>
        onChange(
          event.target.value
            .split("\n")
            .map((line) => line.trimStart())
            .filter((line, index, all) => line.length > 0 || index < all.length - 1),
        )
      }
    />
  );
}

const FORM_FIELDS = [
  { value: "nome", label: "Nome" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
] as const;

export function BlockFields({
  block,
  onChange,
}: {
  block: LandingBlock;
  onChange: (block: LandingBlock) => void;
}) {
  switch (block.kind) {
    case "hero":
      return (
        <div className="space-y-3">
          <Input
            label="Headline"
            value={block.headline}
            onChange={(event) => onChange({ ...block, headline: event.target.value })}
          />
          <Textarea
            label="Subtítulo"
            className="min-h-16"
            value={block.sub}
            onChange={(event) => onChange({ ...block, sub: event.target.value })}
          />
          <Input
            label="Texto do CTA"
            value={block.cta}
            onChange={(event) => onChange({ ...block, cta: event.target.value })}
          />
        </div>
      );

    case "pain":
      return (
        <ListEditor
          label="Dores"
          placeholder={"Decisões comem sua agenda\nRelatórios que ninguém lê"}
          items={block.items}
          onChange={(items) => onChange({ ...block, items })}
        />
      );

    case "method":
      return (
        <ListEditor
          label="Passos do método"
          placeholder={"Diagnóstico da rotina\nAutomação dos rituais"}
          items={block.steps}
          onChange={(steps) => onChange({ ...block, steps })}
        />
      );

    case "proof":
      return (
        <ListEditor
          label="Depoimentos"
          placeholder={"Recuperei minhas sextas-feiras — Rafael, líder de operação"}
          items={block.quotes}
          onChange={(quotes) => onChange({ ...block, quotes })}
        />
      );

    case "offer":
      return <OfferFields block={block} onChange={onChange} />;

    case "faq":
      return (
        <div className="space-y-3">
          {block.items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-[11px] border border-hairline-soft p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    label={`Pergunta ${index + 1}`}
                    value={item.q}
                    onChange={(event) => {
                      const items = block.items.map((current, i) =>
                        i === index ? { ...current, q: event.target.value } : current,
                      );
                      onChange({ ...block, items });
                    }}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remover pergunta ${index + 1}`}
                  onClick={() =>
                    onChange({ ...block, items: block.items.filter((_, i) => i !== index) })
                  }
                  className="mt-6 flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-danger/10 hover:text-danger"
                >
                  ✕
                </button>
              </div>
              <Textarea
                label="Resposta"
                className="min-h-16"
                value={item.a}
                onChange={(event) => {
                  const items = block.items.map((current, i) =>
                    i === index ? { ...current, a: event.target.value } : current,
                  );
                  onChange({ ...block, items });
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...block, items: [...block.items, { q: "", a: "" }] })}
            className="rounded-full border border-hairline bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-[130ms] hover:border-brand-3/40 hover:text-ink"
          >
            + Adicionar pergunta
          </button>
        </div>
      );

    case "cta-whatsapp":
      return (
        <Input
          label="Texto do convite"
          placeholder="Fale agora com a gente no WhatsApp"
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
        />
      );

    case "signup-form":
      return (
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Campos do formulário</p>
          <div className="flex flex-wrap gap-2">
            {FORM_FIELDS.map((field) => {
              const active = block.fields.includes(field.value);
              return (
                <button
                  key={field.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const fields = active
                      ? block.fields.filter((value) => value !== field.value)
                      : [...block.fields, field.value];
                    if (fields.length === 0) return;
                    onChange({ ...block, fields });
                  }}
                  className={
                    active
                      ? "rounded-full border border-brand-3/40 bg-brand-soft px-3.5 py-1.5 text-[12px] font-medium text-ink"
                      : "rounded-full border border-hairline bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2"
                  }
                >
                  {field.label}
                </button>
              );
            })}
          </div>
        </div>
      );
  }
}

function OfferFields({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { kind: "offer" }>;
  onChange: (block: LandingBlock) => void;
}) {
  const [priceText, setPriceText] = useState(() => formatBRL(block.priceCents));

  return (
    <div className="space-y-3">
      <Input
        label="Preço"
        hint="em reais"
        value={priceText}
        onChange={(event) => {
          setPriceText(event.target.value);
          const cents = parseBRLToCents(event.target.value);
          if (cents !== null) onChange({ ...block, priceCents: cents });
        }}
        onBlur={() => setPriceText(formatBRL(block.priceCents))}
      />
      <Input
        label="Garantia"
        placeholder="7 dias de garantia incondicional"
        value={block.guarantee}
        onChange={(event) => onChange({ ...block, guarantee: event.target.value })}
      />
      <ListEditor
        label="Bônus"
        placeholder={"Comunidade fechada\nBiblioteca de prompts"}
        items={block.bonuses}
        onChange={(bonuses) => onChange({ ...block, bonuses })}
      />
    </div>
  );
}
