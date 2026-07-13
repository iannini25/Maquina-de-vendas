export { formatBRL } from "@sales4u/core";

/** "R$ 1.997" — sem centavos, como o protótipo exibe valores de lead/oferta. */
export function formatBRLShort(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

/** "há 12 min", "há 3 h", "há 2 dias", "agora" */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const at = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - at.getTime();
  if (diffMs < 60_000) return "agora";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const at = typeof date === "string" ? new Date(date) : date;
  return at.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const at = typeof date === "string" ? new Date(date) : date;
  return at.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Converte "R$ 1.997,00" | "1997" | "1.997,50" em centavos. */
export function parseBRLToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  // Formato BR: pontos de milhar + vírgula decimal
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
