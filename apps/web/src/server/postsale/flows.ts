/**
 * Definição dos fluxos automáticos de pós-venda (dados puros, sem I/O).
 * O estado on/off vive em Workspace.settings.postSaleFlows.
 */

export type PostSaleFlowKey =
  | "purchaseConfirmation"
  | "instructionsDelivery"
  | "npsSurvey"
  | "testimonialRequest"
  | "upsell"
  | "reactivation";

export interface PostSaleFlowDef {
  key: PostSaleFlowKey;
  title: string;
  /** EmailTemplate.purpose correspondente (para "Editar mensagem" → /emails). */
  emailPurpose: string;
  defaultOn: boolean;
}

export const POST_SALE_FLOWS: readonly PostSaleFlowDef[] = [
  {
    key: "purchaseConfirmation",
    title: "Confirmação da compra",
    emailPurpose: "PURCHASE_CONFIRM",
    defaultOn: true,
  },
  {
    key: "instructionsDelivery",
    title: "Entrega de instruções",
    emailPurpose: "ACCESS",
    defaultOn: true,
  },
  { key: "npsSurvey", title: "Pesquisa NPS", emailPurpose: "NPS", defaultOn: true },
  {
    key: "testimonialRequest",
    title: "Pedido de depoimento",
    emailPurpose: "CUSTOM",
    defaultOn: false,
  },
  { key: "upsell", title: "Oferta complementar (upsell)", emailPurpose: "UPSELL", defaultOn: true },
  { key: "reactivation", title: "Reativação", emailPurpose: "REACTIVATION", defaultOn: true },
];

export const POST_SALE_FLOW_KEYS = POST_SALE_FLOWS.map((f) => f.key) as [
  PostSaleFlowKey,
  ...PostSaleFlowKey[],
];

/** Resolve o mapa on/off a partir de Workspace.settings (JSON), com defaults. */
export function resolveFlowSettings(settings: unknown): Record<PostSaleFlowKey, boolean> {
  const root =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const stored = root["postSaleFlows"];
  const map =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const result = {} as Record<PostSaleFlowKey, boolean>;
  for (const def of POST_SALE_FLOWS) {
    const value = map[def.key];
    result[def.key] = typeof value === "boolean" ? value : def.defaultOn;
  }
  return result;
}
