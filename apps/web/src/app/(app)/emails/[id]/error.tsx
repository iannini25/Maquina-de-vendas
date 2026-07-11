"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento do editor de template. */
export default function EditorTemplateError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar o editor do template. Tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
