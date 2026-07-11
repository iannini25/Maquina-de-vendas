"use client";

import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/ui/misc";

/** Estado de erro do Dashboard — mostra a mensagem e permite tentar de novo. */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Algo deu errado ao carregar sua máquina" />
      <div className="p-6">
        <ErrorState
          message="Não foi possível carregar o dashboard. Verifique sua conexão com o banco e tente de novo."
          onRetry={reset}
        />
      </div>
    </>
  );
}
