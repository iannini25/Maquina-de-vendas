import { sseChannel } from "@sales4u/core";
import type { ActorType, Prisma } from "@sales4u/db";
import { prisma } from "@sales4u/db";

import { getRedisPub } from "./redis";

/**
 * Trilha de eventos: persiste no EventLog e publica no canal SSE do workspace.
 * Tudo relevante do domínio passa por aqui (dashboard, timeline, auditoria).
 */

export interface LogEventInput {
  workspaceId: string;
  actorType: ActorType;
  actorId?: string;
  type: string;
  entity: string;
  entityId: string;
  data?: Prisma.InputJsonValue;
  /** Canais SSE a notificar além do log (inbox | pipeline | notify). */
  notify?: Array<"inbox" | "pipeline" | "notify">;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  await prisma.eventLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorType: input.actorType,
      actorId: input.actorId,
      type: input.type,
      entity: input.entity,
      entityId: input.entityId,
      data: input.data ?? {},
    },
  });

  const channels = input.notify ?? [];
  if (channels.length > 0) {
    const payload = JSON.stringify({
      type: input.type,
      entity: input.entity,
      entityId: input.entityId,
      data: input.data ?? {},
      at: Date.now(),
    });
    const pub = getRedisPub();
    await Promise.all(
      channels.map((kind) => pub.publish(sseChannel(input.workspaceId, kind), payload)),
    );
  }
}

/** Publica evento SSE sem persistir (ex.: digitando…, presença). */
export async function publishSse(
  workspaceId: string,
  kind: "inbox" | "pipeline" | "notify",
  data: Record<string, unknown>,
): Promise<void> {
  await getRedisPub().publish(
    sseChannel(workspaceId, kind),
    JSON.stringify({ ...data, at: Date.now() }),
  );
}
