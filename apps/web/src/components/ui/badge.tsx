import { cn } from "./cn";

type Tone =
  | "brand" // roxo — IA cuidando
  | "warn" // âmbar — Aguardando você
  | "muted" // cinza — Pausado / Rascunho
  | "success" // verde — Conectado / Ativa / Indexado
  | "danger" // rosa — erro / quente
  | "info" // azul — frio / informativo
  | "hot"
  | "warm"
  | "cold";

const tones: Record<Tone, string> = {
  brand: "bg-brand-soft text-accent border-brand-3/25",
  warn: "bg-warm/[.12] text-warm border-warm/25",
  muted: "bg-white/[.06] text-ink-3 border-hairline",
  success: "bg-success/[.12] text-success border-success/30",
  danger: "bg-danger/[.12] text-danger border-danger/30",
  info: "bg-cold/[.12] text-cold border-cold/30",
  hot: "bg-hot/[.12] text-hot border-hot/30",
  warm: "bg-warm/[.12] text-warm border-warm/25",
  cold: "bg-cold/[.12] text-cold border-cold/30",
};

export function Badge({
  tone = "muted",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Badge de status da IA no lead (RUNNING | WAITING_HUMAN | PAUSED). */
export function AiStatusBadge({ status }: { status: "RUNNING" | "WAITING_HUMAN" | "PAUSED" }) {
  if (status === "RUNNING") return <Badge tone="brand" dot>IA cuidando</Badge>;
  if (status === "WAITING_HUMAN") return <Badge tone="warn" dot>Aguardando você</Badge>;
  return <Badge tone="muted" dot>Pausado</Badge>;
}

export function TemperatureBadge({ temperature }: { temperature: "COLD" | "WARM" | "HOT" }) {
  if (temperature === "HOT") return <Badge tone="hot">Quente</Badge>;
  if (temperature === "WARM") return <Badge tone="warm">Morno</Badge>;
  return <Badge tone="cold">Frio</Badge>;
}
