"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento da tela Pipeline. */
export default function PipelineError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar o Pipeline. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
