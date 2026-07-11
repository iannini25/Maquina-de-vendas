"use server";

import { prisma, type CredentialProvider } from "@vendaflow/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";

import {
  computeSetupStatus,
  reverifyCredential,
  saveAndVerifyCredential,
} from "./service";
import { PROVIDER_SPECS } from "./providers";
import type { VerifyResult } from "./verify";

const providerEnum = z.enum([
  "ANTHROPIC",
  "VOYAGE",
  "EVOLUTION",
  "RESEND",
  "S3",
  "META_PIXEL",
  "GOOGLE_TAG",
  "HOTMART",
  "KIWIFY",
  "EDUZZ",
  "STRIPE",
  "EXPLORIUM",
  "HIGGSFIELD",
]);

export interface CredentialActionResult extends VerifyResult {
  status: "OK" | "ERROR";
}

export async function saveCredentialAction(
  provider: string,
  values: Record<string, string>,
): Promise<CredentialActionResult> {
  const ctx = await requireWorkspace();
  const parsed = providerEnum.safeParse(provider);
  if (!parsed.success) return { ok: false, status: "ERROR", error: "Provedor inválido" };

  const cleanValues = z.record(z.string(), z.string().max(2000)).parse(values);

  const result = await saveAndVerifyCredential(
    ctx.workspaceId,
    ctx.workspaceSlug,
    parsed.data as CredentialProvider,
    cleanValues,
  );

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: result.ok ? "credential.verified" : "credential.failed",
    entity: "Credential",
    entityId: parsed.data,
    data: { provider: parsed.data, ok: result.ok, error: result.error ?? null },
    notify: result.ok ? undefined : ["notify"],
  });

  revalidatePath("/setup");
  revalidatePath("/configuracoes");
  return { ...result, status: result.ok ? "OK" : "ERROR" };
}

export async function reverifyCredentialAction(
  provider: string,
): Promise<CredentialActionResult> {
  const ctx = await requireWorkspace();
  const parsed = providerEnum.safeParse(provider);
  if (!parsed.success) return { ok: false, status: "ERROR", error: "Provedor inválido" };

  const result = await reverifyCredential(
    ctx.workspaceId,
    ctx.workspaceSlug,
    parsed.data as CredentialProvider,
  );

  revalidatePath("/setup");
  revalidatePath("/configuracoes");
  return { ...result, status: result.ok ? "OK" : "ERROR" };
}

export async function reverifyAllAction(): Promise<Record<string, boolean>> {
  const ctx = await requireWorkspace();
  const outcome: Record<string, boolean> = {};

  for (const spec of PROVIDER_SPECS) {
    const existing = await prisma.credential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: ctx.workspaceId, provider: spec.provider },
      },
    });
    if (!existing && spec.provider !== "S3") continue;
    const result = await reverifyCredential(ctx.workspaceId, ctx.workspaceSlug, spec.provider);
    outcome[spec.provider] = result.ok;
  }

  revalidatePath("/setup");
  revalidatePath("/configuracoes");
  return outcome;
}

export interface ReleaseResult {
  ok: boolean;
  error?: string;
}

/** [Liberar sistema] — só com obrigatórios verdes. */
export async function releaseSystemAction(): Promise<ReleaseResult> {
  const ctx = await requireWorkspace();
  const status = await computeSetupStatus(ctx.workspaceId);

  if (!status.canRelease) {
    return {
      ok: false,
      error: `Faltam credenciais obrigatórias: ${status.requiredPending.join(", ")}`,
    };
  }

  await prisma.setupState.update({
    where: { workspaceId: ctx.workspaceId },
    data: { completedAt: new Date() },
  });

  const cookieStore = await cookies();
  cookieStore.set("vf-setup-done", "1", { httpOnly: true, sameSite: "lax", path: "/" });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "setup.completed",
    entity: "SetupState",
    entityId: ctx.workspaceId,
    notify: ["notify"],
  });

  return { ok: true };
}
