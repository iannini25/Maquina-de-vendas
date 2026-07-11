import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

/** Placeholder da Fase 0 — substituído pelo porte fiel do protótipo na Fase 1. */
export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="font-display text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-2">Carregando sua máquina de vendas…</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    </div>
  );
}
