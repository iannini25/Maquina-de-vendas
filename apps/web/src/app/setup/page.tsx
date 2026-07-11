import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";

export const metadata: Metadata = { title: "Configuração inicial" };

/** Placeholder do Setup Gate — implementação completa na Fase 2. */
export default async function SetupPage() {
  await requireWorkspace();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Configuração inicial
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        Conecte suas credenciais para liberar o sistema. (Setup Gate — em construção)
      </p>
    </main>
  );
}
