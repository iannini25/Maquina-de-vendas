"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento do Contexto. */
export default function ContextoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar os arquivos de contexto. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
