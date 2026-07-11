import { cn } from "./cn";

/** Primitivas de tabela no padrão do protótipo (header overline, linhas com hover). */

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-hairline bg-white/[0.02]", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-hairline-soft">{children}</tr>
    </thead>
  );
}

export function TH({
  className,
  children,
  sortable,
}: {
  className?: string;
  children: React.ReactNode;
  sortable?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3",
        sortable && "cursor-pointer select-none hover:text-ink-2",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && <span aria-hidden>↕</span>}
      </span>
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">{children}</tbody>;
}

export function TR({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors duration-[130ms]",
        onClick && "cursor-pointer hover:bg-white/[0.03]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3 text-[13px] text-ink-2", className)}>{children}</td>;
}
