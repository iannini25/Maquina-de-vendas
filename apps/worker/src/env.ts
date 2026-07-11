import { z } from "zod";

/**
 * Variáveis de ambiente do worker. O boot falha com mensagem clara
 * listando cada variável obrigatória ausente ou inválida.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  EVOLUTION_URL: z.string().min(1),
  EVOLUTION_GLOBAL_KEY: z.string().optional(),
  APP_ENCRYPTION_KEY: z.string().min(1),
  APP_URL: z.string().min(1),
  /** Porta do endpoint GET /health (padrão 3001). */
  HEALTH_PORT: z.coerce.number().int().positive().default(3001),
  /** Nível de log do pino (padrão: debug em dev, info em produção). */
  LOG_LEVEL: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof envSchema>;

/** Faz o parse do ambiente; lança erro legível se algo obrigatório faltar. */
export function loadEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problemas = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Ambiente inválido para o worker — ${problemas}`);
  }
  return parsed.data;
}
