import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getCampaignsPageData } from "@/server/campaigns/queries";

import { CampaignsView } from "./campaigns-view";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampanhasPage() {
  const ctx = await requireWorkspace();
  const data = await getCampaignsPageData(ctx.db);
  return <CampaignsView data={data} />;
}
