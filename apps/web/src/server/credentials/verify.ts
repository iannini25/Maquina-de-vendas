import { promises as dns } from "node:dns";

import type { CredentialProvider } from "@vendaflow/db";

import { checkBucketReadWrite } from "@/lib/storage";

/**
 * Verificadores reais por provedor — chamados pelo Setup Gate e Configurações.
 * Cada verificador testa a credencial de verdade (ping de API, RW, DNS).
 */

export interface VerifyResult {
  ok: boolean;
  error?: string;
  /** Dados extras para a UI (QR code, registros DNS, estado da conexão). */
  meta?: Record<string, unknown>;
}

const TIMEOUT = 15_000;

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
}

async function verifyAnthropic(data: Record<string, string>): Promise<VerifyResult> {
  if (!data.apiKey) return { ok: false, error: "Informe a API Key" };
  try {
    const response = await safeFetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: {
        "x-api-key": data.apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (response.status === 401) return { ok: false, error: "API Key inválida" };
    if (!response.ok) return { ok: false, error: `Erro da API (${response.status})` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeNetworkError(error) };
  }
}

async function verifyVoyage(data: Record<string, string>): Promise<VerifyResult> {
  if (!data.apiKey) return { ok: false, error: "Informe a API Key" };
  try {
    const response = await safeFetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: ["teste de conexão"], model: process.env.EMBEDDINGS_MODEL ?? "voyage-3" }),
    });
    if (response.status === 401) return { ok: false, error: "API Key inválida" };
    if (!response.ok) return { ok: false, error: `Erro da API (${response.status})` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeNetworkError(error) };
  }
}

interface EvolutionConfig {
  url: string;
  apiKey: string;
  instanceName: string;
}

export function evolutionConfig(data: Record<string, string>, workspaceSlug: string): EvolutionConfig {
  return {
    url: data.url || process.env.EVOLUTION_URL || "http://localhost:8081",
    apiKey: data.apiKey || process.env.EVOLUTION_GLOBAL_KEY || "",
    instanceName: data.instanceName || `vf-${workspaceSlug}`,
  };
}

async function verifyEvolution(
  data: Record<string, string>,
  workspaceSlug: string,
): Promise<VerifyResult> {
  const config = evolutionConfig(data, workspaceSlug);
  if (!config.apiKey) {
    return { ok: false, error: "Informe a API Key (ou configure EVOLUTION_GLOBAL_KEY no servidor)" };
  }

  try {
    // 1. Instância existe?
    const stateResponse = await safeFetch(
      `${config.url}/instance/connectionState/${config.instanceName}`,
      { headers: { apikey: config.apiKey } },
    );

    if (stateResponse.status === 404) {
      // 2. Cria a instância
      const createResponse = await safeFetch(`${config.url}/instance/create`, {
        method: "POST",
        headers: { apikey: config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: config.instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });
      if (!createResponse.ok) {
        return { ok: false, error: `Falha ao criar instância (${createResponse.status})` };
      }
      const created = (await createResponse.json()) as {
        qrcode?: { base64?: string };
      };
      return {
        ok: true,
        meta: {
          state: "QR_PENDING",
          qrBase64: created.qrcode?.base64 ?? null,
          instanceName: config.instanceName,
        },
      };
    }

    if (stateResponse.status === 401) return { ok: false, error: "API Key inválida" };
    if (!stateResponse.ok) {
      return { ok: false, error: `Erro da Evolution (${stateResponse.status})` };
    }

    const state = (await stateResponse.json()) as {
      instance?: { state?: string };
    };
    const connectionState = state.instance?.state ?? "unknown";

    if (connectionState === "open") {
      return { ok: true, meta: { state: "CONNECTED", instanceName: config.instanceName } };
    }

    // 3. Não conectada — busca QR
    const connectResponse = await safeFetch(
      `${config.url}/instance/connect/${config.instanceName}`,
      { headers: { apikey: config.apiKey } },
    );
    const connect = connectResponse.ok
      ? ((await connectResponse.json()) as { base64?: string; code?: string })
      : {};
    return {
      ok: true,
      meta: {
        state: "QR_PENDING",
        qrBase64: connect.base64 ?? null,
        instanceName: config.instanceName,
      },
    };
  } catch (error) {
    return { ok: false, error: describeNetworkError(error) };
  }
}

/**
 * Configura o webhook messages.upsert da instância Evolution apontando para o
 * nosso endpoint por workspace. Chamado após verificação OK da credencial.
 */
export async function configureEvolutionWebhook(
  data: Record<string, string>,
  workspaceSlug: string,
  webhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = evolutionConfig(data, workspaceSlug);
  try {
    const response = await safeFetch(`${config.url}/webhook/set/${config.instanceName}`, {
      method: "POST",
      headers: { apikey: config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT"],
        },
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Falha ao configurar webhook (${response.status})` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeNetworkError(error) };
  }
}

async function verifyResend(data: Record<string, string>): Promise<VerifyResult> {
  if (!data.apiKey) return { ok: false, error: "Informe a API Key" };
  try {
    const response = await safeFetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${data.apiKey}` },
    });
    if (response.status === 401) return { ok: false, error: "API Key inválida" };
    if (!response.ok) return { ok: false, error: `Erro da API (${response.status})` };

    const body = (await response.json()) as {
      data?: Array<{
        name: string;
        status: string;
        records?: Array<{ record: string; name: string; type: string; value: string; status?: string }>;
      }>;
    };

    const domains = body.data ?? [];
    if (!data.domain) {
      return {
        ok: domains.length > 0,
        error: domains.length === 0 ? "Nenhum domínio cadastrado no Resend" : undefined,
        meta: { domains: domains.map((d) => ({ name: d.name, status: d.status })) },
      };
    }

    const domain = domains.find((d) => d.name === data.domain);
    if (!domain) {
      return {
        ok: false,
        error: `Domínio ${data.domain} não encontrado no Resend — cadastre lá primeiro`,
        meta: { domains: domains.map((d) => ({ name: d.name, status: d.status })) },
      };
    }

    return {
      ok: domain.status === "verified",
      error:
        domain.status === "verified"
          ? undefined
          : `Domínio com status "${domain.status}" — configure os registros DNS abaixo`,
      meta: {
        domainStatus: domain.status,
        records: domain.records ?? [],
      },
    };
  } catch (error) {
    return { ok: false, error: describeNetworkError(error) };
  }
}

