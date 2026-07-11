"use client";

import { cn } from "@/components/ui/cn";

/** Gradientes das thumbs de template (padrão visual do protótipo). */
const THUMB_GRADIENTS = [
  "radial-gradient(120% 140% at 70% 0%, rgba(124,58,237,.45), rgba(13,13,19,.9) 70%)",
  "radial-gradient(120% 140% at 30% 0%, rgba(56,189,248,.28), rgba(13,13,19,.9) 70%)",
  "radial-gradient(120% 140% at 50% 0%, rgba(168,85,247,.3), rgba(13,13,19,.9) 70%)",
  "radial-gradient(120% 140% at 60% 20%, rgba(52,211,153,.22), rgba(13,13,19,.9) 70%)",
];

/** Thumb de template da biblioteca (bloco gradiente + barra com o nome). */
export function TemplateThumb({
  name,
  source,
  seed,
  selected,
  onClick,
  className,
}: {
  name: string;
  source?: "BUILTIN" | "UPLOADED" | "LINK";
  seed: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div
        aria-hidden
        className="h-20 w-full"
        style={{ background: THUMB_GRADIENTS[seed % THUMB_GRADIENTS.length] }}
      />
      <div className="flex items-center justify-between gap-2 border-t border-hairline-soft bg-white/[0.03] px-3 py-2.5">
        <p className="truncate text-[12.5px] font-medium text-ink">{name}</p>
        {source && source !== "BUILTIN" && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-3">
            {source === "LINK" ? "link" : "upload"}
          </span>
        )}
      </div>
    </>
  );

  const frame = cn(
    "overflow-hidden rounded-2xl border transition-all duration-[130ms]",
    selected ? "border-brand-3/70 shadow-[0_0_0_1px_rgba(139,92,246,.35)]" : "border-hairline",
    onClick && "cursor-pointer text-left hover:border-brand-3/40",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={frame}>
        {body}
      </button>
    );
  }
  return <div className={frame}>{body}</div>;
}
