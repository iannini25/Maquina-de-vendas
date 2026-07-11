import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getPostSalePageData } from "@/server/postsale/queries";

import { PostSaleView } from "./postsale-view";

export const metadata: Metadata = { title: "Pós-venda" };

export default async function PosVendaPage() {
  const ctx = await requireWorkspace();
  const data = await getPostSalePageData(ctx.db, ctx.workspaceId);
  return <PostSaleView data={data} />;
}
