import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getEmailTemplatesPageData } from "@/server/email-templates/queries";

import { EmailsView } from "./emails-view";

export const metadata: Metadata = { title: "Templates de E-mail" };

export default async function EmailsPage() {
  const ctx = await requireWorkspace();
  const data = await getEmailTemplatesPageData(ctx.db);
  return <EmailsView data={data} />;
}
