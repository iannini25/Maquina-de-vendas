import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { requireWorkspace } from "@/lib/session";
import { getDashboardData } from "@/server/dashboard/queries";

import { formatBRLShort } from "./brl";
import { ArrowBadge, DashboardView, PrimaryLink } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  const data = await getDashboardData(ctx);

  const subtitle =
    data.waitingCount === 1
      ? `1 lead aguarda você · ${formatBRLShort(data.openValueCents)} em jogo`
      : `${data.waitingCount} leads aguardam você · ${formatBRLShort(data.openValueCents)} em jogo`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        actions={
          <PrimaryLink href="/criar">
            Criar com IA
            <ArrowBadge />
          </PrimaryLink>
        }
      />
      <DashboardView data={data} />
    </>
  );
}
