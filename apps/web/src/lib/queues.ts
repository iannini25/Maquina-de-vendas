import { QUEUES, type QueueName } from "@vendaflow/core";
import { Queue } from "bullmq";
import Redis from "ioredis";

/**
 * Enfileiramento de jobs do web para o worker (BullMQ).
 * Conexão dedicada (maxRetriesPerRequest: null, exigência do BullMQ).
 */

const globalForQueues = globalThis as unknown as {
  bullConnection?: Redis;
  queues?: Map<QueueName, Queue>;
};

function getConnection(): Redis {
  if (!globalForQueues.bullConnection) {
    globalForQueues.bullConnection = new Redis(
      process.env.REDIS_URL ?? "redis://localhost:6381",
      { maxRetriesPerRequest: null },
    );
  }
  return globalForQueues.bullConnection;
}

export function getQueue(name: QueueName): Queue {
  if (!globalForQueues.queues) globalForQueues.queues = new Map();
  let queue = globalForQueues.queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
    globalForQueues.queues.set(name, queue);
  }
  return queue;
}

export { QUEUES };
