/** Formatação curta do protótipo: "R$ 12.929" (sem centavos). */
export function formatBRLShort(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);
}

/** Número pt-BR com até 1 casa decimal ("3,9", "12"). */
export function formatNum1(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/** "dd/mm" do protótipo (18/06). */
export function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** "+338%" / "-23%" com sinal explícito no positivo. */
export function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}
