import { QUEUES } from "@vendaflow/core";
import { prisma } from "@vendaflow/db";
import { loadEnv } from "./env.js";
import { startHealthServer } from "./health.js";
import { createLogger } from "./logger.js";
import { closeQueues, createQueues } from "./queues.js";
import { createBullRedis, createSsePublisher } from "./redis.js";
import { scheduleRepeatables } from "./repeatables.js";
import { closeWorkers, registerWorkers } from "./workers/index.js";

/**
 * Boot do worker VendaFlow: valida env, conecta redis/postgres, registra
 * workers + jobs repetíveis + health check e trata graceful shutdown.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const log = createLogger(env.NODE_ENV, env.LOG_LEVEL);

  const connection = createBullRedis(env.REDIS_URL);
  const publisher = createSsePublisher(env.REDIS_URL);
  const queues = createQueues(connection);
  const workers = registerWorkers({ connection, publisher, env, log });
  await scheduleRepeatables(queues);

  const health = startHealthServer(
    {
      queueNames: Object.values(QUEUES),
      pingRedis: async () => {
        await connection.ping();
      },
      pingDb: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
    },
    env.HEALTH_PORT,
  );

  log.info(
    { queues: Object.values(QUEUES), healthPort: env.HEALTH_PORT },
    "worker no ar — filas registradas",
  );

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "encerrando worker…");
    void (async () => {
      try {
        await closeWorkers(workers);
        await closeQueues(queues);
        health.close();
        await prisma.$disconnect();
        connection.disconnect();
        publisher.disconnect();
        log.info({ signal }, "worker encerrado com sucesso");
        process.exit(0);
      } catch (error) {
        log.error(
          { err: error instanceof Error ? error.message : String(error) },
          "falha no graceful shutdown",
        );
        process.exit(1);
      }
    })();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  // O logger pode não existir se o boot falhou no loadEnv — stderr direto.
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Falha fatal no boot do worker: ${detail}\n`);
  process.exit(1);
});
