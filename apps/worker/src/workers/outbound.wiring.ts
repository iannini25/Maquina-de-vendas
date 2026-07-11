import { prisma, decryptCredentialData } from "@vendaflow/db";
import { EvolutionProvider, normalizePhone } from "@vendaflow/messaging";
import { publishSse, type RedisPublisher } from "../redis.js";
import type { Log } from "../types.js";
import type { OutboundDeps, OutboundStatus, WhatsAppSenderPort } from "./outbound.js";

/**
 * Wiring real do handler outbound: credencial EVOLUTION do workspace,
 * telefone do lead via prisma, atualização da Message e SSE inbox.
 */

export interface OutboundWiringOptions {
  /** URL padrão da Evolution API (env EVOLUTION_URL). */
  evolutionUrl: string;
  /** Chave global opcional (env EVOLUTION_GLOBAL_KEY) — fallback da credencial. */
  evolutionGlobalKey?: string;
  publisher: RedisPublisher;
  log: Log;
}

/** Monta as dependências reais usadas por createOutboundProcessor. */
export function createOutboundDeps(options: OutboundWiringOptions): OutboundDeps {
  return {
    getSender: (workspaceId) => resolveEvolutionSender(workspaceId, options),
    getRecipientPhone,
    markMessage,
    publishInbox: (workspaceId, payload) =>
      publishSse(options.publisher, workspaceId, "inbox", payload),
    log: options.log,
  };
}

async function resolveEvolutionSender(
  workspaceId: string,
  options: OutboundWiringOptions,
): Promise<WhatsAppSenderPort> {
  const credential = await prisma.credential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "EVOLUTION" } },
  });
  if (!credential) {
    throw new Error(`Workspace ${workspaceId} sem credencial EVOLUTION configurada`);
  }

  const data = decryptCredentialData(credential.dataEncrypted);
  const apiKey = data.apiKey ?? options.evolutionGlobalKey;
  const instanceName = data.instanceName;
  const baseUrl = data.baseUrl ?? options.evolutionUrl;

  if (!apiKey) {
    throw new Error(
      `Credencial EVOLUTION do workspace ${workspaceId} sem apiKey (e sem EVOLUTION_GLOBAL_KEY)`,
    );
  }
  if (!instanceName) {
    throw new Error(`Credencial EVOLUTION do workspace ${workspaceId} sem instanceName`);
  }

  return new EvolutionProvider({ baseUrl, apiKey, instanceName });
}

async function getRecipientPhone(conversationId: string): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: { select: { phone: true } } },
  });
  if (!conversation) {
    throw new Error(`Conversa ${conversationId} não encontrada`);
  }
  return normalizePhone(conversation.lead.phone);
}

async function markMessage(
  messageId: string,
  update: { status: OutboundStatus; externalId?: string },
): Promise<void> {
  await prisma.message.update({
    where: { id: messageId },
    data: {
      status: update.status,
      ...(update.externalId !== undefined ? { externalId: update.externalId } : {}),
      ...(update.status === "SENT" ? { sentAt: new Date() } : {}),
    },
  });
}
