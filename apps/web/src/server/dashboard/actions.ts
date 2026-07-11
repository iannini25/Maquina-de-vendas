"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { getQueue, QUEUES } from "@/lib/queues";
import { requireWorkspace } from "@/lib/session";

const leadIdSchema = z.string().min(1).max(64);

export interface CobrarLeadResult {
  ok: boolean;
  error?: string;
}

/**
 * [Cobrar] do card "Follow-ups atrasados": enfileira um follow-up manual
 * para a IA cobrar o lead pelo WhatsApp.
 */
export async function cobrarLeadAction(leadIdRaw: string): Promise<CobrarLeadResult> {
  const ctx = await requireWorkspace();

  const parsed = leadIdSchema.safeParse(leadIdRaw);
  if (!parsed.success) return { ok: false, error: "Lead inválido." };

  const lead = await ctx.db.lead.findUnique({
    where: { id: parsed.data },
    select: { id: true, name: true, aiStatus: true, optedOut: true },
  });
  if (!lead) return { ok: false, error: "Lead não encontrado." };
  if (lead.optedOut) return { ok: false, error: "Este lead pediu para não receber mensagens." };
  if (lead.aiStatus === "PAUSED") {
    return { ok: false, error: "A IA está pausada para este lead — retome no Pipeline." };
  }

  try {
    await getQueue(QUEUES.automation).add("manual-followup", {
      workspaceId: ctx.workspaceId,
      leadId: lead.id,
    });
  } catch {
    return { ok: false, error: "Não foi possível enfileirar a cobrança. Tente de novo." };
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "followup.manual_requested",
    entity: "Lead",
    entityId: lead.id,
    data: { leadName: lead.name, origin: "dashboard" },
    notify: ["notify"],
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
