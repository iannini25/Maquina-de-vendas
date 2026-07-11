import { Queue, type JobsOptions } from "bullmq";
import type { Redis } from "ioredis";
import { QUEUES, type QueueName } from "@vendaflow/core";

/** Política padrão de retry/limpeza de todas as filas. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export type QueueMap = Readonly<Record<QueueName, Queue>>;

/** Cria uma Queue BullMQ para cada fila declarada em QUEUES do core. */
export function createQueues(connection: Redis): QueueMap {
  const entries = Object.values(QUEUES).map(
    (name) => [name, new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })] as const,
  );
  return Object.fromEntries(entries) as Record<QueueName, Queue>;
}

/** Fecha todas as filas (usado no graceful shutdown). */
export async function closeQueues(queues: QueueMap): Promise<void> {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}
