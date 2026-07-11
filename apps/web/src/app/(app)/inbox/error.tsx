"use client";

import { ErrorState } from "@/components/ui/misc";

/** Estado de erro da rota /inbox (falha ao carregar dados). */
export default function InboxError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        message="Não foi possível carregar o Inbox. Verifique sua conexão e tente de novo."
        onRetry={reset}
      />
    </div>
  );
}
