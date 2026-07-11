"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento das Configurações. */
export default function ConfiguracoesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar as configurações. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
