import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FetchLike, FetchRequestInit } from "./http.js";
import {
  ANTHROPIC_API_URL,
  ANTHROPIC_VERSION,
  AnthropicApiError,
  AnthropicClient,
  resolveModel,
  type LlmRequest,
} from "./router.js";

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;

const ENV_VARS = ["AI_MODEL_CHAT", "AI_MODEL_CLASSIFIER", "AI_MODEL_HEAVY"] as const;

describe("resolveModel", () => {
  const backup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of ENV_VARS) {
      backup[name] = env[name];
      delete env[name];
    }
  });

  afterEach(() => {
    for (const name of ENV_VARS) {
      const value = backup[name];
      if (value === undefined) delete env[name];
      else env[name] = value;
    }
  });

  it("usa os defaults quando não há env", () => {
    expect(resolveModel("chat")).toBe("claude-sonnet-4-6");
    expect(resolveModel("classifier")).toBe("claude-haiku-4-5-20251001");
    expect(resolveModel("heavy")).toBe("claude-opus-4-8");
  });

  it("respeita override por env", () => {
    env.AI_MODEL_CHAT = "modelo-chat-custom";
    env.AI_MODEL_CLASSIFIER = "modelo-classifier-custom";
    env.AI_MODEL_HEAVY = "modelo-heavy-custom";
    expect(resolveModel("chat")).toBe("modelo-chat-custom");
    expect(resolveModel("classifier")).toBe("modelo-classifier-custom");
    expect(resolveModel("heavy")).toBe("modelo-heavy-custom");
  });

  it("ignora env vazia ou só com espaços", () => {
    env.AI_MODEL_CHAT = "   ";
    expect(resolveModel("chat")).toBe("claude-sonnet-4-6");
  });
});

// ---------------------------------------------------------------------------
// AnthropicClient com fetch mockado
// ---------------------------------------------------------------------------

interface CapturedCall {
  url: string;
  init: FetchRequestInit;
}

function makeFetchMock(status: number, body: unknown): { fetchFn: FetchLike; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const fetchFn: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  };
  return { fetchFn, calls };
}

const baseRequest: LlmRequest = {
  model: "claude-sonnet-4-6",
  system: "Você é um agente de vendas.",
  messages: [{ role: "user", content: "oi" }],
  maxTokens: 1024,
  tools: [
    {
      name: "send_text",
      description: "Envia texto",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
    },
  ],
};

describe("AnthropicClient", () => {
  it("envia headers e body corretos e mapeia text + tool_use", async () => {
    const { fetchFn, calls } = makeFetchMock(200, {
      content: [
        { type: "text", text: "vou responder " },
        { type: "text", text: "agora" },
        { type: "tool_use", id: "tu_1", name: "send_text", input: { text: "oi, tudo bem?" } },
      ],
      usage: { input_tokens: 120, output_tokens: 45 },
    });

    const client = new AnthropicClient("sk-ant-teste", fetchFn);
    const response = await client.complete(baseRequest);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(ANTHROPIC_API_URL);
    expect(call.init.method).toBe("POST");
    expect(call.init.headers["x-api-key"]).toBe("sk-ant-teste");
    expect(call.init.headers["anthropic-version"]).toBe(ANTHROPIC_VERSION);
    expect(call.init.headers["content-type"]).toBe("application/json");

    const body = JSON.parse(call.init.body) as Record<string, unknown>;
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe("Você é um agente de vendas.");
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
    expect(body.tools).toEqual([
      {
        name: "send_text",
        description: "Envia texto",
        input_schema: { type: "object", properties: { text: { type: "string" } } },
      },
    ]);

    expect(response.text).toBe("vou responder agora");
    expect(response.toolCalls).toEqual([{ name: "send_text", input: { text: "oi, tudo bem?" } }]);
    expect(response.usage).toEqual({ inputTokens: 120, outputTokens: 45 });
  });

  it("omite tools do body quando não há ferramentas", async () => {
    const { fetchFn, calls } = makeFetchMock(200, {
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 10, output_tokens: 2 },
    });
    const client = new AnthropicClient("sk", fetchFn);
    const request: LlmRequest = { ...baseRequest };
    delete request.tools;
    await client.complete(request);

    const body = JSON.parse(calls[0]!.init.body) as Record<string, unknown>;
    expect(body.tools).toBeUndefined();
  });

  it("propaga 401 como AnthropicApiError não retryable", async () => {
    const { fetchFn } = makeFetchMock(401, {
      type: "error",
      error: { type: "authentication_error", message: "invalid x-api-key" },
    });
    const client = new AnthropicClient("sk-invalida", fetchFn);

    const failure = client.complete(baseRequest);
    await expect(failure).rejects.toBeInstanceOf(AnthropicApiError);
    await expect(failure).rejects.toMatchObject({
      status: 401,
      errorType: "authentication_error",
      retryable: false,
    });
  });

  it("propaga 529 como AnthropicApiError retryable, sem retry interno", async () => {
    const { fetchFn, calls } = makeFetchMock(529, {
      type: "error",
      error: { type: "overloaded_error", message: "Overloaded" },
    });
    const client = new AnthropicClient("sk", fetchFn);

    await expect(client.complete(baseRequest)).rejects.toMatchObject({
      name: "AnthropicApiError",
      status: 529,
      errorType: "overloaded_error",
      retryable: true,
    });
    // Apenas propaga — retry é decisão do worker.
    expect(calls).toHaveLength(1);
  });

  it("resposta 200 fora do formato vira AnthropicApiError invalid_response", async () => {
    const { fetchFn } = makeFetchMock(200, { nada: true });
    const client = new AnthropicClient("sk", fetchFn);
    await expect(client.complete(baseRequest)).rejects.toMatchObject({
      errorType: "invalid_response",
    });
  });
});
