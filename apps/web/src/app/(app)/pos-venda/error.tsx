"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento do Pós-venda. */
export default function PosVendaError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar o pós-venda. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
