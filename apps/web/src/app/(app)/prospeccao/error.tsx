"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento da Prospecção. */
export default function ProspeccaoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar a prospecção. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
