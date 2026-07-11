"use client";

/**
 * Topbar contextual do protótipo: título + subtítulo por tela, busca central
 * ⌘K, sino e CTA primário em pílula. Renderizada no topo de cada página.
 */
export function PageHeader({
  title,
  subtitle,
  selector,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Slot para o seletor de produto/pipeline (Pipeline e Inbox). */
  selector?: React.ReactNode;
  /** CTA primário e ações extras da tela. */
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-hairline-soft bg-bg/80 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[17px] font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="truncate text-[11.5px] text-ink-3">{subtitle}</p>}
        </div>
        {selector}
      </div>

      <div className="mx-auto hidden w-full max-w-sm lg:block">
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent("vf:open-search"))}
          className="flex w-full items-center gap-2 rounded-[11px] border border-hairline bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-3 transition-colors duration-[130ms] hover:border-brand-3/40"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Buscar leads, conversas, campanhas…
          <kbd className="ml-auto rounded border border-hairline px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="Notificações"
          onClick={() => document.dispatchEvent(new CustomEvent("vf:open-notifications"))}
          className="relative flex size-9 items-center justify-center rounded-[10px] text-ink-2 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 3-1 4.5-2 5.5h15c-1-1-2-2.5-2-5.5A5.5 5.5 0 0 0 12 4Z" />
            <path d="M10 18.5a2 2 0 0 0 4 0" />
          </svg>
          <span
            aria-hidden
            className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-2"
            data-notification-dot
          />
        </button>
        {actions}
      </div>
    </header>
  );
}
