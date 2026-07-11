/**
 * Provedor WhatsApp via Evolution API v2.
 * Cada workspace possui sua própria instância na Evolution (multi-tenant).
 */

import { z } from "zod";
import { normalizePhone } from "./normalize.js";
import type {
  ChannelButton,
  ChannelProvider,
  ConnectionState,
  NormalizedInboundMessage,
  QrCode,
  SendResult,
} from "./types.js";

/** Tempo máximo de espera por resposta da Evolution API. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Erro tipado de comunicação com a Evolution API (status HTTP + corpo cru). */
export class EvolutionApiError extends Error {
  /** Status HTTP da resposta (408 para timeout do cliente). */
  readonly status: number;
  /** Corpo da resposta como texto (vazio em timeout). */
  readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Evolution API respondeu HTTP ${status}`);
    this.name = "EvolutionApiError";
    this.status = status;
    this.body = body;
  }
}

export interface EvolutionProviderConfig {
  /** URL base do servidor Evolution API v2 (ex.: "https://evo.exemplo.com"). */
  baseUrl: string;
  /** Chave de API enviada no header "apikey". */
  apiKey: string;
  /** Nome da instância deste workspace. */
  instanceName: string;
}

/** Resposta de envio da Evolution: só nos interessa o id da mensagem. */
const sendResponseSchema = z.object({
  key: z.object({ id: z.string() }),
});

/** Resposta de GET /instance/connectionState/{instance}. */
const connectionStateSchema = z.object({
  instance: z.object({ state: z.string() }),
});

/** Resposta de GET /instance/connect/{instance} quando há QR disponível. */
const qrCodeSchema = z.object({
  base64: z.string().min(1),
});

/** Payload do webhook messages.upsert da Evolution v2. */
const inboundWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    key: z.object({
      id: z.string(),
      remoteJid: z.string(),
      fromMe: z.boolean().optional(),
    }),
    pushName: z.string().optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({ text: z.string() }).optional(),
        imageMessage: z
          .object({
            url: z.string().optional(),
            mimetype: z.string().optional(),
            caption: z.string().optional(),
          })
          .optional(),
        documentMessage: z
          .object({
            url: z.string().optional(),
            mimetype: z.string().optional(),
            fileName: z.string().optional(),
            caption: z.string().optional(),
          })
          .optional(),
        audioMessage: z
          .object({
            url: z.string().optional(),
            mimetype: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

/** Checa se o corpo de um webhook é um evento de mensagem recebida (messages.upsert). */
export function isEvolutionMessageEvent(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).event === "messages.upsert"
  );
}

/** Converte messageTimestamp (segundos, número ou string) em Date. */
function toTimestamp(value: number | string | undefined): Date {
  if (value === undefined) return new Date();
  const seconds = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(seconds)) return new Date();
  return new Date(seconds * 1000);
}

/** Remove o domínio do JID: "5511999999999@s.whatsapp.net" → "5511999999999". */
function stripJidDomain(jid: string): string {
  return jid.replace(/@.*$/, "");
}

/**
 * Parseia o webhook messages.upsert da Evolution v2 em uma mensagem normalizada.
 * Retorna null para eventos que não são mensagem, mensagens enviadas por nós
 * (fromMe) e conteúdos não suportados.
 */
export function parseWebhookPayload(body: unknown): NormalizedInboundMessage | null {
  if (!isEvolutionMessageEvent(body)) return null;

  const parsed = inboundWebhookSchema.safeParse(body);
  if (!parsed.success) return null;

  const { key, pushName, messageTimestamp, message } = parsed.data.data;
  if (key.fromMe === true) return null;
  if (!message) return null;

  const base = {
    externalId: key.id,
    from: stripJidDomain(key.remoteJid),
    timestamp: toTimestamp(messageTimestamp),
    ...(pushName !== undefined ? { senderName: pushName } : {}),
  };

  if (message.imageMessage) {
    const { url, mimetype, caption } = message.imageMessage;
    return {
      ...base,
      kind: "IMAGE",
      ...(caption !== undefined ? { text: caption } : {}),
      ...(url !== undefined ? { mediaUrl: url } : {}),
      ...(mimetype !== undefined ? { mediaMimeType: mimetype } : {}),
    };
  }

  if (message.documentMessage) {
    const { url, mimetype, caption } = message.documentMessage;
    return {
      ...base,
      kind: "FILE",
      ...(caption !== undefined ? { text: caption } : {}),
      ...(url !== undefined ? { mediaUrl: url } : {}),
      ...(mimetype !== undefined ? { mediaMimeType: mimetype } : {}),
    };
  }

  if (message.audioMessage) {
    const { url, mimetype } = message.audioMessage;
    return {
      ...base,
      kind: "AUDIO",
      ...(url !== undefined ? { mediaUrl: url } : {}),
      ...(mimetype !== undefined ? { mediaMimeType: mimetype } : {}),
    };
  }

  const text = message.conversation ?? message.extendedTextMessage?.text;
  if (text !== undefined) {
    return { ...base, kind: "TEXT", text };
  }

  return null;
}

/** Erros de timeout/abort do fetch nativo (undici lança DOMException). */
function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export class EvolutionProvider implements ChannelProvider {
  private readonly config: EvolutionProviderConfig;

  constructor(config: EvolutionProviderConfig) {
    this.config = { ...config, baseUrl: config.baseUrl.replace(/\/+$/, "") };
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    const payload = await this.request("POST", `/message/sendText/${this.config.instanceName}`, {
      number: this.toNumber(to),
      text,
    });
    return { externalId: extractExternalId(payload) };
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<SendResult> {
    const payload = await this.request("POST", `/message/sendMedia/${this.config.instanceName}`, {
      number: this.toNumber(to),
      mediatype: "image",
      media: imageUrl,
      ...(caption !== undefined ? { caption } : {}),
    });
    return { externalId: extractExternalId(payload) };
  }

  async sendFile(to: string, fileUrl: string, filename: string): Promise<SendResult> {
    const payload = await this.request("POST", `/message/sendMedia/${this.config.instanceName}`, {
      number: this.toNumber(to),
      mediatype: "document",
      media: fileUrl,
      fileName: filename,
    });
    return { externalId: extractExternalId(payload) };
  }

  async sendButtons(to: string, text: string, buttons: ChannelButton[]): Promise<SendResult> {
    const payload = await this.request("POST", `/message/sendButtons/${this.config.instanceName}`, {
      number: this.toNumber(to),
      title: "",
      description: text,
      footer: "",
      buttons: buttons.map((button) => ({
        type: "reply",
        displayText: button.label,
        id: button.id,
      })),
    });
    return { externalId: extractExternalId(payload) };
  }

  async sendLink(to: string, url: string, previewText?: string): Promise<SendResult> {
    // Evolution gera preview de link no próprio sendText (linkPreview: true).
    const text = previewText !== undefined ? `${previewText}\n${url}` : url;
    const payload = await this.request("POST", `/message/sendText/${this.config.instanceName}`, {
      number: this.toNumber(to),
      text,
      linkPreview: true,
    });
    return { externalId: extractExternalId(payload) };
  }

  async getConnectionState(): Promise<ConnectionState> {
    let payload: unknown;
    try {
      payload = await this.request(
        "GET",
        `/instance/connectionState/${this.config.instanceName}`,
      );
    } catch (error) {
      // Instância inexistente conta como desconectada.
      if (error instanceof EvolutionApiError && error.status === 404) return "DISCONNECTED";
      throw error;
    }

    const parsed = connectionStateSchema.safeParse(payload);
    const state = parsed.success ? parsed.data.instance.state : "close";

    if (state === "open") return "CONNECTED";
    if (state === "connecting") {
      // A Evolution fica em "connecting" enquanto o QR aguarda leitura;
      // se há QR disponível, o estado real é "aguardando pareamento".
      const qr = await this.getQrCode();
      return qr ? "QR_PENDING" : "CONNECTING";
    }
    return "DISCONNECTED";
  }

  async getQrCode(): Promise<QrCode | null> {
    const payload = await this.request("GET", `/instance/connect/${this.config.instanceName}`);
    const parsed = qrCodeSchema.safeParse(payload);
    return parsed.success ? { base64: parsed.data.base64 } : null;
  }

  async createInstance(): Promise<void> {
    await this.request("POST", "/instance/create", {
      instanceName: this.config.instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
  }

  async ensureInstance(): Promise<void> {
    try {
      await this.request("GET", `/instance/connectionState/${this.config.instanceName}`);
    } catch (error) {
      if (error instanceof EvolutionApiError && error.status === 404) {
        await this.createInstance();
        return;
      }
      throw error;
    }
  }

  /** Telefone no formato aceito pela Evolution (dígitos, sem "+"). */
  private toNumber(to: string): string {
    return normalizePhone(to).replace(/^\+/, "");
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          apikey: this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new EvolutionApiError(
          408,
          "",
          `Evolution API: tempo limite de ${REQUEST_TIMEOUT_MS}ms excedido em ${method} ${path}`,
        );
      }
      throw error;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new EvolutionApiError(
        response.status,
        text,
        `Evolution API ${method} ${path} falhou com HTTP ${response.status}`,
      );
    }

    return (await response.json()) as unknown;
  }
}

/** Extrai o id externo (key.id) de uma resposta de envio; vazio se ausente. */
function extractExternalId(payload: unknown): string {
  const parsed = sendResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.key.id : "";
}
