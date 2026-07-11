"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { LeadDetail } from "@/components/lead/lead-detail";
import { PlaybookSlideOver } from "@/components/playbook/playbook-slide-over";
import { PageHeader } from "@/components/shell/page-header";
import { AiStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Chip, EmptyState, ProgressBar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatBRL, timeAgo } from "@/lib/format";
import { useSse } from "@/lib/use-sse";
import { moveLeadStage } from "@/server/pipeline/actions";
import type {
  PipelineLeadDto,
  PipelineStageDto,
  ProductOptionDto,
  TemperatureDto,
} from "@/server/pipeline/types";

import { ImportCsvModal } from "./import-csv-modal";
import { NewLeadModal } from "./new-lead-modal";
import { ProductSelector } from "./product-selector";

type StatusFilter = "all" | "ai" | "waiting";
type TempFilter = TemperatureDto | null;

const TEMP_BORDER: Record<TemperatureDto, string> = {
  HOT: "border-l-hot",
  WARM: "border-l-warm",
  COLD: "border-l-cold",
};

const TEMP_LABEL: Record<TemperatureDto, string> = {
  HOT: "Quente",
  WARM: "Morno",
  COLD: "Frio",
};

export function PipelineClient({
  stages,
  initialLeads,
  products,
  activeCount,
  initialStatusFilter,
  focusStageId,
}: {
  stages: PipelineStageDto[];
  initialLeads: PipelineLeadDto[];
  products: ProductOptionDto[];
  activeCount: number;
  initialStatusFilter: StatusFilter;
  focusStageId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [leads, setLeads] = useState(initialLeads);
  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [tempFilter, setTempFilter] = useState<TempFilter>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    products[0]?.id ?? null,
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadStageId, setNewLeadStageId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [playbookStage, setPlaybookStage] = useState<{ id: string; name: string } | null>(null);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [highlightStageId, setHighlightStageId] = useState<string | null>(focusStageId);

  useSse(["pipeline"], () => {
    if (!draggingRef.current) router.refresh();
  });

  // Coluna vinda do Dashboard (?stage=<id>): centraliza e destaca por 2s.
  useEffect(() => {
    if (!focusStageId) return;
    const el = document.querySelector(`[data-stage-col="${focusStageId}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    const timer = setTimeout(() => setHighlightStageId(null), 2400);
    return () => clearTimeout(timer);
  }, [focusStageId]);

  // ── FLIP: captura rects antes da mudança e anima transform depois ───────
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const pendingFlip = useRef<Map<string, DOMRect> | null>(null);

  function captureFlip() {
    const rects = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()));
    pendingFlip.current = rects;
  }

  useLayoutEffect(() => {
    const rects = pendingFlip.current;
    if (!rects) return;
    pendingFlip.current = null;
    cardRefs.current.forEach((el, id) => {
      const before = rects.get(id);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    });
  }, [leads]);

  async function handleDrop(event: React.DragEvent, toStageId: string) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain") || draggingId;
    setDropStageId(null);
    setDraggingId(null);
    draggingRef.current = false;
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === toStageId) return;
    const fromStageId = lead.stageId;

    // Otimista: move na hora com FLIP; rollback se a action falhar.
    captureFlip();
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stageId: toStageId } : l)));

    const result = await moveLeadStage({
      leadId,
      toStageId,
      productOfferId: selectedProductId ?? undefined,
    });

    if (result.ok) {
      if (result.toastText) toast(result.toastText);
      router.refresh();
    } else {
      captureFlip();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stageId: fromStageId } : l)));
      toast(result.error ?? "Não foi possível mover o lead.", "danger");
    }
  }

  function matchesFilters(lead: PipelineLeadDto): boolean {
    if (statusFilter === "ai" && lead.aiStatus !== "RUNNING") return false;
    if (statusFilter === "waiting" && lead.aiStatus !== "WAITING_HUMAN") return false;
    if (tempFilter && lead.temperature !== tempFilter) return false;
    return true;
  }

  const visibleLeads = leads.filter(matchesFilters);

  function cycleTemperature() {
    setTempFilter((current) =>
      current === null ? "HOT" : current === "HOT" ? "WARM" : current === "WARM" ? "COLD" : null,
    );
  }

  function openNewLead(stageId: string | null) {
    setNewLeadStageId(stageId);
    setNewLeadOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Pipeline"
        subtitle={`${activeCount} leads ativos · ${stages.length} estágios`}
        selector={
          <ProductSelector
            products={products}
            value={selectedProductId}
            onSelect={setSelectedProductId}
            onNewPipeline={() => toast("Multi-pipeline chega em breve")}
          />
        }
        actions={
          <Button variant="primary" onClick={() => openNewLead(null)}>
            Novo lead
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

      {/* Filtros + legenda */}
      <div className="flex shrink-0 items-center gap-2 px-6 pt-4">
        <Chip
          active={statusFilter === "all" && tempFilter === null}
          onClick={() => {
            setStatusFilter("all");
            setTempFilter(null);
          }}
        >
          Todos os estágios
        </Chip>
        <Chip
          active={statusFilter === "ai"}
          onClick={() => setStatusFilter((f) => (f === "ai" ? "all" : "ai"))}
        >
          IA cuidando
        </Chip>
        <Chip
          active={statusFilter === "waiting"}
          onClick={() => setStatusFilter((f) => (f === "waiting" ? "all" : "waiting"))}
        >
          Aguardando você
        </Chip>
        <Chip active={tempFilter !== null} onClick={cycleTemperature}>
          {tempFilter === null ? "Temperatura" : `Temperatura · ${TEMP_LABEL[tempFilter]}`}
        </Chip>

        <div className="ml-auto hidden items-center gap-4 text-[11.5px] text-ink-3 lg:flex">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-brand-2" /> IA cuidando
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-warm" /> Aguardando você
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-ink-3" /> Pausado
          </span>
        </div>
      </div>

      {/* Kanban */}
      {stages.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="Nenhum estágio configurado"
            hint="O funil padrão de 12 estágios é criado junto com o workspace. Rode o seed ou contate o suporte."
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 py-4">
          {stages.map((stage, index) => {
            const stageLeads = visibleLeads.filter((l) => l.stageId === stage.id);
            const totalCents = stageLeads.reduce((sum, l) => sum + (l.valueCents ?? 0), 0);
            const isDropTarget = dropStageId === stage.id && draggingId !== null;
            return (
              <section
                key={stage.id}
                data-stage-col={stage.id}
                aria-label={`Estágio ${stage.name}`}
                className={cn(
                  "rise-in flex h-full w-[290px] shrink-0 flex-col rounded-2xl border bg-white/[0.02] transition-colors duration-[130ms]",
                  isDropTarget ? "border-brand-3/60 bg-brand-soft/30" : "border-hairline",
                  highlightStageId === stage.id &&
                    "border-brand-3/60 shadow-[0_0_0_1px_rgba(139,92,246,.35)]",
                )}
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropStageId !== stage.id) setDropStageId(stage.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropStageId((cur) => (cur === stage.id ? null : cur));
                  }
                }}
                onDrop={(e) => void handleDrop(e, stage.id)}
              >
                <header className="px-3.5 pt-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: stage.color }}
                    />
                    <h2 className="truncate text-[13px] font-semibold text-ink">{stage.name}</h2>
                    <span className="tnum text-[12px] text-ink-3">{stageLeads.length}</span>
                    <button
                      type="button"
                      aria-label={`Configurar playbook do estágio ${stage.name}`}
                      onClick={() => setPlaybookStage({ id: stage.id, name: stage.name })}
                      className="ml-auto flex size-6 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-3 hover:text-ink"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="size-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-ink-3">
                    Em jogo · <span className="tnum">{formatBRL(totalCents)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setPlaybookStage({ id: stage.id, name: stage.name })}
                    className="mt-2 flex w-full items-center gap-1.5 truncate rounded-full border border-brand-3/25 bg-brand-soft/60 px-2.5 py-1 text-left text-[11px] text-accent transition-colors duration-[130ms] hover:border-brand-3/45"
                    title={
                      stage.isFixed
                        ? `Fixo · ${stage.systemKey === "WON" ? "Negócio ganho" : "Negócio perdido"}`
                        : `SDR · ${stage.playbookObjective}`
                    }
                  >
                    <span aria-hidden>⚿</span>
                    <span className="truncate">
                      {stage.isFixed
                        ? `Fixo · ${stage.systemKey === "WON" ? "Negócio ganho" : "Negócio perdido"}`
                        : `SDR · ${stage.playbookObjective || "Definir playbook"}`}
                    </span>
                  </button>
                </header>

                <div className="mt-2.5 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-2.5">
                  {stageLeads.map((lead) => (
                    <article
                      key={lead.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(lead.id, el);
                        else cardRefs.current.delete(lead.id);
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", lead.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(lead.id);
                        draggingRef.current = true;
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropStageId(null);
                        draggingRef.current = false;
                      }}
                      onClick={() => setDetailLeadId(lead.id)}
                      className={cn(
                        "cursor-grab rounded-xl border border-hairline border-l-2 bg-surface-2 p-3",
                        "transition-[transform,box-shadow,opacity] duration-[130ms] ease-[var(--ease-out)]",
                        "hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,.8)]",
                        TEMP_BORDER[lead.temperature],
                        draggingId === lead.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar name={lead.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {lead.name}
                          </p>
                          <p className="truncate text-[11px] text-ink-3">• {lead.sourceLabel}</p>
                        </div>
                        <AiStatusBadge status={lead.aiStatus} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-ink-2">
                        {lead.summary}
                      </p>
                      <ProgressBar value={lead.score} className="mt-2.5" />
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="tnum text-[13px] font-bold text-ink">
                          {lead.valueCents !== null ? formatBRL(lead.valueCents) : "—"}
                        </span>
                        <span className="text-[11px] text-ink-3">
                          {timeAgo(lead.lastInteractionAt)}
                        </span>
                      </div>
                    </article>
                  ))}

                  <button
                    type="button"
                    onClick={() => openNewLead(stage.id)}
                    className="w-full rounded-xl border border-dashed border-hairline px-3 py-2.5 text-[12px] font-medium text-ink-3 transition-colors duration-[130ms] hover:border-brand-3/40 hover:text-ink-2"
                  >
                    + Adicionar lead
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Overlays */}
      <NewLeadModal
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        stages={stages.map((s) => ({ id: s.id, name: s.name }))}
        initialStageId={newLeadStageId}
        onImportClick={() => {
          setNewLeadOpen(false);
          setImportOpen(true);
        }}
        onCreated={(message) => {
          setNewLeadOpen(false);
          toast(message);
          router.refresh();
        }}
      />
      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => router.refresh()}
      />
      <PlaybookSlideOver
        stageId={playbookStage?.id ?? null}
        stageName={playbookStage?.name}
        open={playbookStage !== null}
        onClose={() => setPlaybookStage(null)}
      />
      <LeadDetail
        leadId={detailLeadId}
        open={detailLeadId !== null}
        onClose={() => setDetailLeadId(null)}
      />
    </div>
  );
}
