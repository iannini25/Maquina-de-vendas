import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireWorkspace } from "@/lib/session";
import { getStudioPageData } from "@/server/studio/queries";

import { flowBySlug } from "../flows";
import { FlowView } from "./flow-view";

export const metadata: Metadata = { title: "Criar com IA" };

export default async function CriarFluxoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const flow = flowBySlug(tipo);
  if (!flow) notFound();

  const ctx = await requireWorkspace();
  const data = await getStudioPageData(ctx);
  return <FlowView slug={flow.slug} data={data} />;
}
