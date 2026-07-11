/**
 * Humanização de envio: delay de "digitando..." determinístico por seed
 * e contrato de rate limit por conversa (o worker aplica).
 */

export const MIN_TYPING_DELAY_MS = 2000;
export const MAX_TYPING_DELAY_MS = 6000;

/** Máximo de mensagens de saída por minuto em uma conversa. */
export const MAX_MESSAGES_PER_MINUTE = 8;

const TYPING_JITTER_MS = 500;
const TYPING_LENGTH_CAP = 400;

/** PRNG determinístico (mulberry32) — valor em [0, 1) a partir do seed. */
function seededUnit(seed: number): number {
  let t = (Math.trunc(seed) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

/**
 * Delay de digitação em ms: proporcional ao tamanho do texto, com jitter
 * determinístico pelo seed, sempre entre 2000 e 6000ms.
 */
export function typingDelayMs(textLength: number, seed: number): number {
  const length = Math.max(0, Math.min(textLength, TYPING_LENGTH_CAP));
  const span = MAX_TYPING_DELAY_MS - MIN_TYPING_DELAY_MS - TYPING_JITTER_MS * 2;
  const base = MIN_TYPING_DELAY_MS + TYPING_JITTER_MS + (length / TYPING_LENGTH_CAP) * span;
  const jitter = (seededUnit(seed) - 0.5) * 2 * TYPING_JITTER_MS;
  const delay = Math.round(base + jitter);
  return Math.min(MAX_TYPING_DELAY_MS, Math.max(MIN_TYPING_DELAY_MS, delay));
}

/** Chave de rate limit de envio por conversa (usada pelo worker no Redis). */
export function rateLimitKey(conversationId: string): string {
  return `rate:outbound:${conversationId}`;
}
