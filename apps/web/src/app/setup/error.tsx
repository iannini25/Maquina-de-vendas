"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro de carregamento do Setup Gate. */
export default function SetupError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[860px] px-6 pt-14">
      <ErrorState
        message="Não foi possível carregar o estado das credenciais. Verifique a conexão com o banco e tente de novo."
        onRetry={reset}
      />
    </main>
  );
}
