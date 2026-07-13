import { Redis } from "ioredis";
import { sseChannel } from "@sales4u/core";

/** Tipos de canal SSE aceitos por sseChannel (@sales4u/core). */
export type SseKind = Parameters<typeof sseChannel>[1];

/** Contrato mínimo de publicação pub/sub (satisfeito por ioredis; fácil de fakear). */
export interface RedisPublisher {
  publish(channel: string, message: string): Promise<number>;
}

/** Conexão dedicada ao BullMQ — exige maxRetriesPerRequest: null. */
export function createBullRedis(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

/** Conexão separada só para publicar SSE — não compete com as filas. */
export function createSsePublisher(redisUrl: string): Redis {
  return new Redis(redisUrl);
}

/** Publica um evento SSE no canal do workspace (o web faz o fan-out). */
export async function publishSse(
  pub: RedisPublisher,
  workspaceId: string,
  kind: SseKind,
  payload: Record<string, unknown>,
): Promise<void> {
  await pub.publish(sseChannel(workspaceId, kind), JSON.stringify(payload));
}
