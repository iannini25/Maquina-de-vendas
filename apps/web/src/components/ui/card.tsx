import { cn } from "./cn";

/**
 * Card padrão do protótipo: superfície translúcida + hairline + highlight interno.
 * `hero` aplica o gradiente roxo→escuro do card principal do Dashboard.
 */
export function Card({
  hero = false,
  glow = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hero?: boolean; glow?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        hero
          ? "border-brand-3/30 bg-[linear-gradient(140deg,#1A1330,#0D0D13_60%)]"
          : "border-hairline bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        glow && "shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.45)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  hint,
}: {
  className?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-2", className)}>
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

/** Overline lavanda usado em cards especiais (SUA MÁQUINA HOJE, GARGALO DO FUNIL…). */
export function Overline({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.12em] text-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}
