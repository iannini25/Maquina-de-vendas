/**
 * Contratos mínimos compartilhados pelos handlers do worker.
 * São estruturais de propósito: pino.Logger e bullmq.Job os satisfazem,
 * e testes podem injetar fakes sem depender de rede/redis.
 */

/** Contrato mínimo de log (satisfeito por pino.Logger). */
export interface Log {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/** Visão mínima de um Job BullMQ — o que os handlers realmente usam. */
export interface JobLike {
  readonly name: string;
  readonly data: unknown;
  readonly id?: string;
}

/** Assinatura comum de todos os handlers de fila. */
export type JobProcessor = (job: JobLike) => Promise<void>;
