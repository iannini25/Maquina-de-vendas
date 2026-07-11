import { randomBytes } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptCredentialData,
  decryptSecret,
  encryptCredentialData,
  encryptSecret,
  maskSecret,
} from "./crypto.js";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("criptografia de credenciais (AES-256-GCM)", () => {
  it("roundtrip de segredo", () => {
    const secret = "chave-de-teste-nao-real-1234567890";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("payloads diferentes a cada chamada (IV aleatório)", () => {
    const a = encryptSecret("mesmo-valor");
    const b = encryptSecret("mesmo-valor");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("detecta adulteração (auth tag)", () => {
    const encrypted = encryptSecret("valor");
    const buf = Buffer.from(encrypted, "base64");
    buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });

  it("roundtrip de objeto de credencial", () => {
    const data = { apiKey: "chave-x", url: "https://evo.local" };
    expect(decryptCredentialData(encryptCredentialData(data))).toEqual(data);
  });

  it("falha com chave de tamanho errado", () => {
    const original = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = Buffer.from("curta").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    process.env.APP_ENCRYPTION_KEY = original;
  });

  it("mascara segredos para exibição", () => {
    expect(maskSecret("sk-ant-abcdef1234")).toBe("••••••••1234");
    expect(maskSecret("ab")).toBe("••••");
  });
});
