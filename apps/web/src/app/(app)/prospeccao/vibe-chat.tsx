"use client";

import { forwardRef, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  importVibeProspectsAction,
  searchProspectsAction,
  type VibeProspectDto,
} from "@/server/prospecting/actions";

/**
 * Chat inline do assistente Vibe Prospecting (aba Fontes, estado Conectado):
 * descreva o ICP → busca real na API do Explorium → [Importar] / [Gerar CSV].
 */

const GREETING =
  'Oi! Sou o assistente do Vibe Prospecting. Descreva quem você procura — ex.: "diretores de RH em São Paulo, empresas de 50 a 200 funcionários".';

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
  /** Resultados de busca anexados a uma resposta do assistente. */
  results?: { icp: string; prospects: VibeProspectDto[] };
  error?: boolean;
}

function csvEscape(value: string | null): string {
  const text = value ?? "";
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(prospects: VibeProspectDto[]) {
  const lines = [
    "Nome,Empresa,Cargo,E-mail,WhatsApp",
    ...prospects.map((p) =>
      [csvEscape(p.name), csvEscape(p.company), csvEscape(p.role), csvEscape(p.email), csvEscape(p.phone)].join(","),
    ),
  ];
  // BOM para o Excel abrir acentos corretamente
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "prospects-vibe.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export const VibeChat = forwardRef<HTMLInputElement, { onImported: () => void }>(
  function VibeChat({ onImported }, inputRef) {
    const { toast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([
      { id: 0, role: "assistant", text: GREETING },
    ]);
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [importingId, setImportingId] = useState<number | null>(null);
    const nextId = useRef(1);
    const scrollRef = useRef<HTMLDivElement>(null);

    function push(message: Omit<ChatMessage, "id">) {
      setMessages((current) => [...current, { ...message, id: nextId.current++ }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }

    async function handleSearch() {
      const icp = query.trim();
      if (!icp || searching) return;
      setQuery("");
      push({ role: "user", text: icp });
      setSearching(true);
      const result = await searchProspectsAction(icp);
      setSearching(false);

      if (!result.ok || !result.prospects) {
        push({
          role: "assistant",
          text: result.error ?? "Não consegui buscar agora. Tente de novo.",
          error: true,
        });
        return;
      }
      if (result.prospects.length === 0) {
        push({
          role: "assistant",
          text: "Não encontrei prospects para esse perfil. Tente descrever o ICP de outro jeito (cargo, região, tamanho de empresa).",
        });
        return;
      }
      push({
        role: "assistant",
        text: `Encontrei ${result.prospects.length} prospects para esse perfil. Revise abaixo — você pode importar como lista ou baixar o CSV.`,
        results: { icp, prospects: result.prospects },
      });
    }

    async function handleImport(message: ChatMessage) {
      if (!message.results) return;
      setImportingId(message.id);
      const result = await importVibeProspectsAction({
        icp: message.results.icp,
        prospects: message.results.prospects,
      });
      setImportingId(null);
      if (!result.ok) {
        toast(result.error ?? "Não foi possível importar.", "danger");
        return;
      }
      toast(`Lista "${result.listName}" criada com ${result.created} prospects.`, "success");
      onImported();
    }

    return (
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-hairline bg-black/25 p-4">
        <div ref={scrollRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-[linear-gradient(135deg,#7C3AED,#A855F7)] px-4 py-2.5 text-[13px] text-white"
                    : message.error
                      ? "max-w-[85%] rounded-2xl rounded-bl-md border border-danger/30 bg-danger/10 px-4 py-2.5 text-[13px] text-danger"
                      : "max-w-[85%] rounded-2xl rounded-bl-md border border-hairline bg-surface-2 px-4 py-2.5 text-[13px] text-ink"
                }
              >
                <p className="leading-relaxed">{message.text}</p>
                {message.results && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {message.results.prospects.map((prospect, index) => (
                      <div
                        key={`${message.id}-${index}`}
                        className="flex items-baseline justify-between gap-3 rounded-xl border border-hairline-soft bg-black/20 px-3 py-2"
                      >
                        <span className="text-[12.5px] font-semibold text-ink">{prospect.name}</span>
                        <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-ink-3">
                          {[prospect.role, prospect.company].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={importingId === message.id}
                        onClick={() => handleImport(message)}
                      >
                        Importar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          downloadCsv(message.results?.prospects ?? []);
                          toast("CSV gerado.");
                        }}
                      >
                        Gerar CSV
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {searching && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-hairline bg-surface-2 px-4 py-2.5 text-[13px] text-ink-3">
                <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Buscando prospects no Vibe…
              </div>
            </div>
          )}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: diretores de RH em SP, empresas 50–200 funcionários"
            aria-label="Descreva o ICP para o Vibe Prospecting"
            className="w-full rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-3 transition-colors duration-[130ms] focus:border-brand-3 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Buscar prospects"
            disabled={searching || !query.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-[linear-gradient(135deg,#7C3AED,#A855F7)] text-white transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110 active:scale-[.98] disabled:pointer-events-none disabled:opacity-55"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 12 16-7-5 16-3.5-6L4 12Z" />
            </svg>
          </button>
        </form>
      </div>
    );
  },
);
