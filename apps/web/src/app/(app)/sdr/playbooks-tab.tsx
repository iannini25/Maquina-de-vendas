"use client";

import { useState } from "react";

import { EmptyState } from "@/components/ui/misc";
import { PlaybookSlideOver } from "@/components/playbook/playbook-slide-over";
import type { SdrStageDto } from "@/server/sdr/types";

/** Aba Playbooks por estágio: lista real dos estágios → slide-over do Pipeline. */
export function PlaybooksTab({ stages }: { stages: SdrStageDto[] }) {
  const [openStage, setOpenStage] = useState<SdrStageDto | null>(null);

  if (stages.length === 0) {
    return (
      <EmptyState
        title="Nenhum estágio no funil ainda"
        hint="Os estágios do Pipeline aparecem aqui — cada um com o playbook que a IA segue."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setOpenStage(stage)}
            className="rise-in flex items-center gap-3.5 rounded-2xl border border-hairline bg-white/[0.03] px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-[130ms] hover:border-brand-3/40"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: stage.color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-ink">
                {stage.name}
              </span>
              <span className="block truncate text-[12px] text-ink-3">
                SDR · {stage.objective}
              </span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-4 shrink-0 text-ink-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>

      <PlaybookSlideOver
        stageId={openStage?.id ?? null}
        stageName={openStage?.name}
        open={openStage !== null}
        onClose={() => setOpenStage(null)}
      />
    </>
  );
}
