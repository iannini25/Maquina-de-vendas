import type { Prisma } from "@vendaflow/db";
import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import {
  sourceLabel,
  type PipelineLeadDto,
  type PipelineStageDto,
  type ProductOptionDto,
} from "@/server/pipeline/types";

import { PipelineClient } from "./pipeline-client";

export const metadata: Metadata = { title: "Pipeline" };

function lastMessageText(content: Prisma.JsonValue | undefined): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const text = (content as Record<string, unknown>)["text"];
  return typeof text === "string" && text ? text : null;
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; stage?: string }>;
}) {
  const { filtro, stage: stageParam } = await searchParams;
  const ctx = await requireWorkspace();

  const [stages, products, leads] = await Promise.all([
    ctx.db.pipelineStage.findMany({
      orderBy: { order: "asc" },
      include: { playbook: { select: { objective: true } } },
    }),
    ctx.db.productOffer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    ctx.db.lead.findMany({
      orderBy: [{ lastInteractionAt: "desc" }],
      include: {
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true },
            },
          },
        },
      },
    }),
  ]);

  const stageDtos: PipelineStageDto[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    order: s.order,
    isFixed: s.isFixed,
    systemKey: s.systemKey,
    playbookObjective: s.playbook?.objective ?? "",
  }));

  const leadDtos: PipelineLeadDto[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    sourceLabel: sourceLabel(l.source),
    stageId: l.stageId,
    temperature: l.temperature,
    aiStatus: l.aiStatus,
    score: l.score,
    valueCents: l.valueCents,
    summary:
      l.nextActionText ??
      lastMessageText(l.conversations[0]?.messages[0]?.content) ??
      "Sem interações ainda.",
    lastInteractionAt: l.lastInteractionAt?.toISOString() ?? null,
  }));

  const productDtos: ProductOptionDto[] = products;

  const fixedStageIds = new Set(stageDtos.filter((s) => s.isFixed).map((s) => s.id));
  const activeCount = leadDtos.filter((l) => !fixedStageIds.has(l.stageId)).length;

  return (
    <PipelineClient
      stages={stageDtos}
      initialLeads={leadDtos}
      products={productDtos}
      activeCount={activeCount}
      initialStatusFilter={filtro === "aguardando" ? "waiting" : "all"}
      focusStageId={stageParam ?? null}
    />
  );
}