async function verifyS3(): Promise<VerifyResult> {
  const result = await checkBucketReadWrite();
  return result.ok
    ? { ok: true, meta: { bucket: process.env.S3_BUCKET } }
    : { ok: false, error: result.error ?? "Bucket sem leitura/escrita" };
}

/** Verifica se os registros DNS do domínio apontam para o IP esperado. */
export async function verifyDomainDns(
  domain: string,
  expectedIp?: string,
): Promise<VerifyResult> {
  try {
    const addresses = await dns.resolve4(domain);
    if (addresses.length === 0) return { ok: false, error: "Domínio não resolve" };
    if (expectedIp && !addresses.includes(expectedIp)) {
      return {
        ok: false,
        error: `Domínio resolve para ${addresses.join(", ")} — esperado ${expectedIp}`,
        meta: { addresses },
      };
    }
    return { ok: true, meta: { addresses } };
  } catch {
    return { ok: false, error: "DNS ainda não propagou (ou domínio inexistente)" };
  }
}

function verifyIdFormat(value: string | undefined, pattern: RegExp, hint: string): VerifyResult {
  if (!value) return { ok: false, error: "Preencha o campo" };
  if (!pattern.test(value)) return { ok: false, error: hint };
  return { ok: true };
}

function describeNetworkError(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") return "Tempo esgotado ao conectar";
  if (error instanceof Error) return `Falha de conexão: ${error.message}`;
  return "Falha de conexão";
}

export async function verifyCredentialData(
  provider: CredentialProvider,
  data: Record<string, string>,
  workspaceSlug: string,
): Promise<VerifyResult> {
  switch (provider) {
    case "ANTHROPIC":
      return verifyAnthropic(data);
    case "VOYAGE":
      return verifyVoyage(data);
    case "EVOLUTION":
      return verifyEvolution(data, workspaceSlug);
    case "RESEND":
      return verifyResend(data);
    case "S3":
      return verifyS3();
    case "META_PIXEL":
      return verifyIdFormat(data.pixelId, /^\d{8,20}$/, "Pixel ID deve ser numérico");
    case "GOOGLE_TAG":
      return verifyIdFormat(data.tagId, /^(G|AW|GTM)-[A-Z0-9]{6,}$/i, "Formato esperado: G-XXXXXXX");
    case "HOTMART":
    case "KIWIFY":
      return data.webhookToken
        ? { ok: true }
        : { ok: false, error: "Informe o token do webhook" };
    case "EDUZZ":
      return data.webhookToken
        ? { ok: true }
        : { ok: false, error: "Informe a chave de assinatura" };
    case "STRIPE":
      return verifyIdFormat(data.webhookSecret, /^whsec_/, "Formato esperado: whsec_…");
    case "EXPLORIUM":
    case "HIGGSFIELD":
      return data.apiKey ? { ok: true } : { ok: false, error: "Informe a API Key" };
    default:
      return { ok: false, error: "Provedor sem verificador" };
  }
}
