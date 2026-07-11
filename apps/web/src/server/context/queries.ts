import type { TenantDb } from "@vendaflow/db";

import type {
  ContextFileDto,
  ContextPageData,
  ContextStatusDto,
  ContextTypeDto,
  DesignSystemDto,
  LinkOptionDto,
} from "./types";

/**
 * Queries do módulo Contexto (somente server).
 * O Design System mais recente vira o card destaque; o restante vai à tabela.
 */

export async function getContextPageData(db: TenantDb): Promise<ContextPageData> {
  const [rawFiles, products, campaigns] = await Promise.all([
    db.contextFile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        productOffer: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    db.productOffer.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.campaign.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  const featured = rawFiles.find((f) => f.type === "DESIGN_SYSTEM") ?? null;
  const designSystem: DesignSystemDto | null = featured
    ? {
        id: featured.id,
        name: featured.name,
        status: featured.status as ContextStatusDto,
        rawText: featured.rawText,
      }
    : null;

  const files: ContextFileDto[] = rawFiles
    .filter((f) => f.id !== featured?.id)
    .map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type as ContextTypeDto,
      status: f.status as ContextStatusDto,
      linkLabel: f.productOffer?.name ?? f.campaign?.name ?? null,
      linkValue: f.productOffer
        ? `product:${f.productOffer.id}`
        : f.campaign
          ? `campaign:${f.campaign.id}`
          : "",
      rawText: f.rawText,
      hasStorage: Boolean(f.storageKey),
      error: f.error,
      updatedAtIso: f.updatedAt.toISOString(),
    }));

  const linkOptions: LinkOptionDto[] = [
    ...products.map((p) => ({ value: `product:${p.id}`, label: p.name })),
    ...campaigns.map((c) => ({ value: `campaign:${c.id}`, label: c.name })),
  ];

  return { files, designSystem, linkOptions };
}
