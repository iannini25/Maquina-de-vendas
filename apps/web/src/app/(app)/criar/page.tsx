import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getStudioPageData } from "@/server/studio/queries";

import { HubView } from "./hub-view";

export const metadata: Metadata = { title: "Criar com IA" };

export default async function CriarPage() {
  const ctx = await requireWorkspace();
  const data = await getStudioPageData(ctx);
  return <HubView data={data} />;
}
