"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro da rota /anuncios. */
export default function AnunciosError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState message="Não foi possível carregar Anúncios & Tráfego." onRetry={reset} />
    </div>
  );
}
