"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dropdown, DropdownItem } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatBRLShort } from "@/lib/format";
import { moveLeadStageAction } from "@/server/inbox/actions";
import type { ActiveConversationDto, StageOptionDto } from "@/server/inbox/types";

/**
 * Coluna direita: contexto do lead (estágio, valor, score), próxima ação da IA
 * e "Mover estágio" com dropdown real (mesma semântica do pipeline).
 */
export function ContextPanel({
  conversation,
  stages,
}: {
  conversation: ActiveConversationDto;
  stages: StageOptionDto[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  const handleMove = async (stageId: string) => {
    setOpen(false);
    if (stageId === conversation.stageId || moving) return;
    setMoving(true);
    const result = await moveLeadStageAction({
      leadId: conversation.leadId,
      toStageId: stageId,
    });
    setMoving(false);
    if (result.ok) {
      if (result.toastText) toast(result.toastText);
    } else {
      toast(result.error, "danger");
    }
  };

  return (
    <aside
      className="hidden w-[280px] shrink-0 flex-col overflow-y-auto border-l border-hairline-soft p-4 lg:flex"
      aria-label="Contexto do lead"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        Contexto do lead
      </p>

      <dl className="mt-2">
        <ContextRow label="Estágio" value={conversation.stageName} />
        <ContextRow
          label="Valor"
          value={conversation.valueCents != null ? formatBRLShort(conversation.valueCents) : "—"}
        />
        <ContextRow label="Score" value={String(conversation.score)} accent last />
      </dl>

      <div className="mt-4 rounded-2xl border border-brand-3/30 bg-brand-soft/60 p-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent">
          Próxima ação (IA)
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink">
          {conversation.nextActionText ?? "Sem próxima ação registrada para este lead."}
        </p>
      </div>

      <div className="relative mt-4">
        <Button
          className="w-full"
          loading={moving}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          Mover estágio
        </Button>
        <Dropdown open={open} onClose={() => setOpen(false)} className="max-h-72 w-full overflow-y-auto">
          {stages.map((stage) => {
            const current = stage.id === conversation.stageId;
            return (
              <DropdownItem key={stage.id} onClick={() => void handleMove(stage.id)}>
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    current ? "bg-brand-2" : "bg-white/20",
                  )}
                />
                <span className={cn("truncate", current && "font-semibold text-ink")}>
                  {stage.name}
                </span>
                {current && <span className="ml-auto text-[10.5px] text-ink-3">atual</span>}
              </DropdownItem>
            );
          })}
        </Dropdown>
      </div>
    </aside>
  );
}

function ContextRow({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between py-2.5",
        !last && "border-b border-hairline-soft",
      )}
    >
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd
        className={cn(
          "tnum text-[13px] font-semibold",
          accent ? "text-accent" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
