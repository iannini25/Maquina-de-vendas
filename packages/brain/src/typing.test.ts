import { describe, expect, it } from "vitest";

import {
  MAX_MESSAGES_PER_MINUTE,
  MAX_TYPING_DELAY_MS,
  MIN_TYPING_DELAY_MS,
  rateLimitKey,
  typingDelayMs,
} from "./typing.js";

describe("typingDelayMs", () => {
  it("fica sempre entre 2000 e 6000ms", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const length of [0, 5, 40, 120, 400, 2000]) {
        const delay = typingDelayMs(length, seed);
        expect(delay).toBeGreaterThanOrEqual(MIN_TYPING_DELAY_MS);
        expect(delay).toBeLessThanOrEqual(MAX_TYPING_DELAY_MS);
      }
    }
  });

  it("é determinístico para o mesmo seed", () => {
    expect(typingDelayMs(80, 42)).toBe(typingDelayMs(80, 42));
    expect(typingDelayMs(300, 7)).toBe(typingDelayMs(300, 7));
  });

  it("é proporcional ao tamanho do texto (mesmo seed)", () => {
    for (const seed of [1, 13, 99]) {
      expect(typingDelayMs(400, seed)).toBeGreaterThan(typingDelayMs(10, seed));
      expect(typingDelayMs(200, seed)).toBeGreaterThanOrEqual(typingDelayMs(50, seed));
    }
  });

  it("seeds diferentes produzem jitter diferente", () => {
    const values = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      values.add(typingDelayMs(100, seed));
    }
    expect(values.size).toBeGreaterThan(1);
  });
});

describe("rate limit", () => {
  it("expõe a constante de 8 mensagens por minuto", () => {
    expect(MAX_MESSAGES_PER_MINUTE).toBe(8);
  });

  it("gera chave por conversa", () => {
    expect(rateLimitKey("conv_123")).toBe("rate:outbound:conv_123");
    expect(rateLimitKey("a")).not.toBe(rateLimitKey("b"));
  });
});
