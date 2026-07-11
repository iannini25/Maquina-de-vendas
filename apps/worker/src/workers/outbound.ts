import { NotImplementedYetError } from "../errors.js";
import { OUTBOUND_JOBS, outboundJobSchema, type OutboundJobPayload } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "outbound" — envia Messages OUT pelo canal do workspace.
 * Lógica pura com dependências injetadas; o wiring real (EvolutionProvider,
 * prisma, SSE) está em outbound.wiring.ts.
 */

/** Contrato mínimo do provedor — satisfeito por EvolutionProvider de @vendaflow/messaging. */
export interface WhatsAppSenderPort {
  sendText(to: string, text: string): Promise<unknown>;
  sendImage(to: string, url: string, caption?: string): Promise<unknown>;
  sendFile(to: string, url: string, fileName?: string): Promise<unknown>;
  sendButtons(
    to: string,
    text: string,
    buttons: ReadonlyArray<{ id: string; label: string }>,
  ): Promise<unknown>;
}

/** Subconjunto de MessageStatus (prisma) que este handler grava. */
export type OutboundStatus = "SENT" | "FAILED";

export interface OutboundDeps {
  /** Resolve o provedor de envio configurado para o workspace. */
  getSender(workspaceId: string): Promise<WhatsAppSenderPort>;
  /** Telefone normalizado do lead dono da conversa. */
  getRecipientPhone(conversationId: string): Promise<string>;
  /** Atualiza a Message persistida (status, externalId, sentAt). */
  markMessage(
    messageId: string,
    update: { status: OutboundStatus; externalId?: string },
  ): Promise<void>;
  /** Publica evento SSE no canal inbox do workspace. */
  publishInbox(workspaceId: string, payload: Record<string, unknown>): Promise<void>;
  log: Log;
}

/** Cria o processor da fila "outbound". */
export function createOutboundProcessor(deps: OutboundDeps): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case OUTBOUND_JOBS.send:
        return sendOutbound(deps, job.data);
      default:
        throw new NotImplementedYetError("outbound", job.name);
    }
  };
}

async function sendOutbound(deps: OutboundDeps, data: unknown): Promise<void> {
  const payload = outboundJobSchema.parse(data);
  try {
    const sender = await deps.getSender(payload.workspaceId);
    const phone = await deps.getRecipientPhone(payload.conversationId);
    const result = await sendByKind(sender, phone, payload);
    const externalId = extractExternalId(result);

    await deps.markMessage(payload.messageId, { status: "SENT", externalId });
    await deps.publishInbox(payload.workspaceId, {
      type: "message.sent",
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      externalId,
    });
  } catch (error) {
    await markFailureSafely(deps, payload, error);
    throw error; // repropaga para o BullMQ aplicar retry/backoff
  }
}

/** Despacha para o método do provedor conforme o kind da mensagem. */
function sendByKind(
  sender: WhatsAppSenderPort,
  to: string,
  job: OutboundJobPayload,
): Promise<unknown> {
  switch (job.kind) {
    case "TEXT":
      return sender.sendText(to, job.payload.text);
    case "IMAGE":
      return sender.sendImage(to, job.payload.url, job.payload.caption);
    case "FILE":
      return sender.sendFile(to, job.payload.url, job.payload.fileName);
    case "BUTTONS":
      return sender.sendButtons(to, job.payload.text, job.payload.buttons);
  }
}

/**
 * Extrai o id externo da resposta do provedor. Aceita os formatos comuns:
 * { externalId }, { id } e o cru da Evolution API { key: { id } }.
 */
export function extractExternalId(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null) return undefined;
  const record = result as Record<string, unknown>;
  if (typeof record.externalId === "string") return record.externalId;
  if (typeof record.id === "string") return record.id;
  const key = record.key;
  if (typeof key === "object" && key !== null) {
    const keyId = (key as Record<string, unknown>).id;
    if (typeof keyId === "string") return keyId;
  }
  return undefined;
}

/** Marca FAILED e avisa o inbox sem mascarar o erro original do envio. */
async function markFailureSafely(
  deps: OutboundDeps,
  payload: OutboundJobPayload,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  deps.log.error(
    { workspaceId: payload.workspaceId, messageId: payload.messageId, err: message },
    "falha no envio outbound",
  );
  try {
    await deps.markMessage(payload.messageId, { status: "FAILED" });
    await deps.publishInbox(payload.workspaceId, {
      type: "message.failed",
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      error: message,
    });
  } catch (secondary) {
    deps.log.error(
      { messageId: payload.messageId, err: secondary instanceof Error ? secondary.message : String(secondary) },
      "falha ao registrar erro do envio outbound",
    );
  }
}
