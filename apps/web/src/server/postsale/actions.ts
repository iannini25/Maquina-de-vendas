"use server";

import type { Prisma } from "@vendaflow/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";

import { POST_SALE_FLOW_KEYS } from "./flows";

/** Server Actions do módulo Pós-venda. */

export interface PostSaleActionResult {
  ok: boolean;
  error?: string;
}

const flowInputSchema = z.object({
  key: z.enum(POST_SALE_FLOW_KEYS),
  enabled: z.boolean(),
});

/** Liga/desliga um fluxo automático (persistido em Workspace.settings.postSaleFlows). */
export async function updatePostSaleFlow(
  key: string,
  enabled: boolean,
): Promise<PostSaleActionResult> {
  const ctx = await requireWorkspace();
  const parsed = flowInputSchema.safeParse({ key, enabled });
  if (!parsed.success) return { ok: false, error: "Fluxo inválido" };

  const workspace = await ctx.db.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { settings: true },
  });
  if (!workspace) return { ok: false, error: "Workspace não encontrado" };

  const settings =
    workspace.settings && typeof workspace.settings === "object" && !Array.isArray(workspace.settings)
      ? (workspace.settings as Record<string, unknown>)
      : {};
  const currentFlows =
    settings["postSaleFlows"] &&
    typeof settings["postSaleFlows"] === "object" &&
    !Array.isArray(settings["postSaleFlows"])
      ? (settings["postSaleFlows"] as Record<string, unknown>)
      : {};

  const merged = {
    ...settings,
    postSaleFlows: { ...currentFlows, [parsed.data.key]: parsed.data.enabled },
  };

  await ctx.db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { settings: merged as Prisma.InputJsonValue },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "postsale.flow.updated",
    entity: "Workspace",
    entityId: ctx.workspaceId,
    data: { flow: parsed.data.key, enabled: parsed.data.enabled },
  });

  revalidatePath("/pos-venda");
  return { ok: true };
}

const upsellWindowSchema = z
  .number()
  .int()
  .refine((days) => [3, 7, 14, 30].includes(days), "Janela inválida");

/** Persiste a janela do upsell (dias após a compra) nos ProductOffers do workspace. */
export async function updateUpsellWindow(days: number): Promise<PostSaleActionResult> {
  const ctx = await requireWorkspace();
  const parsed = upsellWindowSchema.safeParse(days);
  if (!parsed.success) return { ok: false, error: "Janela de tempo inválida" };

  await ctx.db.productOffer.updateMany({ data: { upsellWindowDays: parsed.data } });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "postsale.upsell_window.updated",
    entity: "Workspace",
    entityId: ctx.workspaceId,
    data: { upsellWindowDays: parsed.data },
  });

  revalidatePath("/pos-venda");
  return { ok: true };
}

/** Marca uso manual: cria UsageEvent MANUAL_MARK e ativa o AccessGrant. */
export async function markManualUsage(grantId: string): Promise<PostSaleActionResult> {
  const ctx = await requireWorkspace();
  const parsedId = z.string().min(1).safeParse(grantId);
  if (!parsedId.success) return { ok: false, error: "Acesso inválido" };

  const grant = await ctx.db.accessGrant.findUnique({
    where: { id: parsedId.data },
    select: { id: true, firstAccessAt: true, leadId: true },
  });
  if (!grant) return { ok: false, error: "Acesso não encontrado" };

  const now = new Date();
  await ctx.db.usageEvent.create({
    data: {
      accessGrantId: grant.id,
      type: "MANUAL_MARK",
      meta: { markedBy: ctx.userId },
    },
  });
  await ctx.db.accessGrant.update({
    where: { id: grant.id },
    data: {
      status: "ACTIVE",
      lastActivityAt: now,
      firstAccessAt: grant.firstAccessAt ?? now,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "postsale.usage.manual_mark",
    entity: "AccessGrant",
    entityId: grant.id,
    data: { leadId: grant.leadId },
  });

  revalidatePath("/pos-venda");
  return { ok: true };
}
