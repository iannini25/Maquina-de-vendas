"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useSse } from "@/lib/use-sse";
import { markConversationReadAction } from "@/server/inbox/actions";
import type { InboxData } from "@/server/inbox/types";

import { ContextPanel } from "./context-panel";
import { ConversationList, type InboxFilter } from "./conversation-list";
import { NewConversationModal } from "./new-conversation-modal";
import { Thread } from "./thread";

/**
 * Inbox — 3 colunas (lista 300px | thread | contexto 280px), fiel ao protótipo.
 * A conversa ativa vem do servidor (?c=/?lead=); trocar de conversa navega com
 * transition (skeleton na thread) e o SSE do canal "inbox" atualiza tudo.
 */
export function InboxClient({ data }: { data: InboxData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [readLocal, setReadLocal] = useState<ReadonlySet<string>>(new Set());

  // Realtime: qualquer evento no canal "inbox" ressincroniza a tela.
  useSse(
    ["inbox"],
    useCallback(() => {
      router.refresh();
    }, [router]),
  );

  // ?lead= sem conversa: abre o modal pré-selecionado nesse lead.
  useEffect(() => {
    if (data.pendingLeadId) setModalOpen(true);
  }, [data.pendingLeadId]);

  // Ao abrir uma conversa com não-lidas, zera o contador (otimista + action).
  const activeId = data.active?.id;
  useEffect(() => {
    if (!activeId) return;
    const item = data.conversations.find((c) => c.id === activeId);
    if (!item || item.unreadCount === 0 || readLocal.has(activeId)) return;
    setReadLocal((previous) => new Set(previous).add(activeId));
    void markConversationReadAction(activeId);
  }, [activeId, data.conversations, readLocal]);

  const unreadTotal = useMemo(
    () =>
      data.conversations.filter((c) => c.unreadCount > 0 && !readLocal.has(c.id)).length,
    [data.conversations, readLocal],
  );

  const selectConversation = useCallback(
    (id: string) => {
      if (id === data.active?.id) return;
      startTransition(() => {
        router.push(`/inbox?c=${id}`, { scroll: false });
      });
    },
    [data.active?.id, router],
  );

  const handleStarted = useCallback(
    (conversationId: string) => {
      setModalOpen(false);
      startTransition(() => {
        router.push(`/inbox?c=${conversationId}`, { scroll: false });
      });
    },
    [router],
  );

  const subtitle =
    unreadTotal === 1 ? "1 conversa não lida" : `${unreadTotal} conversas não lidas`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <PageHeader
        title="Inbox"
        subtitle={subtitle}
        selector={
          data.productName ? (
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink-2 md:flex">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-2" />
              <span className="max-w-44 truncate">{data.productName}</span>
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-3.5 text-ink-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          ) : undefined
        }
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Nova conversa
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Button>
        }
      />

      {data.conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            title="Nenhuma conversa ainda"
            hint="Crie a primeira ou conecte seu WhatsApp para receber mensagens aqui."
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Nova conversa
              </Button>
            }
            className="w-full max-w-md"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ConversationList
            items={data.conversations}
            activeId={data.active?.id ?? null}
            readLocal={readLocal}
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
            onSelect={selectConversation}
          />

          <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversa">
            {isPending ? (
              <ThreadSkeleton />
            ) : data.active ? (
              <Thread key={data.active.id} conversation={data.active} />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  title="Selecione uma conversa"
                  hint="Escolha uma conversa na lista ao lado para ver as mensagens."
                  className="w-full max-w-sm border-none"
                />
              </div>
            )}
          </section>

          {data.active && !isPending && (
            <ContextPanel key={`ctx-${data.active.id}`} conversation={data.active} stages={data.stages} />
          )}
        </div>
      )}

      <NewConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leadOptions={data.leadOptions}
        initialLeadId={data.pendingLeadId}
        onStarted={handleStarted}
      />
    </div>
  );
}

/** Skeleton da thread durante a troca de conversa. */
function ThreadSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-hairline-soft px-5">
        <div className="skeleton size-9 rounded-full" />
        <div className="skeleton h-5 w-40" />
        <div className="skeleton ml-auto h-8 w-24 rounded-full" />
      </div>
      <div className="flex-1 space-y-4 p-6">
        <div className="skeleton mx-auto h-6 w-16 rounded-full" />
        <div className="skeleton h-12 w-2/3 rounded-2xl" />
        <div className="skeleton ml-auto h-16 w-1/2 rounded-2xl" />
        <div className="skeleton h-10 w-1/3 rounded-2xl" />
      </div>
      <div className="flex shrink-0 items-center gap-2.5 border-t border-hairline-soft p-4">
        <div className="skeleton h-10 w-36 rounded-[11px]" />
        <div className="skeleton h-10 flex-1 rounded-[11px]" />
        <div className="skeleton size-10 rounded-full" />
      </div>
    </div>
  );
}
