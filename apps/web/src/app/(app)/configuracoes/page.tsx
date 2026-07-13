import type { Metadata } from "next";

import { prisma } from "@sales4u/db";

import { toCoreDetailsDTO } from "@/app/setup/_components/types";
import { requireWorkspace } from "@/lib/session";
import { coreEnvironmentOk, listCredentialViews } from "@/server/credentials/service";
import { getDomainSettings, getTeam, getUsageSummary } from "@/server/setup/queries";

import { ConfiguracoesView } from "./configuracoes-view";

export const metadata: Metadata = { title: "Configurações" };

/** Configurações — Credenciais & Integrações / Uso & Custos / Conta & Equipe. */
export default async function ConfiguracoesPage() {
  const ctx = await requireWorkspace();

  const [views, domains, usage, team, user] = await Promise.all([
    listCredentialViews(ctx.workspaceId),
    getDomainSettings(ctx.workspaceId),
    getUsageSummary(ctx),
    getTeam(ctx),
    prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    }),
  ]);

  return (
    <ConfiguracoesView
      views={views}
      core={toCoreDetailsDTO(coreEnvironmentOk())}
      domains={domains}
      usage={usage}
      team={team}
      userName={user.name}
      userEmail={user.email}
      canInvite={ctx.role === "OWNER" || ctx.role === "ADMIN"}
    />
  );
}
