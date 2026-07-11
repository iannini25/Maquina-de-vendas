import Redis from "ioredis";

/**
 * Conexões Redis do web:
 * - `redisPub` para publicar eventos SSE (compartilhada)
 * - `createSubscriber()` cria conexão dedicada por stream SSE (subscribe bloqueia a conexão)
 */

const globalForRedis = globalThis as unknown as { redisPub?: Redis };

function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6381";
}

export function getRedisPub(): Redis {
  if (!globalForRedis.redisPub) {
    globalForRedis.redisPub = new Redis(redisUrl(), { maxRetriesPerRequest: 2 });
  }
  return globalForRedis.redisPub;
}

export function createSubscriber(): Redis {
  return new Redis(redisUrl(), { maxRetriesPerRequest: 2 });
}
