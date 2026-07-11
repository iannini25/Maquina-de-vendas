import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getProspectingPageData } from "@/server/prospecting/queries";

import { ProspeccaoView } from "./prospeccao-view";

export const metadata: Metadata = { title: "Prospecção Ativa" };

export default async function ProspeccaoPage() {
  const ctx = await requireWorkspace();
  const data = await getProspectingPageData(ctx.db, ctx.workspaceId);
  return <ProspeccaoView data={data} />;
}
