"use client";

import { useRouter } from "next/navigation";

export function Topbar({ userName }: { userName: string }) {
  const router = useRouter();
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline-soft bg-surface-1/80 px-5 backdrop-blur">
      <button
        type="button"
        onClick={() => document.dispatchEvent(new CustomEvent("vf:open-search"))}
        className="flex w-64 items-center gap-2 rounded-[10px] border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink-3 transition-colors duration-[130ms] hover:border-brand-3/40"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        Buscar leads, campanhas…
        <kbd className="ml-auto rounded border border-hairline px-1.5 py-0.5 text-[10px] text-ink-3">⌘K</kbd>
      </button>

      <div className="flex items-center gap-3">
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
        </button>

        <button
          type="button"
          aria-label="Menu da conta"
          onClick={() => router.push("/configuracoes/conta")}
          className="flex size-9 items-center justify-center rounded-full border border-hairline bg-surface-3 text-xs font-semibold text-ink transition-transform duration-[130ms] hover:scale-105"
        >
          {initials || "VF"}
        </button>
      </div>
    </header>
  );
}
