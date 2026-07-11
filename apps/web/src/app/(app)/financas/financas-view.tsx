"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Tabs } from "@/components/ui/tabs";
import type { ExpenseRow, FinancePageData } from "@/server/finance/queries";

import { ExpenseModal } from "./expense-modal";
import { ExpensesTab } from "./expenses-tab";
import { OverviewTab } from "./overview-tab";
import { SaleModal } from "./sale-modal";
import { SalesTab } from "./sales-tab";

type FinanceTab = "overview" | "despesas" | "vendas";

/** Tela ROI & Finanças — 3 abas (Visão geral (ROI) | Despesas | Vendas). */
export function FinancasView({ data }: { data: FinancePageData }) {
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [saleOpen, setSaleOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);

  const openExpenseModal = (expense?: ExpenseRow) => {
    setEditingExpense(expense ?? null);
    setExpenseOpen(true);
  };

  // CTA "Lançar" da topbar: venda na aba Vendas, despesa na aba Despesas.
  const onLaunch = () => {
    if (tab === "despesas") {
      openExpenseModal();
      return;
    }
    if (tab === "overview") setTab("vendas");
    setSaleOpen(true);
  };

  return (
    <>
      <PageHeader
        title="ROI & Finanças"
        subtitle="Quanto entra, quanto sai e se dá lucro"
        actions={
          <button
            type="button"
            onClick={onLaunch}
            className="flex h-9.5 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7C3AED,#A855F7)] pl-4.5 pr-1.5 text-[13px] font-semibold text-white shadow-[0_0_0_1px_rgba(139,92,246,.25),0_12px_40px_-12px_rgba(139,92,246,.7)] transition-all duration-200 ease-[var(--ease-out)] hover:brightness-110 active:scale-[.98]"
          >
            Lançar
            <span className="flex size-6.5 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </button>
        }
      />

      <div className="p-6">
        <Tabs<FinanceTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "Visão geral (ROI)" },
            { value: "despesas", label: "Despesas" },
            { value: "vendas", label: "Vendas" },
          ]}
        />

        <div key={tab} className="rise-in mt-5">
          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "despesas" && (
            <ExpensesTab data={data} onNewExpense={() => openExpenseModal()} onEditExpense={openExpenseModal} />
          )}
          {tab === "vendas" && <SalesTab data={data} onNewSale={() => setSaleOpen(true)} />}
        </div>
      </div>

      <SaleModal
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        products={data.products}
      />
      <ExpenseModal
        open={expenseOpen}
        onClose={() => {
          setExpenseOpen(false);
          setEditingExpense(null);
        }}
        campaigns={data.campaigns}
        editing={editingExpense}
      />
    </>
  );
}
