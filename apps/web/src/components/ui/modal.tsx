"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn";

/**
 * Modal central: backdrop escurecido com blur, entrada 320ms ease-out,
 * fecha por X, backdrop e Esc (corrige lacuna do protótipo).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = "max-w-lg",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-[fade-in_200ms_var(--ease-out)_both]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full rounded-2xl border border-hairline bg-surface-1 shadow-2xl",
          "animate-[modal-in_320ms_var(--ease-out)_both]",
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline-soft px-5 py-4">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-hairline-soft px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
