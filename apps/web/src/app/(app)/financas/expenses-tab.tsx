"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { deleteExpense } from "@/server/finance/actions";
import { EXPENSE_CATEGORIES } from "@/server/finance/categories";
import type { ExpenseRow, FinancePageData } from "@/server/finance/queries";

import { formatBRLShort, formatDayMonth } from "./brl";

/** Cores por categoria (dots do protótipo: roxo, azul, rosa, âmbar, verde, lavanda). */
export const CATEGORY_COLORS: Record<string, string> = {
  PAID_TRAFFIC: "#A855F7",
  SOFTWARE: "#38BDF8",
  CREATIVE: "#F472B6",
  TOOLS: "#FBBF24",
  TEAM: "#34D399",
  OTHER: "#B388FF",
};

const CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORIES.map(({ value, label }) => [value, label]),
);

/** Donut SVG das categorias (proporção do gasto total). */
function CategoryDonut({
  categories,
  totalCents,
}: {
  categories: FinancePageData["expenses"]["categories"];
  totalCents: number;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" className="size-40" role="img" aria-label="Distribuição do gasto por categoria">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={13} />
      {totalCents > 0 &&
        categories
          .filter((category) => category.valueCents > 0)
          .map((category) => {
            const fraction = category.valueCents / totalCents;
            const dash = fraction * circumference;
            const segment = (
              <circle
                key={category.category}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={CATEGORY_COLORS[category.category]}
                strokeWidth={13}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return segment;
          })}
    </svg>
  );
}

/** Aba Despesas: donut + 6 cards de categoria + tabela com linha automática de IA. */
export function ExpensesTab({
  data,
  onNewExpense,
  onEditExpense,
}: {
  data: FinancePageData;
  onNewExpense: () => void;
  onEditExpense: (expense: ExpenseRow) => void;
}) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { expenses } = data;
  const hasAnything = expenses.rows.length > 0 || expenses.aiRows.length > 0;

  const onDelete = async (expense: ExpenseRow) => {
    if (!window.confirm(`Excluir a despesa "${expense.description}"?`)) return;
    setDeletingId(expense.id);
    const result = await deleteExpense(expense.id);
    setDeletingId(null);
    if (result.ok) toast("Despesa excluída.");
    else toast(result.error ?? "Não foi possível excluir.", "danger");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={onNewExpense}>
          Lançar despesa
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 flex flex-col items-center justify-center gap-3 py-6 md:col-span-4 xl:col-span-3">
          <CategoryDonut categories={expenses.categories} totalCents={expenses.totalCents} />
          <div className="text-center">
            <p className="text-[12px] text-ink-3">total gasto</p>
            <p className="font-display tnum text-xl font-semibold text-ink">
              {formatBRLShort(expenses.totalCents)}
            </p>
          </div>
        </Card>

        <div className="col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-8 xl:col-span-9">
          {expenses.categories.map((category) => (
            <Card key={category.category} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: CATEGORY_COLORS[category.category] }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{category.label}</p>
                  <p className="text-[11.5px] text-ink-3">{category.pct}%</p>
                </div>
              </div>
              <p className="tnum shrink-0 text-[13.5px] font-semibold text-ink">
                {formatBRLShort(category.valueCents)}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {!hasAnything ? (
        <EmptyState
          title="Nenhuma despesa lançada"
          hint="Lance o que você gasta (tráfego, ferramentas, equipe) para o ROI ficar real."
          action={
            <Button variant="primary" size="sm" onClick={onNewExpense}>
              Lançar despesa
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>Data</TH>
            <TH>Categoria</TH>
            <TH>Descrição</TH>
            <TH>Quem pagou</TH>
            <TH>Valor</TH>
            <TH className="w-20 text-right">
              <span className="sr-only">Ações</span>
            </TH>
          </THead>
          <TBody>
            {expenses.rows.map((expense) => (
              <TR key={expense.id}>
                <TD className="tnum">{formatDayMonth(expense.dateIso)}</TD>
                <TD>{CATEGORY_LABELS[expense.category]}</TD>
                <TD className="font-medium text-ink">{expense.description}</TD>
                <TD>{expense.paidBy ?? "—"}</TD>
                <TD className="tnum font-semibold text-ink">{formatBRLShort(expense.valueCents)}</TD>
                <TD className="text-right">
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Editar despesa ${expense.description}`}
                      onClick={() => onEditExpense(expense)}
                      className="flex size-7 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink"
                    >
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir despesa ${expense.description}`}
                      disabled={deletingId === expense.id}
                      onClick={() => void onDelete(expense)}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-danger/10 hover:text-danger",
                        deletingId === expense.id && "opacity-50",
                      )}
                    >
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" />
                      </svg>
                    </button>
                  </span>
                </TD>
              </TR>
            ))}
            {expenses.aiRows.map((row) => (
              <TR key={row.description}>
                <TD className="text-ink-3">mês</TD>
                <TD>APIs & IA</TD>
                <TD className="font-medium text-ink">{row.description}</TD>
                <TD>API</TD>
                <TD className="tnum font-semibold text-ink">{formatBRLShort(row.valueCents)}</TD>
                <TD className="text-right">
                  <span className="text-[11px] text-ink-3">automática</span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
