"use client";

import { forwardRef } from "react";

import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all " +
  "duration-200 ease-[var(--ease-out)] focus-visible:outline-none disabled:opacity-55 " +
  "disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "text-white rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] " +
    "shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] " +
    "hover:brightness-110 active:scale-[.98]",
  secondary:
    "text-ink rounded-full border border-hairline bg-surface-2 hover:bg-surface-3 " +
    "hover:border-brand-3/40 active:scale-[.98]",
  ghost:
    "text-ink-2 rounded-full hover:bg-surface-2 hover:text-ink active:scale-[.98]",
  danger:
    "text-danger rounded-full border border-danger/30 bg-danger/10 hover:bg-danger/20 active:scale-[.98]",
  success:
    "text-success rounded-full border border-success/30 bg-success/10 hover:bg-success/20 active:scale-[.98]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-9.5 px-4.5 text-[13px]",
  lg: "h-11 px-6 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
