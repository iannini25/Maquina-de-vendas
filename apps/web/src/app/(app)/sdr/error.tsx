"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento do SDR de IA. */
export default function SdrError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar a configuração do SDR. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
