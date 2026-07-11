import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/misc";
import { hasAiCredential } from "@/lib/ai";
import { requireWorkspace } from "@/lib/session";
import {
  getCampaignDetail,
  getCampaignFormOptions,
  getCampaignsHeader,
} from "@/server/campaigns/queries";

import { CampaignDetail } from "./campaign-detail";

export const metadata: Metadata = { title: "Campanha" };

export default async function CampanhaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();

  const [detail, header, options, hasAi] = await Promise.all([
    getCampaignDetail(ctx.db, id),
    getCampaignsHeader(ctx.db),
    getCampaignFormOptions(ctx.db),
    hasAiCredential(ctx.workspaceId),
  ]);

  if (!detail) {
    return (
      <div className="p-6">
        <EmptyState
          title="Campanha não encontrada"
          hint="Ela pode ter sido removida ou o link está incorreto."
          action={
            <Link
              href="/campanhas"
              className="rounded-full border border-hairline bg-surface-2 px-4 py-2 text-[13px] font-semibold text-ink transition-colors duration-[130ms] hover:bg-surface-3"
            >
              Voltar para campanhas
            </Link>
          }
        />
      </div>
    );
  }

  return <CampaignDetail detail={detail} header={header} options={options} hasAi={hasAi} />;
}
