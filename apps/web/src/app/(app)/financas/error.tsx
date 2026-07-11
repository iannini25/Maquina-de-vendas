"use client";

import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/ui/misc";

/** Estado de erro de ROI & Finanças — mostra a mensagem e permite tentar de novo. */
export default function FinancasError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader title="ROI & Finanças" subtitle="Quanto entra, quanto sai e se dá lucro" />
      <div className="p-6">
        <ErrorState
          message="Não foi possível carregar os números. Verifique sua conexão com o banco e tente de novo."
          onRetry={reset}
        />
      </div>
    </>
  );
}
