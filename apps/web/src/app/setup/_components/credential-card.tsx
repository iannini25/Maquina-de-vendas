"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  reverifyCredentialAction,
  saveCredentialAction,
  type CredentialActionResult,
} from "@/server/credentials/actions";

import { CardShell, type CardIconName, type CardVisualState } from "./card-shell";
import { DnsTable, type DnsRow } from "./dns-table";
import type { CredentialViewDTO } from "./types";

export type CardMode = "setup" | "settings";

export interface CardStateChange {
  (id: string, state: CardVisualState, error?: string | null): void;
}

// ── Meta dos verificadores (Evolution/Resend) ────────────────────────────

interface EvolutionMeta {
  state: string | null;
  qrBase64: string | null;
  instanceName: string | null;
  webhookWarning: string | null;
}

function readEvolutionMeta(meta: Record<string, unknown> | undefined): EvolutionMeta | null {
  if (!meta) return null;
  return {
    state: typeof meta.state === "string" ? meta.state : null,
    qrBase64: typeof meta.qrBase64 === "string" ? meta.qrBase64 : null,
    instanceName: typeof meta.instanceName === "string" ? meta.instanceName : null,
    webhookWarning: typeof meta.webhookWarning === "string" ? meta.webhookWarning : null,
  };
}

interface ResendMeta {
  domainStatus: string | null;
  records: DnsRow[];
}

function readResendMeta(meta: Record<string, unknown> | undefined): ResendMeta | null {
  if (!meta) return null;
  const rawRecords = Array.isArray(meta.records) ? meta.records : [];
  const records: DnsRow[] = rawRecords.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    return [
      {
        type: typeof record.type === "string" ? record.type : "—",
        host: typeof record.name === "string" ? record.name : "—",
        value: typeof record.value === "string" ? record.value : "—",
      },
    ];
  });
  return {
    domainStatus: typeof meta.domainStatus === "string" ? meta.domainStatus : null,
    records,
  };
}

// ── Campos ────────────────────────────────────────────────────────────────

function initialFieldValues(view: CredentialViewDTO, mode: CardMode): Record<string, string> {
  return Object.fromEntries(
    view.fields.map((field) => [
      field.key,
      mode === "settings" && field.secret ? "" : (view.values[field.key] ?? ""),
    ]),
  );
}

const MASK_PREFIX = "••••";

/**
 * Card de credencial genérico (Setup Gate + Configurações): campos do
 * PROVIDER_SPEC, verificação real via server action, e blocos extras por
 * provedor (QR do WhatsApp, tabela DNS do Resend).
 */
