"use client";

import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/ui/misc";

/** Estado de erro do Criar com IA. */
export default function CriarError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader
        title="Criar com IA"
        subtitle="Gere copy, landing, campanha e mensagens com o seu contexto"
      />
      <div className="p-6">
        <ErrorState
          message="Não foi possível carregar o estúdio de criação. Tente de novo."
          onRetry={reset}
        />
      </div>
    </>
  );
}
