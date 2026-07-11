import { pino, type Logger } from "pino";

/**
 * Logger raiz do worker. Saída NDJSON pura — sem dependência de pino-pretty
 * em produção; quem lê em dev pode canalizar para `pnpm dlx pino-pretty`.
 */
export function createLogger(nodeEnv: string, level?: string): Logger {
  return pino({
    name: "vendaflow-worker",
    level: level ?? (nodeEnv === "production" ? "info" : "debug"),
  });
}
