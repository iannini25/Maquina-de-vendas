import type { CredentialProvider, CredentialStatus } from "@sales4u/db";
import {
  decryptCredentialData,
  encryptCredentialData,
  maskSecret,
  prisma,
} from "@sales4u/db";

import { randomBytes } from "node:crypto";

import { PROVIDER_SPECS, providerSpec, REQUIRED_PROVIDERS } from "./providers";
import {
  configureEvolutionWebhook,
  evolutionConfig,
  verifyCredentialData,
  type VerifyResult,
} from "./verify";

/** Garante o WebhookEndpoint (URL + secret) do provedor para este workspace. */
export async function ensureWebhookEndpoint(
  workspaceId: string,
  provider: string,
): Promise<{ url: string; secret: string }> {
  const existing = await prisma.webhookEndpoint.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  if (existing) return { url: existing.url, secret: existing.secret };

  const secret = randomBytes(20).toString("hex");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const path =
    provider === "EVOLUTION"
      ? `/api/webhooks/evolution/${workspaceId}?secret=${secret}`
      : `/api/webhooks/checkout/${provider.toLowerCase()}/${workspaceId}`;
  const url = `${base}${path}`;

  await prisma.webhookEndpoint.create({
    data: { workspaceId, provider, secret, url },
  });
  return { url, secret };
}

/**
 * Serviço de credenciais por workspace: salvar (criptografado), verificar
 * (chamada real), listar mascarado e computar o estado do Setup Gate.
 */

export interface CredentialView {
  provider: CredentialProvider;
  title: string;
  description: string;
  required: boolean;
  note?: string;
  status: CredentialStatus | "MISSING";
  lastCheckAt: string | null;
  lastError: string | null;
  /** Campos com valores mascarados (secret) ou plenos (não-secret). */
  values: Record<string, string>;
  fields: (typeof PROVIDER_SPECS)[number]["fields"];
  docsUrl?: string;
}

export async function listCredentialViews(workspaceId: string): Promise<CredentialView[]> {
  const credentials = await prisma.credential.findMany({ where: { workspaceId } });
  const byProvider = new Map(credentials.map((c) => [c.provider, c]));

  return PROVIDER_SPECS.map((spec) => {
    const credential = byProvider.get(spec.provider);
    let values: Record<string, string> = {};
    if (credential) {
      try {
        const data = decryptCredentialData(credential.dataEncrypted);
        values = Object.fromEntries(
          spec.fields.map((field) => [
            field.key,
            field.secret ? maskSecret(data[field.key] ?? "") : (data[field.key] ?? ""),
          ]),
        );
      } catch {
        values = {};
      }
    }
    return {
      provider: spec.provider,
      title: spec.title,
      description: spec.description,
      required: spec.required,
      note: spec.note,
      status: credential?.status ?? "MISSING",
      lastCheckAt: credential?.lastCheckAt?.toISOString() ?? null,
      lastError: credential?.lastError ?? null,
      values,
      fields: spec.fields,
      docsUrl: spec.docsUrl,
    };
  });
}

/** Salva (mesclando campos secretos não reenviados) e verifica em seguida. */
export async function saveAndVerifyCredential(
  workspaceId: string,
  workspaceSlug: string,
  provider: CredentialProvider,
  incoming: Record<string, string>,
): Promise<VerifyResult> {
  const spec = providerSpec(provider);
  const existing = await prisma.credential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });

  let merged: Record<string, string> = {};
  if (existing) {
    try {
      merged = decryptCredentialData(existing.dataEncrypted);
    } catch {
      merged = {};
    }
  }
  for (const field of spec.fields) {
    const value = incoming[field.key];
    // Campo secreto vazio ou mascarado = manter o valor anterior.
    if (value === undefined || value === "" || value.startsWith("••••")) continue;
    merged[field.key] = value.trim();
  }

  const result = await verifyCredentialData(provider, merged, workspaceSlug);

  // EVOLUTION: persiste a config resolvida (url/instância default) para que
  // worker e webhooks leiam sempre valores completos, e registra o webhook
  // de entrada na instância.
  if (provider === "EVOLUTION" && result.ok) {
    const resolved = evolutionConfig(merged, workspaceSlug);
    merged.url = resolved.url;
    merged.instanceName = resolved.instanceName;
    if (resolved.apiKey) merged.apiKey = resolved.apiKey;

    const endpoint = await ensureWebhookEndpoint(workspaceId, "EVOLUTION");
    const webhook = await configureEvolutionWebhook(merged, workspaceSlug, endpoint.url);
    if (!webhook.ok) {
      result.meta = { ...result.meta, webhookWarning: webhook.error };
    }
  }

  await prisma.credential.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: {
      workspaceId,
      provider,
      dataEncrypted: encryptCredentialData(merged),
      status: result.ok ? "OK" : "ERROR",
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? "Falha na verificação"),
    },
    update: {
      dataEncrypted: encryptCredentialData(merged),
      status: result.ok ? "OK" : "ERROR",
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? "Falha na verificação"),
    },
  });

  return result;
}

