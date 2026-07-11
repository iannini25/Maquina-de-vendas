"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

/** Estado visual do card de credencial (badge à direita, borda). */
export type CardVisualState = "pending" | "verifying" | "ok" | "error";

export function StatusBadge({ state }: { state: CardVisualState }) {
  if (state === "verifying") {
    return (
      <Badge tone="brand" className="animate-pulse">
        Verificando…
      </Badge>
    );
  }
  if (state === "ok") return <Badge tone="success">Conectado</Badge>;
  if (state === "error") return <Badge tone="danger">Erro</Badge>;
  return <Badge tone="muted">Pendente</Badge>;
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Ícones em traço 1.5px (estilo Iconsax) — um por grupo de credencial. */
export const cardIcons = {
  shield: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M12 3 5 5.7v5c0 4.4 3 8.1 7 9.3 4-1.2 7-4.9 7-9.3v-5L12 3Z" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" />
      <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M12 3.5 13.8 9 19 10.5 13.8 12 12 17.5 10.2 12 5 10.5 10.2 9 12 3.5Z" />
      <path d="M18.5 15.5 19.2 17.8 21.5 18.5 19.2 19.2 18.5 21.5 17.8 19.2 15.5 18.5 17.8 17.8 18.5 15.5Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z" />
      <path d="M9.5 9.5c0 3 2 5 5 5l1-1.5-2-1-1 .8c-.8-.5-1.5-1.3-1.8-2l.8-1-1-2-1 1.7Z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5Z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17.5 4.5-4 3 2.5 3.5-3.5 3.5 3.5" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M6.5 14.5h4" />
    </svg>
  ),
  pixel: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M4 4v16h16" />
      <path d="m7.5 14 3.5-4 3 2.5 4.5-5.5" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
    </svg>
  ),
} satisfies Record<string, React.ReactNode>;

export type CardIconName = keyof typeof cardIcons;

/**
 * Moldura do card de credencial do protótipo: ícone, título, badge
 * obrigatório/opcional, descrição, badge de status à direita, corpo, rodapé
 * com ações + nota "Segredos mascarados · guardados criptografados".
 */
export function CardShell({
  icon,
  title,
  required,
  description,
  state,
  error,
  note,
  headerExtra,
  footerLeft,
  hideSecretsNote,
  children,
}: {
  icon: CardIconName;
  title: string;
  required: boolean;
  description: string;
  state: CardVisualState;
  error?: string | null;
  /** Aviso do provedor (ex.: fallback sem Voyage). */
  note?: string;
  headerExtra?: React.ReactNode;
  footerLeft?: React.ReactNode;
  hideSecretsNote?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "p-6 transition-colors duration-[320ms]",
        state === "ok" && "border-success/35",
        state === "error" && "border-danger/30",
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-brand-3/25 bg-brand-soft text-accent">
          {cardIcons[icon]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {required ? (
              <Badge tone="brand">obrigatório</Badge>
            ) : (
              <Badge tone="muted">opcional</Badge>
            )}
            {headerExtra}
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-2">{description}</p>
        </div>
        <StatusBadge state={state} />
      </div>

      {children && <div className="mt-5">{children}</div>}

      {note && <p className="mt-3 text-[11.5px] text-ink-3">{note}</p>}

      {error && state === "error" && (
        <p role="alert" className="mt-3 rounded-[11px] border border-danger/25 bg-danger/10 px-3.5 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      {(footerLeft || !hideSecretsNote) && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {footerLeft}
          {!hideSecretsNote && (
            <span className="ml-auto text-[11px] text-ink-3">
              Segredos mascarados · guardados criptografados
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
