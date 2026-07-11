/**
 * Normalização de telefones para E.164 amigável ao Brasil.
 */

/**
 * Normaliza um telefone cru para E.164 BR-friendly:
 * - números iniciados com "+" são internacionais: preserva o "+" e remove o resto;
 * - 10-11 dígitos (DDD + linha, fixo ou celular) ganham o código do país 55;
 * - demais casos retornam apenas os dígitos (assume código de país já presente).
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Converte um telefone em JID do WhatsApp: "5511999999999@s.whatsapp.net". */
export function formatPhoneJid(phone: string): string {
  const withoutPlus = normalizePhone(phone).replace(/^\+/, "");
  return `${withoutPlus}@s.whatsapp.net`;
}
