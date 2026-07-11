"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento dos Templates de E-mail. */
export default function EmailsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar os templates de e-mail. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
