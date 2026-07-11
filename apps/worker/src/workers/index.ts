import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { QUEUES, type QueueName } from "@vendaflow/core";
import type { WorkerEnv } from "../env.js";
import type { RedisPublisher } from "../redis.js";
import type { JobLike, JobProcessor, Log } from "../types.js";
import { createAgentReplyProcessor } from "./agent-reply.js";
import { createAnalystProcessor } from "./analyst.js";
import { createAutomationProcessor } from "./automation.js";
import { createCampaignProcessor } from "./campaign.js";
import { createContextIngestProcessor } from "./context-ingest.js";
import { createEmailProcessor } from "./email.js";
import { createWorkspaceEmailSenderResolver } from "./email.wiring.js";
import { createImportProcessor } from "./import.js";
import { createOutboundProcessor } from "./outbound.js";
import { createOutboundDeps } from "./outbound.wiring.js";
import { createPostSaleProcessor } from "./post-sale.js";

/** Contexto compartilhado para montar todos os workers. */
export interface WorkerContext {
  connection: Redis;
  publisher: RedisPublisher;
  env: WorkerEnv;
  log: Log;
}

/** Registra um Worker BullMQ por fila declarada em QUEUES do core. */
export function registerWorkers(ctx: WorkerContext): Worker[] {
  const processors = buildProcessors(ctx);
  return (Object.entries(processors) as Array<[QueueName, JobProcessor]>).map(
    ([queue, processor]) =>
      new Worker(queue, withJobLogging(ctx.log, queue, processor), {
        connection: ctx.connection,
      }),
  );
}

/** Fecha todos os workers aguardando os jobs em andamento (graceful). */
export async function closeWorkers(workers: readonly Worker[]): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
}

function buildProcessors(ctx: WorkerContext): Record<QueueName, JobProcessor> {
  const { log } = ctx;
  return {
    [QUEUES.email]: createEmailProcessor({
      getSender: createWorkspaceEmailSenderResolver(ctx.env.NODE_ENV),
      log,
    }),
    [QUEUES.outbound]: createOutboundProcessor(
      createOutboundDeps({
        evolutionUrl: ctx.env.EVOLUTION_URL,
        evolutionGlobalKey: ctx.env.EVOLUTION_GLOBAL_KEY,
        publisher: ctx.publisher,
        log,
      }),
    ),
    [QUEUES.automation]: createAutomationProcessor({ log }),
    [QUEUES.agentReply]: createAgentReplyProcessor({ log }),
    [QUEUES.contextIngest]: createContextIngestProcessor({ log }),
    [QUEUES.postSale]: createPostSaleProcessor({ log }),
    [QUEUES.campaign]: createCampaignProcessor({ log }),
    [QUEUES.analyst]: createAnalystProcessor({ log }),
    [QUEUES.import]: createImportProcessor({ log }),
  };
}

/** Envolve o processor com log de início/fim/falha e duração. */
export function withJobLogging(
  log: Log,
  queue: string,
  processor: JobProcessor,
): (job: JobLike) => Promise<void> {
  return async (job: JobLike): Promise<void> => {
    const startedAt = Date.now();
    log.info({ queue, job: job.name, id: job.id }, "job iniciado");
    try {
      await processor(job);
      log.info({ queue, job: job.name, id: job.id, ms: Date.now() - startedAt }, "job concluído");
    } catch (error) {
      log.error(
        {
          queue,
          job: job.name,
          id: job.id,
          ms: Date.now() - startedAt,
          err: error instanceof Error ? error.message : String(error),
        },
        "job falhou",
      );
      throw error;
    }
  };
}