export function CredentialCard({
  view,
  icon,
  mode,
  state,
  errorMessage,
  onStateChange,
}: {
  view: CredentialViewDTO;
  icon: CardIconName;
  mode: CardMode;
  state: CardVisualState;
  errorMessage: string | null;
  onStateChange: CardStateChange;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialFieldValues(view, mode),
  );
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [evolution, setEvolution] = useState<EvolutionMeta | null>(null);
  const [resend, setResend] = useState<ResendMeta | null>(null);
  const firstSecretRef = useRef<HTMLInputElement>(null);

  // Re-sincroniza os campos quando o servidor devolve valores novos
  // (após verificação, revalidatePath atualiza as props).
  const syncKey = `${view.lastCheckAt}|${JSON.stringify(view.values)}`;
  const lastSync = useRef(syncKey);
  useEffect(() => {
    if (lastSync.current === syncKey) return;
    lastSync.current = syncKey;
    setValues(initialFieldValues(view, mode));
    setRevealed(false);
  }, [syncKey, view, mode]);

  function applyResult(result: CredentialActionResult) {
    if (view.provider === "EVOLUTION") setEvolution(readEvolutionMeta(result.meta));
    if (view.provider === "RESEND") setResend(readResendMeta(result.meta));
    onStateChange(view.provider, result.ok ? "ok" : "error", result.error ?? null);
  }

  async function verify() {
    setPending(true);
    onStateChange(view.provider, "verifying", null);
    const result =
      view.fields.length === 0
        ? await reverifyCredentialAction(view.provider)
        : await saveCredentialAction(view.provider, values);
    applyResult(result);
    if (result.ok) toast(`${view.title} — conectado.`, "success");
    else toast(result.error ?? "Falha na verificação.", "danger");
    setPending(false);
  }

  /** Re-verifica sem salvar (Atualizar QR / Verificar DNS). */
  async function reverify() {
    setPending(true);
    onStateChange(view.provider, "verifying", null);
    const result = await reverifyCredentialAction(view.provider);
    applyResult(result);
    if (!result.ok) toast(result.error ?? "Falha na verificação.", "danger");
    setPending(false);
  }

  function showMasked() {
    setRevealed(true);
    setValues((current) => {
      const next = { ...current };
      for (const field of view.fields) {
        if (field.secret) next[field.key] = view.values[field.key] ?? "";
      }
      return next;
    });
  }

  function replaceSecrets() {
    setRevealed(false);
    setValues((current) => {
      const next = { ...current };
      for (const field of view.fields) {
        if (field.secret) next[field.key] = "";
      }
      return next;
    });
    firstSecretRef.current?.focus();
  }

  const hasSecret = view.fields.some((field) => field.secret);
  const visualState = pending ? "verifying" : state;

  const fieldsBlock = view.fields.length > 0 && (
    <div className="grid gap-4 sm:grid-cols-2">
      {view.fields.map((field, index) => (
        <Input
          key={field.key}
          ref={field.secret && index === view.fields.findIndex((f) => f.secret) ? firstSecretRef : undefined}
          label={field.label}
          requiredMark={mode === "setup" && view.required && !field.optional}
          placeholder={
            field.secret && mode === "settings" && !revealed
              ? "••••••••••••"
              : field.placeholder
          }
          value={values[field.key] ?? ""}
          autoComplete="off"
          spellCheck={false}
          onFocus={(event) => {
            // Segredo mascarado: ao focar, limpa para digitar um valor novo.
            if (event.currentTarget.value.startsWith(MASK_PREFIX)) {
              setValues((current) => ({ ...current, [field.key]: "" }));
            }
          }}
          onChange={(event) =>
            setValues((current) => ({ ...current, [field.key]: event.target.value }))
          }
        />
      ))}
    </div>
  );

  // ── Blocos extras por provedor ──────────────────────────────────────────

  const evolutionBlock = view.provider === "EVOLUTION" && (
    <div className="mt-4 rounded-[12px] border border-hairline bg-white/[0.02] p-4">
      <p className="text-[13px] font-semibold text-ink">Parear o WhatsApp</p>
      <p className="mt-0.5 text-[12px] text-ink-3">
        Abra o WhatsApp → Aparelhos conectados → leia o QR Code.
      </p>

      {evolution?.state === "CONNECTED" ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[12px] font-medium text-success">
          <CheckIcon /> WhatsApp conectado
          {evolution.instanceName ? ` · instância ${evolution.instanceName}` : ""}
        </p>
      ) : evolution?.qrBase64 ? (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {/* QR real da Evolution (data URI) — next/image não se aplica aqui */}
          <img
            src={
              evolution.qrBase64.startsWith("data:")
                ? evolution.qrBase64
                : `data:image/png;base64,${evolution.qrBase64}`
            }
            alt="QR Code para parear o WhatsApp"
            className="size-44 rounded-[12px] bg-white p-2"
          />
          <p className="max-w-56 text-[11.5px] text-ink-3">
            O QR expira rápido — se não funcionar, clique em Atualizar QR.
            {evolution.instanceName && (
              <span className="mt-1 block">Instância: {evolution.instanceName}</span>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex h-28 w-44 items-center justify-center rounded-[12px] border border-dashed border-hairline text-center text-[11.5px] text-ink-3">
          O QR Code aparece aqui após verificar
        </div>
      )}

      {evolution?.webhookWarning && (
        <p className="mt-2 text-[11.5px] text-warm">⚠ {evolution.webhookWarning}</p>
      )}

      {evolution?.state !== "CONNECTED" && (
        <Button
          size="sm"
          className="mt-3"
          loading={pending}
          onClick={reverify}
          aria-label="Atualizar QR Code do WhatsApp"
        >
          Atualizar QR
        </Button>
      )}
    </div>
  );

  const resendBlock = view.provider === "RESEND" &&
    resend &&
    resend.domainStatus !== "verified" &&
    resend.records.length > 0 && (
      <div className="mt-4 space-y-3">
        <p className="text-[12px] text-ink-2">
          Domínio com status <span className="font-medium text-warm">{resend.domainStatus ?? "pendente"}</span> — aponte os
          registros abaixo no seu DNS e clique em Verificar DNS.
        </p>
        <DnsTable rows={resend.records} />
        <Button size="sm" loading={pending} onClick={reverify}>
          Verificar DNS
        </Button>
      </div>
    );

  // ── Rodapé ──────────────────────────────────────────────────────────────

  const footer = (
    <>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={verify}
        className="border-brand-3/40 text-ink"
      >
        {mode === "settings" ? "Verificar / Testar" : "Verificar"}
      </Button>
      {mode === "setup" && !view.required && (
        <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "Configurar agora" : "Configurar depois"}
        </Button>
      )}
      {mode === "settings" && hasSecret && (
        <span className="flex items-center gap-3 text-[12px] text-ink-3">
          <button
            type="button"
            onClick={revealed ? () => setRevealed(false) : showMasked}
            className="transition-colors duration-[130ms] hover:text-ink"
          >
            Mostrar
          </button>
          <button
            type="button"
            onClick={replaceSecrets}
            className="transition-colors duration-[130ms] hover:text-ink"
          >
            Substituir
          </button>
        </span>
      )}
    </>
  );

  const hasBody =
    view.fields.length > 0 || view.provider === "EVOLUTION" || view.provider === "RESEND";

  return (
    <CardShell
      icon={icon}
      title={view.title}
      required={view.required}
      description={view.description}
      state={visualState}
      error={errorMessage ?? view.lastError}
      note={view.note}
      footerLeft={footer}
    >
      {!collapsed && hasBody ? (
        <>
          {fieldsBlock}
          {evolutionBlock}
          {resendBlock}
        </>
      ) : null}
    </CardShell>
  );
}

export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
