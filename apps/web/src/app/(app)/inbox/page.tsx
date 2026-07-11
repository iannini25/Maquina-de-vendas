import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getInboxData } from "@/server/inbox/queries";

import { InboxClient } from "./inbox-client";

export const metadata: Metadata = { title: "Inbox" };

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await requireWorkspace();
  const data = await getInboxData(ctx, {
    c: firstOf(params.c),
    lead: firstOf(params.lead),
  });

  return <InboxClient data={data} />;
}
