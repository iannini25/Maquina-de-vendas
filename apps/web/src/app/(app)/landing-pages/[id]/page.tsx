import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireWorkspace } from "@/lib/session";
import { getLandingDetail } from "@/server/landing/queries";

import { LandingEditorClient } from "./editor-client";

export const metadata: Metadata = { title: "Editor de landing page" };

export default async function LandingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();

  const landing = await getLandingDetail(ctx.db, id);
  if (!landing) notFound();

  return (
    <LandingEditorClient
      landing={landing}
      landingBaseUrl={process.env.LANDING_URL ?? "http://localhost:3000"}
    />
  );
}
