import { hasAiCredential } from "@/lib/ai";
import type { WorkspaceContext } from "@/lib/session";

/**
 * Queries do módulo Criar com IA (hub + fluxos).
 * Client components importam apenas os TIPOS deste arquivo (`import type`).
 */

export interface StudioProduct {
  id: string;
  name: string;
  priceCents: number;
}

export interface StudioContextFile {
  id: string;
  name: string;
}

export interface StudioTemplate {
  id: string;
  name: string;
  source: "BUILTIN" | "UPLOADED" | "LINK";
}

export interface StudioStage {
  id: string;
  name: string;
}

export interface StudioPageData {
  products: StudioProduct[];
  /** Arquivos de contexto INDEXED (chips selecionáveis). */
  contextFiles: StudioContextFile[];
  /** Templates kind LANDING (biblioteca + seletor da landing completa). */
  templates: StudioTemplate[];
  /** Estágios do pipeline (fluxo Mensagem de WhatsApp). */
  stages: StudioStage[];
  hasAi: boolean;
  hasDesignSystem: boolean;
}

export async function getStudioPageData(ctx: WorkspaceContext): Promise<StudioPageData> {
  const [products, contextFiles, templates, stages, designSystem, hasAi] = await Promise.all([
    ctx.db.productOffer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, priceCents: true },
    }),
    ctx.db.contextFile.findMany({
      where: { status: "INDEXED", type: { not: "DESIGN_SYSTEM" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    ctx.db.template.findMany({
      where: { kind: "LANDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, source: true },
    }),
    ctx.db.pipelineStage.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    ctx.db.contextFile.findFirst({
      where: { type: "DESIGN_SYSTEM" },
      select: { id: true },
    }),
    hasAiCredential(ctx.workspaceId),
  ]);

  return {
    products,
    contextFiles,
    templates,
    stages,
    hasAi,
    hasDesignSystem: designSystem !== null,
  };
}
