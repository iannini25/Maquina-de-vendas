import type { ExpenseCategory } from "@vendaflow/db";

/**
 * Categorias de despesa (rótulos do protótipo). Arquivo sem dependência de
 * servidor — pode ser importado por client components.
 */
export const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: "PAID_TRAFFIC", label: "Tráfego pago" },
  { value: "SOFTWARE", label: "Software & Assinaturas" },
  { value: "CREATIVE", label: "Criativos & Conteúdo" },
  { value: "TOOLS", label: "Ferramentas" },
  { value: "TEAM", label: "Equipe & Freelas" },
  { value: "OTHER", label: "APIs & IA" },
];
