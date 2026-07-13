import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

/** Ambiente mínimo válido para os testes. */
function validEnv(): Record<string, string> {
  return {
    DATABASE_URL: "postgresql://sales4u:sales4u@localhost:5432/sales4u",
    REDIS_URL: "redis://localhost:6379",
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY: "minio",
    S3_SECRET_KEY: "minio123",
    S3_BUCKET: "sales4u",
    S3_REGION: "us-east-1",
    EVOLUTION_URL: "http://localhost:8080",
    APP_ENCRYPTION_KEY: "chave-base64",
    APP_URL: "https://app.exemplo.com",
  };
}

describe("loadEnv", () => {
  it("aceita ambiente válido e aplica defaults", () => {
    const env = loadEnv(validEnv());
    expect(env.NODE_ENV).toBe("development");
    expect(env.HEALTH_PORT).toBe(3001);
    expect(env.EVOLUTION_GLOBAL_KEY).toBeUndefined();
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("EVOLUTION_GLOBAL_KEY é opcional e preservada quando presente", () => {
    const env = loadEnv({ ...validEnv(), EVOLUTION_GLOBAL_KEY: "global-key" });
    expect(env.EVOLUTION_GLOBAL_KEY).toBe("global-key");
  });

  it("converte HEALTH_PORT de string para número", () => {
    const env = loadEnv({ ...validEnv(), HEALTH_PORT: "4002" });
    expect(env.HEALTH_PORT).toBe(4002);
  });

  it("falha com mensagem clara listando a variável ausente", () => {
    const source = validEnv();
    delete (source as Record<string, string | undefined>).DATABASE_URL;
    expect(() => loadEnv(source)).toThrowError(/DATABASE_URL/);
  });

  it("falha listando todas as variáveis ausentes de uma vez", () => {
    expect(() => loadEnv({})).toThrowError(/DATABASE_URL[\s\S]*REDIS_URL[\s\S]*APP_URL/);
  });

  it("rejeita NODE_ENV desconhecido", () => {
    expect(() => loadEnv({ ...validEnv(), NODE_ENV: "staging" })).toThrowError(/NODE_ENV/);
  });
});
