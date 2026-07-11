import {
  CHECKOUT_PROVIDERS,
  TRACKING_PROVIDERS,
  type CoreDetailsDTO,
  type CredentialViewDTO,
  type DomainSettingsDTO,
} from "./types";

/**
 * Deriva o estado dos "cards" (grupos visuais do protótipo) a partir das
 * credenciais reais: chips de status, contadores e barra de progresso.
 */

export type CardState = "ok" | "pending" | "error";

export interface CardStatus {
  id: string;
  title: string;
  state: CardState;
  required: boolean;
}

function stateOf(view: CredentialViewDTO): CardState {
  if (view.status === "OK") return "ok";
  if (view.status === "ERROR") return "error";
  return "pending";
}

function groupState(views: CredentialViewDTO[]): CardState {
  if (views.some((v) => v.status === "OK")) return "ok";
  if (views.some((v) => v.status === "ERROR")) return "error";
  return "pending";
}

export function deriveCards(
  views: CredentialViewDTO[],
  core: CoreDetailsDTO,
  domains: DomainSettingsDTO,
): CardStatus[] {
  const byProvider = new Map(views.map((v) => [v.provider, v]));
  const view = (provider: string): CredentialViewDTO => {
    const found = byProvider.get(provider);
    if (!found) throw new Error(`Credencial ${provider} ausente`);
    return found;
  };

  return [
    {
      id: "core",
      title: "Núcleo & Segurança",
      state: core.ok ? "ok" : "pending",
      required: true,
    },
    { id: "S3", title: view("S3").title, state: stateOf(view("S3")), required: true },
    {
      id: "ANTHROPIC",
      title: view("ANTHROPIC").title,
      state: stateOf(view("ANTHROPIC")),
      required: true,
    },
    {
      id: "EVOLUTION",
      title: view("EVOLUTION").title,
      state: stateOf(view("EVOLUTION")),
      required: true,
    },
    { id: "RESEND", title: view("RESEND").title, state: stateOf(view("RESEND")), required: true },
    {
      id: "domain",
      title: "Domínio & DNS do sistema",
      state: domains.status === "OK" ? "ok" : domains.status === "ERROR" ? "error" : "pending",
      required: false,
    },
    { id: "VOYAGE", title: view("VOYAGE").title, state: stateOf(view("VOYAGE")), required: false },
    {
      id: "EXPLORIUM",
      title: view("EXPLORIUM").title,
      state: stateOf(view("EXPLORIUM")),
      required: false,
    },
    {
      id: "HIGGSFIELD",
      title: view("HIGGSFIELD").title,
      state: stateOf(view("HIGGSFIELD")),
      required: false,
    },
    {
      id: "checkout",
      title: "Checkout / Pagamentos",
      state: groupState(CHECKOUT_PROVIDERS.map((p) => view(p))),
      required: false,
    },
    {
      id: "tracking",
      title: "Rastreamento / Pixels",
      state: groupState(TRACKING_PROVIDERS.map((p) => view(p))),
      required: false,
    },
  ];
}

export interface SetupCounts {
  requiredOk: number;
  requiredTotal: number;
  optionalOk: number;
  optionalTotal: number;
}

export function deriveCounts(cards: CardStatus[]): SetupCounts {
  const required = cards.filter((c) => c.required);
  const optional = cards.filter((c) => !c.required);
  return {
    requiredOk: required.filter((c) => c.state === "ok").length,
    requiredTotal: required.length,
    optionalOk: optional.filter((c) => c.state === "ok").length,
    optionalTotal: optional.length,
  };
}
