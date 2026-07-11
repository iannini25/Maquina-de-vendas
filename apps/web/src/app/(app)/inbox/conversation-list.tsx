"use client";

import { useMemo } from "react";

import { Avatar } from "@/components/ui/avatar";
import { AiStatusBadge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/misc";
import { timeAgo } from "@/lib/format";
import { channelLabel, type ConversationItemDto } from "@/server/inbox/types";

export type InboxFilter = "all" | "ai" | "waiting";

const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "ai", label: "IA cuidando" },
  { value: "waiting", label: "Aguardando você" },
];

/** Coluna esquerda: busca, chips de filtro e lista de conversas. */
export function ConversationList({
  items,
  activeId,
  readLocal,
  search,
  onSearch,
  filter,
  onFilter,
  onSelect,
}: {
  items: ConversationItemDto[];
  activeId: string | null;
  readLocal: ReadonlySet<string>;
  search: string;
  onSearch: (value: string) => void;
  filter: InboxFilter;
  onFilter: (value: InboxFilter) => void;
  onSelect: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "ai" && item.aiStatus !== "RUNNING") return false;
      if (filter === "waiting" && item.aiStatus !== "WAITING_HUMAN") return false;
      if (!query) return true;
      return (
        item.leadName.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query)
      );
    });
  }, [items, filter, search]);

  return (
    <aside
      className="flex w-[300px] shrink-0 flex-col border-r border-hairline-soft"
      aria-label="Lista de conversas"
    >
      <div className="shrink-0 space-y-3 p-4 pb-2">
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar conversa…"
            aria-label="Buscar conversa"
            className="w-full rounded-[11px] border border-hairline bg-surface-2 py-2 pl-9 pr-3 text-[12.5px] text-ink placeholder:text-ink-3 transition-colors duration-[130ms] focus:border-brand-3 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((option) => (
            <Chip
              key={option.value}
              active={filter === option.value}
              onClick={() => onFilter(option.value)}
              className="shrink-0 whitespace-nowrap"
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12.5px] text-ink-3">
            Nenhuma conversa encontrada
            {search.trim() ? ` para “${search.trim()}”` : " neste filtro"}.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((item) => {
              const unread = readLocal.has(item.id) ? 0 : item.unreadCount;
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-[130ms]",
                      active
                        ? "border-brand-3/45 bg-surface-2"
                        : "border-transparent hover:bg-surface-2/60",
                    )}
                  >
                    <Avatar name={item.leadName} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-ink">
                          {item.leadName}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-3">
                          {shortTimeAgo(item.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                        {item.preview}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <AiStatusBadge status={item.aiStatus} />
                        <span className="text-[11px] text-ink-3">
                          {channelLabel(item.channel)}
                        </span>
                        {unread > 0 && (
                          <span
                            aria-label={`${unread} não lidas`}
                            className="ml-auto flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-[#08080B]"
                          >
                            {unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** "há 4 min" → "4 min" (formato compacto da lista, como no protótipo). */
function shortTimeAgo(iso: string | null): string {
  const label = timeAgo(iso);
  return label.startsWith("há ") ? label.slice(3) : label;
}
