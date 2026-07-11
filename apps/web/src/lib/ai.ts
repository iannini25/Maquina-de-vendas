import {
  AnthropicClient,
  resolveModel,
  type LlmClient,
  type ModelTier,
} from "@vendaflow/brain";
import { prisma } from "@vendaflow/db";

import { getCredentialData } from "@/server/credentials/service";

/**
 * IA por workspace: resolve o cliente Anthropic com a chave do próprio
 * workspace (Setup Gate) e registra o uso em AiUsage.
 */

export class MissingAiCredentialError extends Error {
  constructor() {
    super("Configure sua chave da Anthropic em Configurações para usar a IA.");
    this.name = "MissingAiCredentialError";
  }
}

export async function getWorkspaceLlm(workspaceId: string): Promise<LlmClient> {
  const data = await getCredentialData(workspaceId, "ANTHROPIC");
  if (!data?.apiKey) throw new MissingAiCredentialError();
  return new AnthropicClient(data.apiKey);
}

export interface CompleteOptions {
  workspaceId: string;
  feature: string;
  tier: ModelTier;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

/** Chamada simples de texto (sem ferramentas) com registro de uso. */
export async function completeWithUsage(options: CompleteOptions): Promise<string> {
  const client = await getWorkspaceLlm(options.workspaceId);
  const model = resolveModel(options.tier);

  const response = await client.complete({
    model,
    system: options.system,
    messages: options.messages,
    maxTokens: options.maxTokens ?? 2048,
  });

  await prisma.aiUsage.create({
    data: {
      workspaceId: options.workspaceId,
      feature: options.feature,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      // Aproximação de custo em micros de US$ (preços por modelo ficam no relatório)
      costMicros: Math.round(
        response.usage.inputTokens * 3 + response.usage.outputTokens * 15,
      ),
    },
  });

  return response.text ?? "";
}

/** True se o workspace tem a credencial OK (para estados honestos na UI). */
export async function hasAiCredential(workspaceId: string): Promise<boolean> {
  const data = await getCredentialData(workspaceId, "ANTHROPIC");
  return Boolean(data?.apiKey);
}
