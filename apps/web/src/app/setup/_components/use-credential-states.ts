"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { reverifyAllAction } from "@/server/credentials/actions";

import type { CardVisualState } from "./card-shell";
import {
  CHECKOUT_PROVIDERS,
  findView,
  TRACKING_PROVIDERS,
  type CoreDetailsDTO,
  type CredentialViewDTO,
  type DomainSettingsDTO,
} from "./types";

/**
 * Estado vivo dos cards do Setup Gate/Configurações: um mapa id→estado que
 * começa nos dados reais do servidor e é atualizado a cada verificação.
 * Ids: provedores + "core" (ambiente) + "domain" (Workspace.settings.domains).
 */

/** Estado do grupo: verificando > algum OK > algum erro > pendente. */
export function groupVisualState(states: CardVisualState[]): CardVisualState {
  if (states.includes("verifying")) return "verifying";
  if (states.includes("ok")) return "ok";
  if (states.includes("error")) return "error";
  return "pending";
}

function stateOfView(view: CredentialViewDTO): CardVisualState {
  if (view.status === "OK") return "ok";
  if (view.status === "ERROR") return "error";
  return "pending";
}

function initialStates(
  views: CredentialViewDTO[],
  core: CoreDetailsDTO,
  domains: DomainSettingsDTO,
): Record<string, CardVisualState> {
  const map: Record<string, CardVisualState> = {
    core: core.ok ? "ok" : "pending",
    domain: domains.status === "OK" ? "ok" : domains.status === "ERROR" ? "error" : "pending",
  };
  for (const view of views) map[view.provider] = stateOfView(view);
  return map;
}

export interface CardChip {
  id: string;
  title: string;
  state: CardVisualState;
  required: boolean;
}

const REQUIRED_IDS = ["core", "S3", "ANTHROPIC", "EVOLUTION", "RESEND"] as const;
const OPTIONAL_IDS = ["domain", "VOYAGE", "EXPLORIUM", "HIGGSFIELD", "checkout", "tracking"] as const;

export interface SetupCounts {
  requiredOk: number;
  requiredTotal: number;
  optionalOk: number;
  optionalTotal: number;
}

export function useCredentialStates(
  views: CredentialViewDTO[],
  core: CoreDetailsDTO,
  domains: DomainSettingsDTO,
) {
  const [states, setStates] = useState<Record<string, CardVisualState>>(() =>
    initialStates(views, core, domains),
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [verifyingAll, setVerifyingAll] = useState(false);

  // Re-sincroniza quando o servidor revalida as props (após cada action).
  const syncKey = JSON.stringify([
    views.map((v) => [v.provider, v.status, v.lastCheckAt]),
    core.ok,
    domains.status,
  ]);
  const lastSync = useRef(syncKey);
  useEffect(() => {
    if (lastSync.current === syncKey) return;
    lastSync.current = syncKey;
    setStates(initialStates(views, core, domains));
  }, [syncKey, views, core, domains]);

  const setCardState = useCallback(
    (id: string, state: CardVisualState, error?: string | null) => {
      setStates((current) => ({ ...current, [id]: state }));
      setErrors((current) => ({ ...current, [id]: error ?? null }));
    },
    [],
  );

  /** [Verificar todos] — re-verifica todas as credenciais já salvas. */
  const verifyAll = useCallback(async (): Promise<Record<string, boolean>> => {
    setVerifyingAll(true);
    const verifiable = views
      .filter((view) => view.status !== "MISSING" || view.provider === "S3")
      .map((view) => view.provider);

    setStates((current) => {
      const next = { ...current };
      for (const provider of verifiable) next[provider] = "verifying";
      return next;
    });

    const outcome = await reverifyAllAction();

    setStates((current) => {
      const next = { ...current };
      for (const provider of verifiable) {
        next[provider] =
          provider in outcome
            ? outcome[provider]
              ? "ok"
              : "error"
            : stateOfView(findView(views, provider));
      }
      return next;
    });
    setVerifyingAll(false);
    return outcome;
  }, [views]);

  const stateOf = (id: string): CardVisualState => {
    if (id === "checkout") {
      return groupVisualState(CHECKOUT_PROVIDERS.map((p) => states[p] ?? "pending"));
    }
    if (id === "tracking") {
      return groupVisualState(TRACKING_PROVIDERS.map((p) => states[p] ?? "pending"));
    }
    return states[id] ?? "pending";
  };

  const titleOf = (id: string): string => {
    if (id === "core") return "Núcleo & Segurança";
    if (id === "domain") return "Domínio & DNS do sistema";
    if (id === "checkout") return "Checkout / Pagamentos";
    if (id === "tracking") return "Rastreamento / Pixels";
    return findView(views, id).title;
  };

  const chips: CardChip[] = [
    ...REQUIRED_IDS.map((id) => ({ id, title: titleOf(id), state: stateOf(id), required: true })),
    ...OPTIONAL_IDS.map((id) => ({ id, title: titleOf(id), state: stateOf(id), required: false })),
  ];

  const counts: SetupCounts = {
    requiredOk: REQUIRED_IDS.filter((id) => stateOf(id) === "ok").length,
    requiredTotal: REQUIRED_IDS.length,
    optionalOk: OPTIONAL_IDS.filter((id) => stateOf(id) === "ok").length,
    optionalTotal: OPTIONAL_IDS.length,
  };

  const canRelease = counts.requiredOk === counts.requiredTotal;

  return { states, errors, setCardState, verifyAll, verifyingAll, chips, counts, canRelease };
}
