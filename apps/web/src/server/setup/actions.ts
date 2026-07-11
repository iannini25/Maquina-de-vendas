"use server";

import { randomBytes } from "node:crypto";

import { prisma } from "@vendaflow/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { requireWorkspace } from "@/lib/session";
import { verifyDomainDns } from "@/server/credentials/verify";

import { parseDomainSettings, type DomainSettings } from "./queries";

/**
 * Actions do Setup Gate (Domínio & DNS) e das Configurações (Conta & Equipe).
 * Workspace/User são modelos de plataforma — prisma cru é permitido aqui.
 */

// ── Domínio & DNS ─────────────────────────────────────────────────────────

const domainsSchema = z.object({
  appDomain: z.string().trim().max(200),
  landingDomain: z.string().trim().max(200),
});

export interface DomainActionResult {
  ok: boolean;
  error?: string;
  domains?: DomainSettings;
}

async function persistDomains(
  workspaceId: string,
  patch: Partial<DomainSettings>,
): Promise<DomainSettings> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { settings: true },
  });
  const settings =
    workspace.settings && typeof workspace.settings === "object"
      ? (workspace.settings as Record<string, unknown>)
      : {};
  const current = parseDomainSettings(settings);
  const merged: DomainSettings = { ...current, ...patch };
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { settings: { ...settings, domains: { ...merged } } },
  });
  return merged;
}

/** Salva os domínios do app/landings em Workspace.settings.domains. */
export async function saveDomainsAction(input: {
  appDomain: string;
  landingDomain: string;
}): Promise<DomainActionResult> {
  const ctx = await requireWorkspace();
  const parsed = domainsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Domínios inválidos" };

  const domains = await persistDomains(ctx.workspaceId, {
    appDomain: parsed.data.appDomain,
    landingDomain: parsed.data.landingDomain,
  });

  revalidatePath("/setup");
  revalidatePath("/configuracoes");
  return { ok: true, domains };
}

function isDevEnvironment(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const appUrl = process.env.APP_URL ?? "";
  return appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
}

/** [Verificar domínio] — salva e resolve o DNS real (em dev, OK pelo ambiente). */
export async function verifyDomainAction(input: {
  appDomain: string;
  landingDomain: string;
}): Promise<DomainActionResult> {
  const ctx = await requireWorkspace();
  const parsed = domainsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Domínios inválidos" };

  const { appDomain, landingDomain } = parsed.data;
  if (!appDomain) {
    return { ok: false, error: "Informe o domínio do app" };
  }

  let ok: boolean;
  let dev = false;
  let lastError: string | null = null;

  if (isDevEnvironment()) {
    ok = true;
    dev = true;
  } else {
    const appResult = await verifyDomainDns(appDomain);
    const landingResult = landingDomain ? await verifyDomainDns(landingDomain) : { ok: true };
    ok = appResult.ok && landingResult.ok;
    lastError = appResult.ok
      ? landingResult.ok
        ? null
        : `Landings: ${landingResult.error ?? "DNS não propagou"}`
      : (appResult.error ?? "DNS não propagou");
  }

  const domains = await persistDomains(ctx.workspaceId, {
    appDomain,
    landingDomain,
    status: ok ? "OK" : "ERROR",
    verifiedAt: new Date().toISOString(),
    lastError,
    dev,
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: ok ? "setup.domain.verified" : "setup.domain.failed",
    entity: "Workspace",
    entityId: ctx.workspaceId,
    data: { appDomain, landingDomain, ok, dev },
  });

  revalidatePath("/setup");
  revalidatePath("/configuracoes");
  return { ok, error: lastError ?? undefined, domains };
}

// ── Conta & Equipe ────────────────────────────────────────────────────────

export interface ProfileActionResult {
  ok: boolean;
  error?: string;
}

/** Atualiza o nome do usuário logado. */
export async function updateProfileNameAction(name: string): Promise<ProfileActionResult> {
  const ctx = await requireWorkspace();
  const parsed = z.string().trim().min(2, "Informe seu nome").max(80).safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nome inválido" };
  }

  await prisma.user.update({ where: { id: ctx.userId }, data: { name: parsed.data } });
  revalidatePath("/configuracoes");
  return { ok: true };
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().email("E-mail inválido"),
});

export interface InviteResult {
  ok: boolean;
  error?: string;
  /** Senha temporária exibida uma única vez (sem envio de e-mail ainda). */
  tempPassword?: string;
  email?: string;
}

/** Convite por e-mail: cria User com senha aleatória + Membership (sem e-mail real ainda). */
export async function inviteMemberAction(input: {
  name: string;
  email: string;
}): Promise<InviteResult> {
  const ctx = await requireWorkspace();
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    return { ok: false, error: "Só o dono ou admin pode convidar membros" };
  }

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { workspaceId: ctx.workspaceId } } },
  });

  if (existing && existing.memberships.length > 0) {
    return { ok: false, error: "Essa pessoa já faz parte do workspace" };
  }

  const tempPassword = randomBytes(9).toString("base64url");

  if (existing) {
    await prisma.membership.create({
      data: { userId: existing.id, workspaceId: ctx.workspaceId, role: "SELLER" },
    });
  } else {
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        memberships: { create: { workspaceId: ctx.workspaceId, role: "SELLER" } },
      },
    });
  }

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "member.invited",
    entity: "Membership",
    entityId: email,
    data: { email, name: parsed.data.name },
  });

  revalidatePath("/configuracoes");
  return {
    ok: true,
    email,
    // Usuário já existente entra com a própria senha — sem senha nova.
    tempPassword: existing ? undefined : tempPassword,
  };
}
