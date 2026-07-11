import { describe, expect, it } from "vitest";
import { checkHealth, type HealthDeps } from "./health.js";

function makeDeps(overrides: Partial<HealthDeps> = {}): HealthDeps {
  return {
    queueNames: ["email", "outbound"],
    pingRedis: async () => {},
    pingDb: async () => {},
    ...overrides,
  };
}

describe("checkHealth", () => {
  it("responde 200 com ok e a lista de filas quando tudo conecta", async () => {
    const result = await checkHealth(makeDeps());
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, queues: ["email", "outbound"] });
  });

  it("responde 503 quando o redis falha", async () => {
    const result = await checkHealth(
      makeDeps({
        pingRedis: async () => {
          throw new Error("redis fora do ar");
        },
      }),
    );
    expect(result.status).toBe(503);
    expect(result.body.ok).toBe(false);
    expect(result.body.error).toContain("redis fora do ar");
  });

  it("responde 503 quando o banco falha", async () => {
    const result = await checkHealth(
      makeDeps({
        pingDb: async () => {
          throw new Error("postgres indisponível");
        },
      }),
    );
    expect(result.status).toBe(503);
    expect(result.body.error).toContain("postgres indisponível");
  });
});
