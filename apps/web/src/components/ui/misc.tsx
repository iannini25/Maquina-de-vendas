"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "./cn";

/** Chip de filtro (Todos os estágios · IA cuidando · Aguardando você…). */
export function Chip({
  active,
  onClick,
  className,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-[130ms]",
        active
          ? "border-brand-3/40 bg-brand-soft text-ink"
          : "border-hairline bg-surface-2 text-ink-3 hover:text-ink-2 hover:border-brand-3/25",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Barra de progresso fina (score/temperatura, uso de API). */
export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  className,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "success" | "warn" | "danger";
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const toneClass =
    tone === "success"
      ? "bg-success"
      : tone === "warn"
        ? "bg-warm"
        : tone === "danger"
          ? "bg-danger"
          : "bg-[linear-gradient(90deg,#7C3AED,#A855F7)]";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-[440ms] ease-[var(--ease-out)]", toneClass)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Count-up nos KPIs (token de movimento do protótipo), com respeito a reduced motion. */
export function useCountUp(target: number, durationMs = 440): number {
  const [value, setValue] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const from = previous.current;
    previous.current = target;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cúbico
      setValue(from + (target - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : Math.round(animated).toLocaleString("pt-BR");
  return (
    <span className={cn("tnum", className)}>{display}</span>
  );
}

/** Estado vazio padrão (borda tracejada, ícone, título e dica). */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <span className="mb-1 text-accent">{icon}</span>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-[12.5px] text-ink-3">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Bloco de erro inline padrão. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger",
        className,
      )}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-danger/40 px-3 py-1 text-xs font-semibold hover:bg-danger/15"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/** Dropdown simples ancorado (menu do usuário, seletor de produto). */
export function Dropdown({
  open,
  onClose,
  align = "left",
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-40 mt-1.5 min-w-52 rounded-xl border border-hairline bg-surface-2 p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,.8)] animate-[modal-in_200ms_var(--ease-out)_both]",
        align === "right" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  onClick,
  danger,
  children,
}: {
  onClick?: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-[130ms]",
        danger ? "text-danger hover:bg-danger/10" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
