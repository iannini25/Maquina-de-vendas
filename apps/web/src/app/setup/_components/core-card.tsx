"use client";

import { CardShell } from "./card-shell";
import { CheckIcon } from "./credential-card";
import type { CoreDetailsDTO } from "./types";

const CORE_LINES: Array<{ key: keyof CoreDetailsDTO["details"]; label: string }> = [
  { key: "encryptionKey", label: "Chave de criptografia" },
  { key: "database", label: "Banco" },
  { key: "redis", label: "Redis" },
  { key: "authSecret", label: "Sessão" },
];

/**
 * Card Núcleo & Segurança — não é credencial: reflete o ambiente do servidor
 * (APP_ENCRYPTION_KEY, DATABASE_URL, REDIS_URL, AUTH_SECRET).
 */
export function CoreCard({ core }: { core: CoreDetailsDTO }) {
  return (
    <CardShell
      icon="shield"
      title="Núcleo & Segurança"
      required
      description="Cifra os segredos e protege o login."
      state={core.ok ? "ok" : "error"}
      error={core.ok ? null : "Variáveis de ambiente ausentes no servidor — confira o .env."}
      hideSecretsNote
      footerLeft={
        <span className="text-[11.5px] text-ink-3">
          Configurado pelo ambiente do servidor — sem chaves para digitar aqui.
        </span>
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {CORE_LINES.map((line) => {
          const ok = core.details[line.key];
          return (
            <div
              key={line.key}
              className="flex items-center gap-2.5 rounded-[11px] border border-hairline bg-white/[0.02] px-3.5 py-2.5"
            >
              <span
                className={
                  ok
                    ? "flex size-5 items-center justify-center rounded-full bg-success/15 text-success"
                    : "flex size-5 items-center justify-center rounded-full bg-danger/15 text-danger"
                }
                aria-hidden
              >
                {ok ? <CheckIcon /> : <span className="text-[11px] leading-none">!</span>}
              </span>
              <span className="text-[12.5px] text-ink">{line.label}</span>
              <span className={`ml-auto text-[11.5px] ${ok ? "text-success" : "text-danger"}`}>
                {ok ? "OK pelo ambiente" : "Ausente"}
              </span>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
