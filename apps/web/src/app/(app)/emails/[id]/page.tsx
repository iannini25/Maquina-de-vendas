import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireWorkspace } from "@/lib/session";
import { getEmailEditorPageData } from "@/server/email-templates/queries";

import { EmailEditorView } from "../editor-view";

export const metadata: Metadata = { title: "Editor de template" };

export default async function EditorTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const data = await getEmailEditorPageData(ctx.db, ctx.workspaceId, id);
  if (!data) notFound();
  return <EmailEditorView data={data} />;
}
