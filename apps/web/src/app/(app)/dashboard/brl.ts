/** Formatação curta do protótipo: "R$ 51.922" (sem centavos). */
export function formatBRLShort(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);
}

/** Número pt-BR com até 1 casa decimal ("3,5", "12"). */
export function formatNum1(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
