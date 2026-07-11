"use client";

import { cn } from "./cn";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3",
        disabled ? "opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5.5 w-10 shrink-0 rounded-full border transition-colors duration-200 ease-[var(--ease-out)]",
          checked
            ? "border-brand-3/50 bg-[linear-gradient(135deg,#7C3AED,#A855F7)]"
            : "border-hairline bg-surface-3",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-spring)]",
            checked ? "translate-x-[21px]" : "translate-x-[3px]",
          )}
        />
      </button>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-[13px] text-ink">{label}</span>}
          {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
        </span>
      )}
    </label>
  );
}
