"use client";

import type { CardIconName, CardVisualState } from "./card-shell";
import { CheckoutCard } from "./checkout-card";
import { CoreCard } from "./core-card";
import { CredentialCard, type CardMode, type CardStateChange } from "./credential-card";
import { DomainCard } from "./domain-card";
import { TrackingCard } from "./tracking-card";
import {
  findView,
  type CoreDetailsDTO,
  type CredentialViewDTO,
  type DomainSettingsDTO,
} from "./types";

/** Provedores com card individual, na ordem do protótipo. */
const SINGLE_CARDS: Array<{ provider: string; icon: CardIconName }> = [
  { provider: "S3", icon: "database" },
  { provider: "ANTHROPIC", icon: "spark" },
  { provider: "EVOLUTION", icon: "whatsapp" },
  { provider: "RESEND", icon: "mail" },
];

const OPTIONAL_SINGLE_CARDS: Array<{ provider: string; icon: CardIconName }> = [
  { provider: "VOYAGE", icon: "layers" },
  { provider: "EXPLORIUM", icon: "search" },
  { provider: "HIGGSFIELD", icon: "image" },
];

/**
 * Pilha de cards de credencial na ordem do protótipo — compartilhada entre
 * o Setup Gate e Configurações › Credenciais & Integrações.
 */
export function CredentialCardsStack({
  views,
  core,
  domains,
  mode,
  states,
  errors,
  onStateChange,
}: {
  views: CredentialViewDTO[];
  core: CoreDetailsDTO;
  domains: DomainSettingsDTO;
  mode: CardMode;
  states: Record<string, CardVisualState>;
  errors: Record<string, string | null>;
  onStateChange: CardStateChange;
}) {
  let index = 0;
  const stagger = () => ({ animationDelay: `${index++ * 40}ms` });

  const single = (provider: string, icon: CardIconName) => {
    const view = findView(views, provider);
    return (
      <div key={provider} className="rise-in" style={stagger()}>
        <CredentialCard
          view={view}
          icon={icon}
          mode={mode}
          state={states[provider] ?? "pending"}
          errorMessage={errors[provider] ?? null}
          onStateChange={onStateChange}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rise-in" style={stagger()}>
        <CoreCard core={core} />
      </div>

      {SINGLE_CARDS.map((card) => single(card.provider, card.icon))}

      <div className="rise-in" style={stagger()}>
        <DomainCard
          domains={domains}
          mode={mode}
          state={states.domain ?? "pending"}
          errorMessage={errors.domain ?? null}
          onStateChange={onStateChange}
        />
      </div>

      {OPTIONAL_SINGLE_CARDS.map((card) => single(card.provider, card.icon))}

      <div className="rise-in" style={stagger()}>
        <CheckoutCard
          views={views}
          mode={mode}
          states={states}
          errors={errors}
          onStateChange={onStateChange}
        />
      </div>

      <div className="rise-in" style={stagger()}>
        <TrackingCard
          views={views}
          mode={mode}
          states={states}
          errors={errors}
          onStateChange={onStateChange}
        />
      </div>
    </div>
  );
}
