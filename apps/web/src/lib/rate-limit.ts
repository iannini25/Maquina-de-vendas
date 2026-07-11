import { getRedisPub } from "./redis";

/**
 * Rate limiting por janela fixa via Redis (INCR + EXPIRE).
 * Uso: login, webhooks, envio de mensagens.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedisPub();
  const bucket = `rl:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

  const count = await redis.incr(bucket);
  if (count === 1) {
    await redis.expire(bucket, windowSeconds);
  }

  const ttl = await redis.ttl(bucket);
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetInSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

export const RATE_LIMITS = {
  login: { max: 10, windowSeconds: 300 },
  webhook: { max: 300, windowSeconds: 60 },
  outboundPerConversation: { max: 8, windowSeconds: 60 },
  aiGeneration: { max: 30, windowSeconds: 300 },
} as const;
