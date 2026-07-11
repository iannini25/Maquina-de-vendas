"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { getNotifications, globalSearch, type NotificationItem, type SearchHit } from "@/server/global/actions";

import { Badge } from "../ui/badge";
import { EmptyState } from "../ui/misc";

/**
 * Overlays globais do shell: busca ⌘K + painel de notificações do sino.
 * Abrem pelos eventos vf:open-search / vf:open-notifications (PageHeader)
 * e pelo atalho de teclado.
 */

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  lead: "Lead",
  campaign: "Campanha",
  landing: "Landing",
};

export function GlobalOverlays() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    const openNotify = () => setNotifyOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("vf:open-search", openSearch);
    document.addEventListener("vf:open-notifications", openNotify);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("vf:open-search", openSearch);
      document.removeEventListener("vf:open-notifications", openNotify);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      {searchOpen && (
        <CommandPalette
          onClose={() => setSearchOpen(false)}
          onNavigate={(href) => {
            setSearchOpen(false);
            router.push(href);
          }}
        />
      )}
      {notifyOpen && (
        <NotificationsPanel
          onClose={() => setNotifyOpen(false)}
          onNavigate={(href) => {
            setNotifyOpen(false);
            router.push(href);
          }}
        />
      )}
    </>
  );
}

function CommandPalette({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback((value: string) => {
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await globalSearch(value);
          setHits(results);
          setSelected(0);
        } catch {
          setHits([]);
        }
      });
    }, 180);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, hits.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && hits[selected]) {
      onNavigate(hits[selected].href);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" role="dialog" aria-modal="true" aria-label="Busca">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-[fade-in_200ms_var(--ease-out)_both]" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-hairline bg-surface-1 shadow-[0_24px_80px_-16px_rgba(0,0,0,.9)] animate-[modal-in_320ms_var(--ease-out)_both]">
        <div className="flex items-center gap-2.5 border-b border-hairline-soft px-4">
          <svg viewBox="0 0 24 24" className="size-4 text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              runSearch(event.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar leads, campanhas, landing pages…"
            className="w-full bg-transparent py-3.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <kbd className="rounded border border-hairline px-1.5 py-0.5 text-[10px] text-ink-3">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {isPending && query && (
            <div className="space-y-2 p-2">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          )}
          {!isPending && query && hits.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-ink-3">
              Nada encontrado para “{query}”.
            </p>
          )}
          {!query && (
            <p className="px-3 py-6 text-center text-[13px] text-ink-3">
              Digite para buscar no seu workspace.
            </p>
          )}
          {hits.map((hit, index) => (
            <button
              key={`${hit.kind}-${hit.id}`}
              type="button"
              onMouseEnter={() => setSelected(index)}
              onClick={() => onNavigate(hit.href)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-[130ms] ${
                index === selected ? "bg-brand-soft" : "hover:bg-surface-2"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{hit.title}</span>
                <span className="block truncate text-[11.5px] text-ink-3">{hit.subtitle}</span>
              </span>
              <Badge tone={hit.kind === "lead" ? "brand" : hit.kind === "campaign" ? "info" : "muted"}>
                {KIND_LABEL[hit.kind]}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function toneDot(tone: NotificationItem["tone"]): string {
  if (tone === "success") return "bg-success";
  if (tone === "danger") return "bg-danger";
  if (tone === "warn") return "bg-warm";
  return "bg-brand-2";
}

function relative(atIso: string): string {
  const diff = Date.now() - new Date(atIso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

function NotificationsPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    let alive = true;
    getNotifications()
      .then((result) => {
        if (!alive) return;
        setItems(result.items);
        setPendingApprovals(result.pendingApprovals);
      })
      .catch(() => alive && setItems([]));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Notificações">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="absolute right-4 top-16 w-[380px] rounded-2xl border border-hairline bg-surface-1 p-2 shadow-[0_24px_80px_-16px_rgba(0,0,0,.9)] animate-[modal-in_240ms_var(--ease-out)_both]">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold text-ink">Notificações</p>
          {pendingApprovals > 0 && (
            <Badge tone="warn" dot>
              {pendingApprovals} aprovação{pendingApprovals > 1 ? "s" : ""} pendente{pendingApprovals > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items === null && (
            <div className="space-y-2 p-2">
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
            </div>
          )}
          {items?.length === 0 && (
            <div className="p-2">
              <EmptyState title="Tudo em dia" hint="Aprovações, handoffs e alertas aparecem aqui." />
            </div>
          )}
          {items?.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.href)}
              className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-[130ms] hover:bg-surface-2"
            >
              <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${toneDot(item.tone)}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{item.title}</span>
                  <span className="shrink-0 text-[10.5px] text-ink-3">{relative(item.at)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-3">{item.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
