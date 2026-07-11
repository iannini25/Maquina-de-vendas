import { z } from "zod";

import { defaultFetch, safeJsonParse, type FetchLike } from "./http.js";

/**
 * Model router + cliente LLM.
 * O router escolhe o modelo por camada de uso (chat/classifier/heavy) com
 * override por env. O cliente fala com a API da Anthropic via fetch direto,
 * atrás da interface LlmClient — o que permite mockar 100% nos testes.
 */

export type ModelTier = "chat" | "classifier" | "heavy";

interface ModelSetting {
  envVar: string;
  fallback: string;
}

const MODEL_SETTINGS: Record<ModelTier, ModelSetting> = {
  chat: { envVar: "AI_MODEL_CHAT", fallback: "claude-sonnet-4-6" },
  classifier: { envVar: "AI_MODEL_CLASSIFIER", fallback: "claude-haiku-4-5-20251001" },
  heavy: { envVar: "AI_MODEL_HEAVY", fallback: "claude-opus-4-8" },
};

/** Lê variável de ambiente sem exigir @types/node. */
function readEnv(name: string): string | undefined {
  const holder = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return holder.process?.env?.[name];
}

/** Resolve o modelo da camada, com override por env e default seguro. */
export function resolveModel(tier: ModelTier): string {
  const setting = MODEL_SETTINGS[tier];
  const fromEnv = readEnv(setting.envVar)?.trim();
  return fromEnv ? fromEnv : setting.fallback;
}

// ---------------------------------------------------------------------------
// Contratos do cliente LLM
// ---------------------------------------------------------------------------

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

/** Especificação de ferramenta (JSON Schema) para tool-calling. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmRequest {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools?: ToolSpec[];
  maxTokens: number;
}

export interface LlmToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  text?: string;
  toolCalls?: LlmToolCall[];
  usage: LlmUsage;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

// ---------------------------------------------------------------------------
// Cliente Anthropic (fetch direto na Messages API)
// ---------------------------------------------------------------------------

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

/** Erro tipado da API da Anthropic — o chamador decide retry por `retryable`. */
export class AnthropicApiError extends Error {
  readonly status: number;
  readonly errorType: string;
  readonly retryable: boolean;

  constructor(status: number, errorType: string, message: string) {
    super(message);
    this.name = "AnthropicApiError";
    this.status = status;
    this.errorType = errorType;
    this.retryable = status === 429 || status >= 500;
  }
}

const anthropicContentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.unknown()).optional(),
});

const anthropicResponseSchema = z.object({
  content: z.array(anthropicContentBlockSchema),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});

const anthropicErrorBodySchema = z.object({
  error: z
    .object({
      type: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

interface AnthropicToolWire {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  system: string;
  messages: LlmMessage[];
  tools?: AnthropicToolWire[];
}

function buildRequestBody(request: LlmRequest): AnthropicRequestBody {
  const body: AnthropicRequestBody = {
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.system,
    messages: request.messages,
  };
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }
  return body;
}

function buildApiError(status: number, rawBody: string): AnthropicApiError {
  const parsed = anthropicErrorBodySchema.safeParse(safeJsonParse(rawBody));
  const errorType = (parsed.success ? parsed.data.error?.type : undefined) ?? "unknown_error";
  const message =
    (parsed.success ? parsed.data.error?.message : undefined) ??
    `API da Anthropic respondeu status ${status}`;
  return new AnthropicApiError(status, errorType, message);
}

function parseAnthropicResponse(status: number, rawBody: string): LlmResponse {
  const parsed = anthropicResponseSchema.safeParse(safeJsonParse(rawBody));
  if (!parsed.success) {
    throw new AnthropicApiError(
      status,
      "invalid_response",
      "Resposta da API da Anthropic em formato inesperado",
    );
  }

  const textParts: string[] = [];
  const toolCalls: LlmToolCall[] = [];
  for (const block of parsed.data.content) {
    if (block.type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
    }
    if (block.type === "tool_use" && block.name) {
      toolCalls.push({ name: block.name, input: block.input ?? {} });
    }
  }

  const response: LlmResponse = {
    usage: {
      inputTokens: parsed.data.usage.input_tokens,
      outputTokens: parsed.data.usage.output_tokens,
    },
  };
  if (textParts.length > 0) response.text = textParts.join("");
  if (toolCalls.length > 0) response.toolCalls = toolCalls;
  return response;
}

/**
 * Cliente da Messages API da Anthropic.
 * A apiKey vem por parâmetro (credencial por workspace) — NUNCA de env.
 * Erros HTTP viram AnthropicApiError; retry é decisão do chamador (worker).
 */
export class AnthropicClient implements LlmClient {
  private readonly apiKey: string;
  private readonly fetchFn: FetchLike;

  constructor(apiKey: string, fetchFn: FetchLike = defaultFetch()) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await this.fetchFn(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(buildRequestBody(request)),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw buildApiError(response.status, rawBody);
    }
    return parseAnthropicResponse(response.status, rawBody);
  }
}
