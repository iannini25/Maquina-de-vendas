import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EvolutionApiError,
  EvolutionProvider,
  isEvolutionMessageEvent,
  parseWebhookPayload,
} from "./evolution.js";

// ---------------------------------------------------------------------------
// Fixtures realistas do webhook messages.upsert da Evolution API v2
// ---------------------------------------------------------------------------

/** Webhook de mensagem de texto simples (conversation). */
const textWebhook = {
  event: "messages.upsert",
  instance: "ws-acme",
  data: {
    key: {
      remoteJid: "5511999999999@s.whatsapp.net",
      fromMe: false,
      id: "3EB0C431C26A1916E07E",
    },
    pushName: "Maria Silva",
    message: { conversation: "Oi, quero saber o preço do plano" },
    messageType: "conversation",
    messageTimestamp: 1720000000,
    instanceId: "af7f5f8a-1b2c-4d5e-8f90-abcdef123456",
    source: "android",
  },
  destination: "https://app.vendaflow.com/api/webhooks/evolution",
  date_time: "2026-07-10T09:00:00.000Z",
  sender: "5511888888888@s.whatsapp.net",
  server_url: "https://evo.vendaflow.com",
  apikey: "B6D9F1E2-3C4A-4B5D-9E8F-0123456789AB",
};

/** Webhook de texto com link (extendedTextMessage). */
const extendedTextWebhook = {
  event: "messages.upsert",
  instance: "ws-acme",
  data: {
    key: {
      remoteJid: "5521988887777@s.whatsapp.net",
      fromMe: false,
      id: "BAE5F4C3D2A1B0E9",
    },
    pushName: "João Souza",
    message: {
      extendedTextMessage: { text: "Vi esse anúncio https://vendaflow.com/promo" },
    },
    messageType: "extendedTextMessage",
    messageTimestamp: "1720000100",
  },
};

/** Webhook de imagem com legenda. */
const imageWebhook = {
  event: "messages.upsert",
  instance: "ws-acme",
  data: {
    key: {
      remoteJid: "5511999999999@s.whatsapp.net",
      fromMe: false,
      id: "9A8B7C6D5E4F3210",
    },
    pushName: "Maria Silva",
    message: {
      imageMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7118-24/enc_file",
        mimetype: "image/jpeg",
        caption: "segue o comprovante",
        fileLength: "123456",
        height: 1280,
        width: 720,
      },
    },
    messageType: "imageMessage",
    messageTimestamp: 1720000200,
  },
};

/** Webhook de documento (PDF). */
const documentWebhook = {
  event: "messages.upsert",
  instance: "ws-acme",
  data: {
    key: {
      remoteJid: "5531977776666@s.whatsapp.net",
      fromMe: false,
      id: "DOC123456789",
    },
    pushName: "Carlos Lima",
    message: {
      documentMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7119-24/enc_doc",
        mimetype: "application/pdf",
        fileName: "contrato.pdf",
      },
    },
    messageType: "documentMessage",
    messageTimestamp: 1720000300,
  },
};

/** Webhook de áudio (mensagem de voz). */
const audioWebhook = {
  event: "messages.upsert",
  instance: "ws-acme",
  data: {
    key: {
      remoteJid: "5511999999999@s.whatsapp.net",
      fromMe: false,
      id: "AUDIO987654321",
    },
    pushName: "Maria Silva",
    message: {
      audioMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7117-24/enc_audio",
        mimetype: "audio/ogg; codecs=opus",
        seconds: 12,
        ptt: true,
      },
    },
    messageType: "audioMessage",
    messageTimestamp: 1720000400,
  },
};

/** Mensagem enviada por nós mesmos (fromMe) — deve ser ignorada. */
const fromMeWebhook = {
  event: "messages.upsert",
  instance: "ws-acme",
  data: {
    key: {
      remoteJid: "5511999999999@s.whatsapp.net",
      fromMe: true,
      id: "OUR-OWN-MESSAGE",
    },
    message: { conversation: "Resposta do SDR" },
    messageTimestamp: 1720000500,
  },
};

