import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getContextPageData } from "@/server/context/queries";

import { ContextoView } from "./contexto-view";

export const metadata: Metadata = { title: "Contexto" };

export default async function ContextoPage() {
  const ctx = await requireWorkspace();
  const data = await getContextPageData(ctx.db);
  return <ContextoView data={data} />;
}
