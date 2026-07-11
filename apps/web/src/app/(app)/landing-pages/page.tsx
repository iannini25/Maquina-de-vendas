import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { listLandingPages } from "@/server/landing/queries";

import { LandingPagesClient } from "./landing-pages-client";

export const metadata: Metadata = { title: "Landing Pages" };

export default async function LandingPagesPage() {
  const ctx = await requireWorkspace();

  const [pages, products] = await Promise.all([
    listLandingPages(ctx.db),
    ctx.db.productOffer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
  ]);

  return (
    <LandingPagesClient
      pages={pages}
      products={products}
      landingBaseUrl={process.env.LANDING_URL ?? "http://localhost:3000"}
    />
  );
}