/** Evento que não é mensagem — deve ser ignorado. */
const connectionUpdateWebhook = {
  event: "connection.update",
  instance: "ws-acme",
  data: { instance: "ws-acme", state: "open", statusReason: 200 },
};

describe("isEvolutionMessageEvent", () => {
  it("aceita messages.upsert", () => {
    expect(isEvolutionMessageEvent(textWebhook)).toBe(true);
  });

  it("rejeita outros eventos e corpos inválidos", () => {
    expect(isEvolutionMessageEvent(connectionUpdateWebhook)).toBe(false);
    expect(isEvolutionMessageEvent(null)).toBe(false);
    expect(isEvolutionMessageEvent("texto")).toBe(false);
    expect(isEvolutionMessageEvent({})).toBe(false);
  });
});

describe("parseWebhookPayload", () => {
  it("normaliza mensagem de texto (conversation)", () => {
    expect(parseWebhookPayload(textWebhook)).toEqual({
      externalId: "3EB0C431C26A1916E07E",
      from: "5511999999999",
      timestamp: new Date(1720000000 * 1000),
      kind: "TEXT",
      text: "Oi, quero saber o preço do plano",
      senderName: "Maria Silva",
    });
  });

  it("normaliza texto com link (extendedTextMessage) e timestamp em string", () => {
    expect(parseWebhookPayload(extendedTextWebhook)).toEqual({
      externalId: "BAE5F4C3D2A1B0E9",
      from: "5521988887777",
      timestamp: new Date(1720000100 * 1000),
      kind: "TEXT",
      text: "Vi esse anúncio https://vendaflow.com/promo",
      senderName: "João Souza",
    });
  });

  it("normaliza imagem com legenda, url e mimetype", () => {
    expect(parseWebhookPayload(imageWebhook)).toEqual({
      externalId: "9A8B7C6D5E4F3210",
      from: "5511999999999",
      timestamp: new Date(1720000200 * 1000),
      kind: "IMAGE",
      text: "segue o comprovante",
      mediaUrl: "https://mmg.whatsapp.net/v/t62.7118-24/enc_file",
      mediaMimeType: "image/jpeg",
      senderName: "Maria Silva",
    });
  });

  it("normaliza documento como FILE", () => {
    expect(parseWebhookPayload(documentWebhook)).toEqual({
      externalId: "DOC123456789",
      from: "5531977776666",
      timestamp: new Date(1720000300 * 1000),
      kind: "FILE",
      mediaUrl: "https://mmg.whatsapp.net/v/t62.7119-24/enc_doc",
      mediaMimeType: "application/pdf",
      senderName: "Carlos Lima",
    });
  });

  it("normaliza áudio como AUDIO", () => {
    expect(parseWebhookPayload(audioWebhook)).toEqual({
      externalId: "AUDIO987654321",
      from: "5511999999999",
      timestamp: new Date(1720000400 * 1000),
      kind: "AUDIO",
      mediaUrl: "https://mmg.whatsapp.net/v/t62.7117-24/enc_audio",
      mediaMimeType: "audio/ogg; codecs=opus",
      senderName: "Maria Silva",
    });
  });

  it("ignora mensagens enviadas por nós (fromMe=true)", () => {
    expect(parseWebhookPayload(fromMeWebhook)).toBeNull();
  });

  it("ignora eventos que não são messages.upsert", () => {
    expect(parseWebhookPayload(connectionUpdateWebhook)).toBeNull();
  });

  it("ignora corpos malformados", () => {
    expect(parseWebhookPayload(null)).toBeNull();
    expect(parseWebhookPayload({ event: "messages.upsert" })).toBeNull();
    expect(parseWebhookPayload({ event: "messages.upsert", data: { key: {} } })).toBeNull();
  });

  it("ignora mensagem sem conteúdo suportado", () => {
    const stickerWebhook = {
      event: "messages.upsert",
      data: {
        key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "STICKER1" },
        message: { stickerMessage: { url: "https://mmg.whatsapp.net/sticker" } },
        messageTimestamp: 1720000600,
      },
    };
    expect(parseWebhookPayload(stickerWebhook)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EvolutionProvider com fetch mockado
// ---------------------------------------------------------------------------

const CONFIG = {
  baseUrl: "https://evo.test",
  apiKey: "secret-key",
  instanceName: "ws-acme",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Recupera a chamada n do mock com narrowing seguro. */
function callAt(mock: ReturnType<typeof vi.fn>, index: number): { url: string; init: RequestInit } {
  const call = mock.mock.calls[index];
  if (!call) throw new Error(`fetch não foi chamado ${index + 1}x`);
  return { url: String(call[0]), init: (call[1] ?? {}) as RequestInit };
}

describe("EvolutionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendText envia POST com apikey e retorna o externalId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: true, id: "MSG-123" },
        message: { conversation: "Olá!" },
        messageTimestamp: "1720000700",
        status: "PENDING",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    const result = await provider.sendText("(11) 99999-9999", "Olá!");

    expect(result).toEqual({ externalId: "MSG-123" });
    const { url, init } = callAt(fetchMock, 0);
    expect(url).toBe("https://evo.test/message/sendText/ws-acme");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).apikey).toBe("secret-key");
    expect(JSON.parse(String(init.body))).toEqual({
      number: "5511999999999",
      text: "Olá!",
    });
  });

  it("sendText lança EvolutionApiError com status e corpo em HTTP 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { status: 401, error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    const error: unknown = await provider
      .sendText("5511999999999", "Olá!")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EvolutionApiError);
    const apiError = error as EvolutionApiError;
    expect(apiError.status).toBe(401);
    expect(apiError.body).toContain("Unauthorized");
    expect(apiError.message).toContain("401");
  });

  it("sendText converte timeout do fetch em EvolutionApiError 408", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    const error: unknown = await provider
      .sendText("5511999999999", "Olá!")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EvolutionApiError);
    const apiError = error as EvolutionApiError;
    expect(apiError.status).toBe(408);
    expect(apiError.message).toContain("tempo limite");
  });

  it("sendFile envia mediatype document com fileName", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { key: { id: "MEDIA-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    const result = await provider.sendFile(
      "5511999999999",
      "https://cdn.vendaflow.com/proposta.pdf",
      "proposta.pdf",
    );

    expect(result).toEqual({ externalId: "MEDIA-1" });
    const { url, init } = callAt(fetchMock, 0);
    expect(url).toBe("https://evo.test/message/sendMedia/ws-acme");
    expect(JSON.parse(String(init.body))).toEqual({
      number: "5511999999999",
      mediatype: "document",
      media: "https://cdn.vendaflow.com/proposta.pdf",
      fileName: "proposta.pdf",
    });
  });

  it("getConnectionState mapeia open para CONNECTED", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { instance: { instanceName: "ws-acme", state: "open" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    await expect(provider.getConnectionState()).resolves.toBe("CONNECTED");
  });

  it("getConnectionState retorna QR_PENDING quando connecting e há QR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { instance: { instanceName: "ws-acme", state: "connecting" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { base64: "data:image/png;base64,iVBORw0KGgo=", code: "abc" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    await expect(provider.getConnectionState()).resolves.toBe("QR_PENDING");
    expect(callAt(fetchMock, 1).url).toBe("https://evo.test/instance/connect/ws-acme");
  });

  it("getConnectionState retorna DISCONNECTED quando a instância não existe (404)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { status: 404, error: "Not Found" }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    await expect(provider.getConnectionState()).resolves.toBe("DISCONNECTED");
  });

  it("getQrCode retorna null quando não há QR disponível", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { instance: { state: "open" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    await expect(provider.getQrCode()).resolves.toBeNull();
  });

  it("ensureInstance cria a instância quando connectionState devolve 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, { status: 404, error: "Not Found" }))
      .mockResolvedValueOnce(
        jsonResponse(201, { instance: { instanceName: "ws-acme", status: "created" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    await provider.ensureInstance();

    const { url, init } = callAt(fetchMock, 1);
    expect(url).toBe("https://evo.test/instance/create");
    expect(JSON.parse(String(init.body))).toEqual({
      instanceName: "ws-acme",
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
  });

  it("ensureInstance não cria nada quando a instância já existe", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { instance: { instanceName: "ws-acme", state: "open" } }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new EvolutionProvider(CONFIG);
    await provider.ensureInstance();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
