"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento da tela Leads. */
export default function LeadsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar os Leads. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
