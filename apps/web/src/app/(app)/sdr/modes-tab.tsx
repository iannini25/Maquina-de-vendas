"use client";

import { validatePersonaMarkdown } from "@sales4u/core";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import {
  removeModeMarkdown,
  saveAgentModes,
  setActiveMode,
  uploadModeMarkdown,
} from "@/server/sdr/actions";
import {
  MAX_MODE_MARKDOWN_FILES,
  PERSONA_MODE_TEMPLATE,
  type AgentModeDto,
  type ModeSourceDto,
} from "@/server/sdr/types";

import type { SaveHandler } from "./sdr-view";

/** Aba Modos do agente: até 3 modos (Plataforma OU Markdown), 1 ativo por padrão. */

interface ModeState extends AgentModeDto {
  /** Card vazio que o usuário começou a configurar nesta sessão. */
  started: boolean;
  uploading: boolean;
  mdErrors: string[];
  nameError?: string;
}

function toState(mode: AgentModeDto): ModeState {
  return { ...mode, started: false, uploading: false, mdErrors: [] };
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
}

export function ModesTab({
  modes,
  onRegisterSave,
}: {
  modes: AgentModeDto[];
  onRegisterSave: (handler: SaveHandler) => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<ModeState[]>(modes.map(toState));
  const [activatingSlot, setActivatingSlot] = useState<number | null>(null);

  function patch(slot: number, changes: Partial<ModeState>) {
    setState((all) => all.map((m) => (m.slot === slot ? { ...m, ...changes } : m)));
  }

  useEffect(() => {
    onRegisterSave(async () => {
      const editable = state.filter(
        (m) =>
          (m.configured || m.started) &&
          (m.name.trim() || m.sentiment.trim() || m.guidance.trim() || m.markdownName),
      );
      const missingName = editable.find((m) => !m.name.trim());
      if (missingName) {
        patch(missingName.slot, { nameError: "Dê um nome ao modo." });
        return { ok: false, error: "Dê um nome a cada modo configurado." };
      }
      if (editable.length === 0) return { ok: true };

      const result = await saveAgentModes({
        modes: editable.map((m) => ({
          slot: m.slot,
          name: m.name.trim(),
          sentiment: m.sentiment.trim(),
          guidance: m.guidance.trim(),
        })),
      });
      if (result.ok) {
        setState((all) =>
          all.map((m) =>
            editable.some((e) => e.slot === m.slot)
              ? { ...m, configured: true, nameError: undefined }
              : m,
          ),
        );
      }
      return result;
    });
  });

  async function handleUpload(slot: number, file: File) {
    const mode = state.find((m) => m.slot === slot);
    if (!mode) return;

    if (!file.name.toLowerCase().endsWith(".md")) {
      patch(slot, { mdErrors: ["Formato não suportado — envie um arquivo .md."] });
      return;
    }
    const markdownCount = state.filter((m) => m.markdownName && m.slot !== slot).length;
    if (markdownCount >= MAX_MODE_MARKDOWN_FILES) {
      toast(
        `Limite atingido: máximo ${MAX_MODE_MARKDOWN_FILES} arquivos markdown somando todos os modos.`,
        "danger",
      );
      return;
    }

    const text = await file.text();
    const validation = validatePersonaMarkdown(text);
    if (!validation.ok) {
      patch(slot, { mdErrors: validation.errors });
      return;
    }

    patch(slot, { mdErrors: [], uploading: true });
    const form = new FormData();
    form.set("slot", String(slot));
    form.set("name", mode.name.trim());
    form.set("file", file);
    const result = await uploadModeMarkdown(form);
    patch(slot, { uploading: false });

    if (result.ok) {
      patch(slot, {
        configured: true,
        source: "MARKDOWN",
        markdownName: result.markdownName ?? file.name,
        markdownSize: result.markdownSize ?? file.size,
        name: mode.name.trim() || validation.value?.title || `Modo ${slot}`,
      });
      toast("Arquivo do modo enviado — a IA já lê este markdown.");
    } else if (result.errors && result.errors.length > 0) {
      patch(slot, { mdErrors: result.errors });
    } else {
      toast(result.error ?? "Não foi possível enviar o .md.", "danger");
    }
  }

  async function handleRemoveMarkdown(slot: number) {
    const result = await removeModeMarkdown(slot);
    if (result.ok) {
      patch(slot, { markdownName: null, markdownSize: null, source: "PLATFORM", mdErrors: [] });
      toast("Arquivo removido — o modo volta à configuração da plataforma.");
    } else {
      toast(result.error ?? "Não foi possível remover o arquivo.", "danger");
    }
  }

  async function handleActivate(slot: number) {
    const mode = state.find((m) => m.slot === slot);
    if (!mode) return;
    if (!mode.name.trim()) {
      patch(slot, { nameError: "Dê um nome ao modo." });
      return;
    }
    setActivatingSlot(slot);

    if (!mode.configured) {
      const saved = await saveAgentModes({
        modes: [
          {
            slot,
            name: mode.name.trim(),
            sentiment: mode.sentiment.trim(),
            guidance: mode.guidance.trim(),
          },
        ],
      });
      if (!saved.ok) {
        setActivatingSlot(null);
        toast(saved.error ?? "Não foi possível salvar o modo.", "danger");
        return;
      }
      patch(slot, { configured: true });
    }

    const result = await setActiveMode(slot);
    setActivatingSlot(null);
    if (result.ok) {
      setState((all) => all.map((m) => ({ ...m, isActive: m.slot === slot })));
      toast(`Modo "${mode.name.trim()}" definido como ativo.`);
    } else {
      toast(result.error ?? "Não foi possível ativar o modo.", "danger");
    }
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(PERSONA_MODE_TEMPLATE);
      toast("Template do modo copiado.");
    } catch {
      toast("Não foi possível copiar — copie manualmente do bloco abaixo.", "danger");
    }
  }

  function downloadTemplate() {
    const anchor = document.createElement("a");
    anchor.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(PERSONA_MODE_TEMPLATE)}`;
    anchor.download = "persona-modo.md";
    anchor.click();
  }

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-brand-3/20 bg-brand-soft/40 px-4.5 py-3.5">
        <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-4.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
        <p className="text-[13px] text-ink-2">
          O agente pode ter até 3 modos de atuação (o &quot;sentimento&quot; e o jeito de conduzir a
          conversa). Configure cada modo aqui na plataforma OU anexe um arquivo markdown. Escolha
          qual modo fica ativo por padrão.
        </p>
      </div>

      {/* 3 cards de modo */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {state.map((mode) => (
          <ModeCard
            key={mode.slot}
            mode={mode}
            activating={activatingSlot === mode.slot}
            onPatch={(changes) => patch(mode.slot, changes)}
            onUpload={(file) => void handleUpload(mode.slot, file)}
            onRemoveMarkdown={() => void handleRemoveMarkdown(mode.slot)}
            onActivate={() => void handleActivate(mode.slot)}
          />
        ))}
      </div>

      <p className="rounded-2xl border border-hairline bg-white/[0.02] px-4.5 py-3 text-[12.5px] text-ink-3">
        Limite: <strong className="font-semibold text-ink-2">máximo 3 arquivos markdown</strong>{" "}
        somando todos os modos.
      </p>

      {/* Como montar o arquivo markdown */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="mb-0">Como montar o arquivo markdown</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copyTemplate()}>
              Copiar template
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              Baixar .md
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-ink-3">
          O arquivo vira contexto/persona da IA (via RAG): o agente lê esse markdown para saber
          quem é, como fala e o que nunca pode fazer. Estrutura recomendada:
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre rounded-xl border border-hairline bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-accent/90">
          {PERSONA_MODE_TEMPLATE}
        </pre>
      </Card>
    </div>
  );
}

// ── Card de modo ──────────────────────────────────────────────────────────

function ModeCard({
  mode,
  activating,
  onPatch,
  onUpload,
  onRemoveMarkdown,
  onActivate,
}: {
  mode: ModeState;
  activating: boolean;
  onPatch: (changes: Partial<ModeState>) => void;
  onUpload: (file: File) => void;
  onRemoveMarkdown: () => void;
  onActivate: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!mode.configured && !mode.started) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline px-6 py-8 text-center">
        <p className="text-sm font-semibold text-ink">Modo {mode.slot}</p>
        <p className="text-[12px] text-ink-3">
          Slot livre — crie um novo jeito de conduzir a conversa.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-1"
          onClick={() => onPatch({ started: true })}
        >
          Configurar modo
        </Button>
      </div>
    );
  }

  return (
    <Card className={mode.isActive ? "border-brand-3/40" : undefined} glow={mode.isActive}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          aria-label={`Nome do modo ${mode.slot}`}
          className="w-full min-w-0 bg-transparent font-display text-[15px] font-semibold text-ink outline-none placeholder:text-ink-3"
          placeholder="Nome do modo"
          value={mode.name}
          onChange={(e) => onPatch({ name: e.target.value, nameError: undefined })}
        />
        {mode.isActive && <Badge tone="brand">Ativo</Badge>}
      </div>
      <FieldError>{mode.nameError}</FieldError>

      <Segmented<ModeSourceDto>
        size="sm"
        className="mb-3.5 w-full [&>button]:flex-1"
        options={[
          { value: "PLATFORM", label: "Plataforma" },
          { value: "MARKDOWN", label: "Markdown" },
        ]}
        value={mode.source}
        onChange={(source) => onPatch({ source })}
      />

      {mode.source === "PLATFORM" ? (
        <div className="space-y-3">
          <Input
            aria-label={`Sentimento / tom do modo ${mode.slot}`}
            placeholder="Sentimento / tom"
            value={mode.sentiment}
            onChange={(e) => onPatch({ sentiment: e.target.value })}
          />
          <Textarea
            aria-label={`Como conduzir a conversa no modo ${mode.slot}`}
            placeholder="Como conduzir a conversa…"
            className="min-h-20"
            value={mode.guidance}
            onChange={(e) => onPatch({ guidance: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />

          {mode.markdownName ? (
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-brand-3/35 bg-brand-soft/20 px-4 py-5 text-center">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
              </svg>
              <p className="max-w-full truncate text-[13px] font-semibold text-accent">
                {mode.markdownName}
              </p>
              {mode.markdownSize != null && (
                <p className="text-[11.5px] text-ink-3">{formatKb(mode.markdownSize)}</p>
              )}
              <div className="mt-1 flex items-center gap-3 text-[12px] font-medium">
                <button
                  type="button"
                  className="text-ink-2 hover:text-ink hover:underline"
                  disabled={mode.uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Substituir
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  disabled={mode.uploading}
                  onClick={onRemoveMarkdown}
                >
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={mode.uploading}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) onUpload(file);
              }}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-hairline px-4 py-6 text-center transition-colors duration-[130ms] hover:border-brand-3/40 disabled:opacity-60"
            >
              {mode.uploading ? (
                <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent text-accent" />
              ) : (
                <svg aria-hidden viewBox="0 0 24 24" className="size-5 text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />
                </svg>
              )}
              <span className="text-[12.5px] text-ink-3">
                Arraste o .md aqui ou clique para escolher
              </span>
            </button>
          )}

          {mode.mdErrors.length > 0 && (
            <div className="rounded-xl border border-danger/25 bg-danger/5 p-3">
              {mode.mdErrors.map((error, i) => (
                <FieldError key={i}>{error}</FieldError>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="mt-3.5 w-full"
        disabled={mode.isActive}
        loading={activating}
        onClick={onActivate}
      >
        {mode.isActive ? "Modo ativo" : "Definir como ativo"}
      </Button>
    </Card>
  );
}
