import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getEmailEditorPageData } from "@/server/email-templates/queries";

import { EmailEditorView } from "../editor-view";

export const metadata: Metadata = { title: "Novo template de e-mail" };

export default async function NovoTemplatePage() {
  const ctx = await requireWorkspace();
  const data = await getEmailEditorPageData(ctx.db, ctx.workspaceId, null);
  if (!data) throw new Error("Falha ao preparar o editor de template.");
  return <EmailEditorView data={data} />;
}
