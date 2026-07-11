"use client";

import { ErrorState } from "@/components/ui/misc";

/** Erro da rota /landing-pages. */
export default function LandingPagesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar suas landing pages."
        onRetry={reset}
      />
    </div>
  );
}
