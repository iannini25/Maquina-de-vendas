/**
 * Formato monetário do protótipo: inteiro sem centavos ("R$ 35.946"),
 * quebrado com 2 casas ("R$ 6,80").
 */
export function formatMoneyCompact(cents: number): string {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

/** "4,4x" para ROAS. */
export function formatMultiplier(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x`;
}

/** "2,7%" para CTR (fração 0..1). */
export function formatPercentFraction(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
