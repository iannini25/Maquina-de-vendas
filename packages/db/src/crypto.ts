import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia de segredos por workspace (Credential.dataEncrypted).
 * AES-256-GCM com APP_ENCRYPTION_KEY (32 bytes, base64).
 * Formato do payload: base64(iv[12] + authTag[16] + ciphertext).
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function loadKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY ausente no ambiente");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY deve ter 32 bytes em base64 (use `pnpm gen:keys`)");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Payload criptografado inválido");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Serializa/criptografa um objeto de credencial ({ apiKey, ... }). */
export function encryptCredentialData(data: Record<string, string>): string {
  return encryptSecret(JSON.stringify(data));
}

export function decryptCredentialData(payload: string): Record<string, string> {
  return JSON.parse(decryptSecret(payload)) as Record<string, string>;
}

/** Máscara para exibição: mantém 4 últimos caracteres. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••••••${value.slice(-4)}`;
}
