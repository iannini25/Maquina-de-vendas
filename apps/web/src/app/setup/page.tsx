import type { Metadata } from "next";

import { ToastProvider } from "@/components/ui/toast";
import { requireWorkspace } from "@/lib/session";
import {
  computeSetupStatus,
  coreEnvironmentOk,
  listCredentialViews,
} from "@/server/credentials/service";
import { getDomainSettings } from "@/server/setup/queries";

import { SetupGateView } from "./_components/setup-view";
import { toCoreDetailsDTO } from "./_components/types";

export const metadata: Metadata = { title: "Configuração inicial do ambiente" };

/** Setup Gate — bloqueia o app até as credenciais obrigatórias ficarem verdes. */
export default async function SetupPage() {
  const ctx = await requireWorkspace();

  const [views, status, domains] = await Promise.all([
    listCredentialViews(ctx.workspaceId),
    computeSetupStatus(ctx.workspaceId),
    getDomainSettings(ctx.workspaceId),
  ]);

  const core = toCoreDetailsDTO(coreEnvironmentOk());

  return (
    <ToastProvider>
      <SetupGateView
        views={views}
        core={core}
        domains={domains}
        alreadyCompleted={Boolean(status.completedAt)}
      />
    </ToastProvider>
  );
}
