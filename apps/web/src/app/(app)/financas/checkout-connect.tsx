"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { SlideOver } from "@/components/ui/slide-over";
import { useToast } from "@/components/ui/toast";
import { saveCredentialAction } from "@/server/credentials/actions";
import { saveCheckoutMappings, testCheckoutWebhook } from "@/server/finance/actions";
import type {
  CheckoutMappingEntry,
  CheckoutProviderView,
  ProductOption,
} from "@/server/finance/queries";

function statusBadge(status: CheckoutProviderView["credentialStatus"]) {
  if (status === "OK") return <Badge tone="success" dot>Conectado</Badge>;
  if (status === "ERROR") return <Badge tone="danger" dot>Erro</Badge>;
  if (status === "PENDING") return <Badge tone="warn" dot>Pendente</Badge>;
  return <Badge tone="muted" dot>Não configurado</Badge>;
}

interface TestState {
  loading: boolean;
  message: string | null;
  ok: boolean;
}

/** Configuração de um provedor: status, URL do webhook, segredo, mapeamento e teste. */
function ProviderSection({
  view,
  products,
}: {
  view: CheckoutProviderView;
  products: ProductOption[];
}) {
  const { toast } = useToast();
  const [secret, setSecret] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);
  const [mappings, setMappings] = useState<CheckoutMappingEntry[]>(
    view.mappings.length > 0
      ? view.mappings
      : [{ externalId: "", productOfferId: products[0]?.id ?? "" }],
  );
  const [savingMappings, setSavingMappings] = useState(false);
  const [test, setTest] = useState<TestState>({ loading: false, message: null, ok: false });

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(view.webhookUrl);
      toast("URL do webhook copiada.");
    } catch {
      toast("Não consegui copiar — selecione e copie manualmente.", "danger");
    }
  };

  const saveSecret = async () => {
    if (!secret.trim()) {
      toast("Cole o segredo antes de salvar.", "danger");
      return;
    }
    setSavingSecret(true);
    const key = view.provider === "STRIPE" ? "webhookSecret" : "webhookToken";
    const result = await saveCredentialAction(view.provider, { [key]: secret.trim() });
    setSavingSecret(false);
    if (result.ok) {
      setSecret("");
      toast(`${view.label} conectado.`, "success");
    } else {
      toast(result.error ?? "Falha ao salvar a credencial.", "danger");
    }
  };

  const saveMappings = async () => {
    const entries = mappings.filter((m) => m.externalId.trim() !== "" && m.productOfferId !== "");
    setSavingMappings(true);
    const result = await saveCheckoutMappings(view.provider, entries);
    setSavingMappings(false);
    if (result.ok) toast("Mapeamento de produtos salvo.");
    else toast(result.error ?? "Falha ao salvar o mapeamento.", "danger");
  };

  const runTest = async () => {
    setTest({ loading: true, message: null, ok: false });
    const result = await testCheckoutWebhook(view.provider);
    if (result.ok) {
      setTest({
        loading: false,
        ok: true,
        message: `Webhook OK (HTTP ${result.httpStatus}) — assinatura validada e venda de teste processada (e removida).`,
      });
    } else {
      setTest({
        loading: false,
        ok: false,
        message: result.error ?? "O teste falhou.",
      });
    }
  };

  return (
    <section className="rounded-2xl border border-hairline bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{view.label}</h3>
        {statusBadge(view.credentialStatus)}
      </div>

      <div className="mt-3">
        <FieldLabel>URL do webhook (cole no painel do {view.label})</FieldLabel>
        <div className="flex gap-2">
          <input
            readOnly
            value={view.webhookUrl}
            aria-label={`URL do webhook ${view.label}`}
            className="w-full rounded-[11px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[12px] text-ink-2"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button size="sm" onClick={() => void copyUrl()} className="shrink-0 self-center">
            Copiar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={view.secretLabel}
            type="password"
            placeholder={view.secretPlaceholder}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Button size="sm" loading={savingSecret} onClick={() => void saveSecret()} className="mb-0.5">
          Salvar
        </Button>
      </div>

      <div className="mt-4">
        <FieldLabel hint="sem mapeamento, a venda cai no 1º produto">
          Mapeamento de produto
        </FieldLabel>
        <div className="flex flex-col gap-2">
          {mappings.map((mapping, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  aria-label={`ID do produto no ${view.label}`}
                  placeholder={`ID do produto no ${view.label}`}
                  value={mapping.externalId}
                  onChange={(event) =>
                    setMappings((current) =>
                      current.map((m, i) =>
                        i === index ? { ...m, externalId: event.target.value } : m,
                      ),
                    )
                  }
                />
              </div>
              <div className="w-52 shrink-0">
                <Select
                  aria-label="Produto do Sales4U"
                  value={mapping.productOfferId}
                  onChange={(event) =>
                    setMappings((current) =>
                      current.map((m, i) =>
                        i === index ? { ...m, productOfferId: event.target.value } : m,
                      ),
                    )
                  }
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                aria-label="Remover mapeamento"
                onClick={() =>
                  setMappings((current) => current.filter((_, i) => i !== index))
                }
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-danger/10 hover:text-danger"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMappings((current) => [
                ...current,
                { externalId: "", productOfferId: products[0]?.id ?? "" },
              ])
            }
          >
            + Adicionar mapeamento
          </Button>
          <Button size="sm" loading={savingMappings} onClick={() => void saveMappings()}>
            Salvar mapeamentos
          </Button>
        </div>
      </div>

      <div className="mt-4 border-t border-hairline-soft pt-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" loading={test.loading} onClick={() => void runTest()}>
            Testar
          </Button>
          <p className="text-[11.5px] text-ink-3">
            Envia um payload de exemplo assinado para o próprio endpoint.
          </p>
        </div>
        {test.message && (
          <p
            role="status"
            className={`mt-2 rounded-xl border px-3 py-2 text-[12px] ${
              test.ok
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {test.message}
          </p>
        )}
      </div>
    </section>
  );
}

/** SlideOver "Conectar checkout" — 4 provedores (Hotmart/Kiwify/Eduzz/Stripe). */
export function CheckoutConnectPanel({
  open,
  onClose,
  providers,
  products,
}: {
  open: boolean;
  onClose: () => void;
  providers: CheckoutProviderView[];
  products: ProductOption[];
}) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      overline="Integração"
      title="Conectar checkout"
      subtitle="Cole a URL do webhook no provedor, salve o segredo e teste — vendas entram sozinhas."
      width="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {providers.map((view) => (
          <ProviderSection key={view.provider} view={view} products={products} />
        ))}
      </div>
    </SlideOver>
  );
}