/** Reverifica uma credencial já salva sem alterar os dados. */
export async function reverifyCredential(
  workspaceId: string,
  workspaceSlug: string,
  provider: CredentialProvider,
): Promise<VerifyResult> {
  const credential = await prisma.credential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });

  const data =
    credential !== null
      ? (() => {
          try {
            return decryptCredentialData(credential.dataEncrypted);
          } catch {
            return {};
          }
        })()
      : {};

  // S3 e afins verificam pelo ambiente mesmo sem registro salvo.
  const result = await verifyCredentialData(provider, data, workspaceSlug);

  await prisma.credential.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: {
      workspaceId,
      provider,
      dataEncrypted: encryptCredentialData(data),
      status: result.ok ? "OK" : "ERROR",
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? null),
    },
    update: {
      status: result.ok ? "OK" : "ERROR",
      lastCheckAt: new Date(),
      lastError: result.ok ? null : (result.error ?? null),
    },
  });

  return result;
}

/** Lê a credencial decifrada para uso interno (agente, envio, webhooks). */
export async function getCredentialData(
  workspaceId: string,
  provider: CredentialProvider,
): Promise<Record<string, string> | null> {
  const credential = await prisma.credential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  if (!credential || credential.status !== "OK") return null;
  try {
    return decryptCredentialData(credential.dataEncrypted);
  } catch {
    return null;
  }
}

export interface SetupStatus {
  requiredOk: CredentialProvider[];
  requiredPending: CredentialProvider[];
  coreOk: boolean;
  canRelease: boolean;
  completedAt: string | null;
}

/** Núcleo (env do servidor): chave de criptografia + banco + redis. */
export function coreEnvironmentOk(): { ok: boolean; details: Record<string, boolean> } {
  const details = {
    encryptionKey: Boolean(
      process.env.APP_ENCRYPTION_KEY &&
        Buffer.from(process.env.APP_ENCRYPTION_KEY, "base64").length === 32,
    ),
    database: Boolean(process.env.DATABASE_URL),
    redis: Boolean(process.env.REDIS_URL),
    authSecret: Boolean(process.env.AUTH_SECRET),
  };
  return { ok: Object.values(details).every(Boolean), details };
}

export async function computeSetupStatus(workspaceId: string): Promise<SetupStatus> {
  const [credentials, setupState] = await Promise.all([
    prisma.credential.findMany({
      where: { workspaceId, provider: { in: REQUIRED_PROVIDERS } },
    }),
    prisma.setupState.findUnique({ where: { workspaceId } }),
  ]);

  const okSet = new Set(
    credentials.filter((c) => c.status === "OK").map((c) => c.provider),
  );
  const requiredOk = REQUIRED_PROVIDERS.filter((p) => okSet.has(p));
  const requiredPending = REQUIRED_PROVIDERS.filter((p) => !okSet.has(p));
  const core = coreEnvironmentOk();

  return {
    requiredOk,
    requiredPending,
    coreOk: core.ok,
    canRelease: requiredPending.length === 0 && core.ok,
    completedAt: setupState?.completedAt?.toISOString() ?? null,
  };
}
