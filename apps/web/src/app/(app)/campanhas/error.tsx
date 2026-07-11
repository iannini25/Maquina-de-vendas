"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento das rotas de Campanhas. */
export default function CampanhasError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar as campanhas. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
