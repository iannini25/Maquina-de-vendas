"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { FieldLabel } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { saveCredentialAction } from "@/server/credentials/actions";

import { CardShell, type CardVisualState } from "./card-shell";
import type { CardMode, CardStateChange } from "./credential-card";
import { CHECKOUT_PROVIDERS, findView, type CredentialViewDTO } from "./types";
import { groupVisualState } from "./use-credential-states";

type CheckoutProvider = (typeof CHECKOUT_PROVIDERS)[number];

const PROVIDER_LABELS: Record<CheckoutProvider, string> = {
  HOTMART: "Hotmart",
  KIWIFY: "Kiwify",
  EDUZZ: "Eduzz",
  STRIPE: "Stripe",
};

/**
 * Card Checkout / Pagamentos — um card do protótipo, quatro provedores reais
 * (Hotmart/Kiwify/Eduzz/Stripe) escolhidos no segmented.
 */
export function CheckoutCard({
  views,
  mode,
  states,
  errors,
  onStateChange,
}: {
  views: CredentialViewDTO[];
  mode: CardMode;
  states: Record<string, CardVisualState>;
  errors: Record<string, string | null>;
  onStateChange: CardStateChange;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<CheckoutProvider>(() => {
    const connected = CHECKOUT_PROVIDERS.find((p) => findView(views, p).status === "OK");
    return connected ?? "HOTMART";
  });
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const view = findView(views, selected);
  const field = view.fields[0] ?? { key: "webhookToken", label: "Segredo do webhook", secret: true };
  const groupState = pending
    ? "verifying"
    : groupVisualState(CHECKOUT_PROVIDERS.map((p) => states[p] ?? "pending"));
  const selectedError = errors[selected] ?? view.lastError;

  async function verify() {
    setPending(true);
    onStateChange(selected, "verifying", null);
    const result = await saveCredentialAction(selected, { [field.key]: secret });
    onStateChange(selected, result.ok ? "ok" : "error", result.error ?? null);
    if (result.ok) toast(`${PROVIDER_LABELS[selected]} — conectado.`, "success");
    else toast(result.error ?? "Falha na verificação.", "danger");
    setPending(false);
  }

  return (
    <CardShell
      icon="card"
      title="Checkout / Pagamentos"
      required={false}
      description="Libera vendas em tempo real no ROI."
      state={groupState}
      error={groupState === "error" ? selectedError : null}
      footerLeft={
        <>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={verify}
            className="border-brand-3/40 text-ink"
          >
            {mode === "settings" ? "Verificar / Testar" : "Verificar"}
          </Button>
          {mode === "setup" && (
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? "Configurar agora" : "Configurar depois"}
            </Button>
          )}
        </>
      }
    >
      {!collapsed ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Provedor</FieldLabel>
            <Segmented
              size="sm"
              options={CHECKOUT_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }))}
              value={selected}
              onChange={(value) => {
                setSelected(value);
                setSecret("");
              }}
            />
            <p className="mt-1.5 text-[11px] text-ink-3">
              {findView(views, selected).status === "OK"
                ? `${PROVIDER_LABELS[selected]} já conectado — digite para substituir o segredo.`
                : "As vendas entram no ROI via webhook do provedor."}
            </p>
          </div>
          <Input
            label={field.label}
            placeholder={field.placeholder ?? "••••••••••••"}
            value={secret}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setSecret(event.target.value)}
          />
        </div>
      ) : null}
    </CardShell>
  );
}
