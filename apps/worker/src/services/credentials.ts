import { AnthropicClient, VoyageEmbedder, type Embedder, type LlmClient } from "@sales4u/brain";
import { decryptCredentialData, prisma, type CredentialProvider } from "@sales4u/db";

/**
 * Leitura de credenciais por workspace no worker (decifradas).
 * Retorna null quando ausente/erro — quem chama decide o fallback honesto.
 */

export async function getWorkspaceCredential(
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

export class MissingCredentialError extends Error {
  constructor(provider: CredentialProvider, workspaceId: string) {
    super(`Workspace ${workspaceId} sem credencial ${provider} verificada`);
    this.name = "MissingCredentialError";
  }
}

export async function getWorkspaceLlm(workspaceId: string): Promise<LlmClient> {
  const data = await getWorkspaceCredential(workspaceId, "ANTHROPIC");
  if (!data?.apiKey) throw new MissingCredentialError("ANTHROPIC", workspaceId);
  return new AnthropicClient(data.apiKey);
}

/** Embedder Voyage do workspace, ou null (⇒ fallback full-text no RAG). */
export async function getWorkspaceEmbedder(workspaceId: string): Promise<Embedder | null> {
  const data = await getWorkspaceCredential(workspaceId, "VOYAGE");
  if (!data?.apiKey) return null;
  return new VoyageEmbedder(data.apiKey);
}

/** Registra consumo de IA para o medidor de Uso & Custos. */
export async function recordAiUsage(input: {
  workspaceId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await prisma.aiUsage.create({
    data: {
      ...input,
      costMicros: Math.round(input.inputTokens * 3 + input.outputTokens * 15),
    },
  });
}
