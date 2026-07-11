"use client";

import { useId, useState } from "react";

import { cn } from "@/components/ui/cn";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

/** Campos do login/signup do protótipo: input com ícone, olho na senha, checkbox roxo. */

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const fieldIcons = {
  mail: (
    <svg viewBox="0 0 24 24" className="size-4" {...strokeProps}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" className="size-4" {...strokeProps}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" className="size-4" {...strokeProps}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" className="size-4" {...strokeProps}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" />
    </svg>
  ),
} as const;

const inputClass =
  "w-full rounded-[11px] border border-hairline bg-surface-2 py-2.5 pl-10 pr-3.5 " +
  "text-[13px] text-ink placeholder:text-ink-3 transition-colors duration-[130ms] " +
  "focus:border-brand-3 focus:outline-none disabled:opacity-50";

export function AuthInput({
  label,
  icon,
  error,
  requiredMark,
  className,
  id: idProp,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: keyof typeof fieldIcons;
  error?: string;
  requiredMark?: boolean;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div>
      <FieldLabel htmlFor={id} required={requiredMark}>
        {label}
      </FieldLabel>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        >
          {fieldIcons[icon]}
        </span>
        <input id={id} className={cn(inputClass, className)} {...props} />
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function AuthPasswordInput({
  label,
  error,
  requiredMark,
  className,
  id: idProp,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  requiredMark?: boolean;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <FieldLabel htmlFor={id} required={requiredMark}>
        {label}
      </FieldLabel>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        >
          {fieldIcons.lock}
        </span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={cn(inputClass, "pr-10", className)}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 transition-colors duration-[130ms] hover:text-ink"
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="size-4" {...strokeProps}>
              <path d="M4 4l16 16" />
              <path d="M9.9 5.2A9.4 9.4 0 0 1 12 5c4.5 0 7.8 3 9.5 7-.6 1.4-1.4 2.6-2.4 3.6M6.6 6.7C5 7.9 3.6 9.7 2.5 12c1.7 4 5 7 9.5 7 1.5 0 2.9-.3 4.1-.9" />
              <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" {...strokeProps}>
              <path d="M2.5 12C4.2 8 7.5 5 12 5s7.8 3 9.5 7c-1.7 4-5 7-9.5 7s-7.8-3-9.5-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Linha "Manter conectado" + "Esqueci minha senha" (hint honesto de self-host). */
export function RememberRow() {
  const { toast } = useToast();
  const [checked, setChecked] = useState(true);
  return (
    <div className="flex items-center justify-between">
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
        <input
          type="checkbox"
          name="remember"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "flex size-[18px] items-center justify-center rounded-[5px] border transition-colors duration-[130ms]",
            checked
              ? "border-brand-3/60 bg-[linear-gradient(135deg,#7C3AED,#A855F7)] text-white"
              : "border-hairline bg-surface-2 text-transparent",
          )}
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        Manter conectado
      </label>
      <button
        type="button"
        onClick={() =>
          toast("Peça ao administrador para redefinir (self-host).")
        }
        className="text-[13px] text-accent transition-colors duration-[130ms] hover:underline"
      >
        Esqueci minha senha
      </button>
    </div>
  );
}
