"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { AiStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatDateBR } from "@/lib/format";
import {
  aiSuggestionAction,
  handbackConversationAction,
  sendMessageAction,
  takeoverConversationAction,
} from "@/server/inbox/actions";
import {
  channelLabel,
  type ActiveConversationDto,
  type MessageDto,
} from "@/server/inbox/types";

/**
 * Coluna central: header da conversa, balões com divisor de data e composer.
 * Envio é otimista (balão entra na hora, status QUEUED → ✓/✓✓ via refresh).
 */
export function Thread({ conversation }: { conversation: ActiveConversationDto }) {
  const { toast } = useToast();
  const [composer, setComposer] = useState("");
  const [localMessages, setLocalMessages] = useState<MessageDto[]>([]);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(() => {
    const serverIds = new Set(conversation.messages.map((message) => message.id));
    return [...conversation.messages, ...localMessages.filter((m) => !serverIds.has(m.id))];
  }, [conversation.messages, localMessages]);

  // Sempre colado no fim da conversa (novas mensagens, troca de conversa).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const text = composer.trim();
    if (!text || sending) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: MessageDto = {
      id: tempId,
      direction: "OUT",
      authorType: "HUMAN",
      text,
      status: "QUEUED",
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((current) => [...current, optimistic]);
    setComposer("");
    setSending(true);
    const result = await sendMessageAction({ conversationId: conversation.id, text });
    setSending(false);
    if (result.ok) {
      setLocalMessages((current) =>
        current.map((message) => (message.id === tempId ? result.message : message)),
      );
    } else {
      setLocalMessages((current) =>
        current.map((message) =>
          message.id === tempId ? { ...message, status: "FAILED" } : message,
        ),
      );
      toast(result.error, "danger");
    }
  };

  const handleTakeoverToggle = async () => {
    if (switching) return;
    setSwitching(true);
    const takenByHuman = conversation.state === "HUMAN";
    const result = takenByHuman
      ? await handbackConversationAction(conversation.id)
      : await takeoverConversationAction(conversation.id);
    setSwitching(false);
    if (result.ok) {
      toast(
        takenByHuman
          ? "A IA reassumiu esta conversa."
          : "Você assumiu a conversa — a IA foi pausada.",
      );
    } else {
      toast(result.error, "danger");
    }
  };

  const handleSuggestion = async () => {
    if (suggesting) return;
    setSuggesting(true);
    const result = await aiSuggestionAction(conversation.id);
    setSuggesting(false);
    if (result.ok) {
      setComposer(result.text);
      composerRef.current?.focus();
    } else {
      toast(result.error, result.missingKey ? "brand" : "danger");
    }
  };

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-hairline-soft px-5">
        <Avatar name={conversation.leadName} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{conversation.leadName}</p>
          <p className="truncate text-[11.5px] text-ink-3">
            {channelLabel(conversation.channel)} · {conversation.stageName}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <AiStatusBadge status={conversation.aiStatus} />
          <Button size="sm" loading={switching} onClick={handleTakeoverToggle}>
            {conversation.state === "HUMAN" ? "Devolver pra IA" : "Assumir"}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Sem mensagens ainda"
              hint="Envie a primeira mensagem para começar a conversa."
              className="w-full max-w-sm border-none"
            />
          </div>
        ) : (
          <ol className="space-y-2.5">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const divider =
                !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
              return (
                <li key={message.id}>
                  {divider && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[11px] text-ink-3">
                        {dayLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble message={message} />
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-hairline-soft p-4">
        <button
          type="button"
          onClick={handleSuggestion}
          disabled={suggesting}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-[11px] border border-brand-3/35 bg-brand-soft px-3.5 text-[12.5px] font-semibold text-accent transition-colors duration-[130ms] hover:border-brand-3/60 disabled:pointer-events-none disabled:opacity-55"
        >
          {suggesting ? (
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : (
            <span aria-hidden>✦</span>
          )}
          Sugestão da IA
        </button>
        <input
          ref={composerRef}
          type="text"
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Escreva uma mensagem…"
          aria-label="Escreva uma mensagem"
          className="h-10 min-w-0 flex-1 rounded-[11px] border border-hairline bg-surface-2 px-3.5 text-[13px] text-ink placeholder:text-ink-3 transition-colors duration-[130ms] focus:border-brand-3 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!composer.trim() || sending}
          aria-label="Enviar mensagem"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-[18px] -translate-x-px"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5L3 9.5 21 3Z" />
          </svg>
        </button>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: MessageDto }) {
  const outbound = message.direction === "OUT";
  const seal = message.authorType === "AI" ? "IA" : message.authorType === "HUMAN" ? "Você" : null;
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[72%]", outbound && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-left text-[13px] leading-relaxed",
            outbound
              ? "rounded-br-md bg-[linear-gradient(135deg,#7C3AED,#A855F7)] text-white"
              : "rounded-bl-md bg-surface-3 text-ink",
          )}
        >
          {message.text}
        </div>
        {outbound && (
          <p className="mt-1 flex items-center justify-end gap-1.5 pr-1 text-[10px] text-ink-3">
            {seal && <span className="font-semibold">{seal}</span>}
            <StatusMark status={message.status} />
          </p>
        )}
      </div>
    </div>
  );
}

/** Status do envio no rodapé do balão: enviando · ✓ · ✓✓ · falhou. */
function StatusMark({ status }: { status: MessageDto["status"] }) {
  if (status === "FAILED") {
    return <span className="font-semibold text-danger">falhou</span>;
  }
  if (status === "QUEUED") return <span>enviando…</span>;
  if (status === "SENT") return <span aria-label="Enviada">✓</span>;
  return (
    <span aria-label="Entregue" className={cn(status === "READ" && "text-accent")}>
      ✓✓
    </span>
  );
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Hoje";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Ontem";
  return formatDateBR(date);
}
