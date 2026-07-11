import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token assinado de descadastro (opt-out) de e-mails.
 * Formato: base64url(leadId) + "." + HMAC-SHA256(leadId, AUTH_SECRET) em base64url.
 * O worker usa makeOptoutUrl(leadId) para montar o link de todo e-mail enviado.
 */

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ausente — necessário para assinar o token de opt-out.");
  return value;
}

function sign(leadId: string): string {
  return createHmac("sha256", secret()).update(leadId, "utf8").digest("base64url");
}

export function makeOptoutToken(leadId: string): string {
  return `${Buffer.from(leadId, "utf8").toString("base64url")}.${sign(leadId)}`;
}

/** URL pública de descadastro para embutir no rodapé dos e-mails. */
export function makeOptoutUrl(leadId: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/optout?token=${makeOptoutToken(leadId)}`;
}

/** Valida o token e devolve o leadId, ou null se inválido/adulterado. */
export function verifyOptoutToken(token: string): string | null {
  const [encodedLeadId, signature] = token.split(".");
  if (!encodedLeadId || !signature) return null;

  let leadId: string;
  try {
    leadId = Buffer.from(encodedLeadId, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!leadId) return null;

  let expected: Buffer;
  let received: Buffer;
  try {
    expected = Buffer.from(sign(leadId), "utf8");
    received = Buffer.from(signature, "utf8");
  } catch {
    return null;
  }
  if (expected.length !== received.length) return null;
  return timingSafeEqual(expected, received) ? leadId : null;
}
