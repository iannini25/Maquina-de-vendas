import type { Metadata } from "next";

import { requireWorkspace } from "@/lib/session";
import { getFinancePageData } from "@/server/finance/queries";

import { FinancasView } from "./financas-view";

export const metadata: Metadata = { title: "ROI & Finanças" };

export default async function FinancasPage() {
  const ctx = await requireWorkspace();
  const data = await getFinancePageData(ctx);
  return <FinancasView data={data} />;
}
