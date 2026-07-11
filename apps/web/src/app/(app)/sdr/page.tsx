import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getSdrPageData } from "@/server/sdr/queries";

import { SdrView } from "./sdr-view";

export const metadata: Metadata = { title: "SDR de IA" };

export default async function SdrPage() {
  const ctx = await requireWorkspace();
  const data = await getSdrPageData(ctx.db, ctx.workspaceId);
  return <SdrView data={data} />;
}
