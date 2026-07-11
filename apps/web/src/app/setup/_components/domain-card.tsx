"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveDomainsAction, verifyDomainAction } from "@/server/setup/actions";

import { CardShell, type CardVisualState } from "./card-shell";
import { CheckIcon, type CardMode, type CardStateChange } from "./credential-card";
import { DnsTable } from "./dns-table";
import type { DomainSettingsDTO } from "./types";

const EXAMPLE_DNS = [
  { type: "A", host: "app", value: "203.0.113.10" },
  { type: "CNAME", host: "lp", value: "cname.vendaflow.io" },
];

/**
 * Card Domínio & DNS do sistema — persiste em Workspace.settings.domains e
 * verifica a resolução DNS real (em dev, OK pelo ambiente).
 */
export function DomainCard({
  domains,
  mode,
  state,
  errorMessage,
  onStateChange,
}: {
  domains: DomainSettingsDTO;
  mode: CardMode;
  state: CardVisualState;
  errorMessage: string | null;
  onStateChange: CardStateChange;
}) {
  const { toast } = useToast();
  const [appDomain, setAppDomain] = useState(domains.appDomain);
  const [landingDomain, setLandingDomain] = useState(domains.landingDomain);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devOk, setDevOk] = useState(domains.dev && domains.status === "OK");

  async function verify() {
    setPending(true);
    onStateChange("domain", "verifying", null);
    const result = await verifyDomainAction({ appDomain, landingDomain });
    setDevOk(Boolean(result.domains?.dev) && result.ok);
    onStateChange("domain", result.ok ? "ok" : "error", result.error ?? null);
    if (result.ok) toast("Domínio verificado.", "success");
    else toast(result.error ?? "DNS ainda não propagou.", "danger");
    setPending(false);
  }

  async function save() {
    setSaving(true);
    const result = await saveDomainsAction({ appDomain, landingDomain });
    toast(result.ok ? "Domínios salvos." : (result.error ?? "Não foi possível salvar."), result.ok ? "brand" : "danger");
    setSaving(false);
  }

  return (
    <CardShell
      icon="globe"
      title="Domínio & DNS do sistema"
      required={false}
      description="Libera o painel e a publicação das landing pages."
      state={pending ? "verifying" : state}
      error={errorMessage ?? domains.lastError}
      footerLeft={
        <>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={verify}
            className="border-brand-3/40 text-ink"
          >
            Verificar domínio
          </Button>
          <Button variant="ghost" size="sm" loading={saving} onClick={save}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Domínio do app"
          requiredMark={mode === "setup"}
          placeholder="app.seudominio.com"
          value={appDomain}
          spellCheck={false}
          onChange={(event) => setAppDomain(event.target.value)}
        />
        <Input
          label="Domínio das landing pages"
          placeholder="lp.seudominio.com"
          value={landingDomain}
          spellCheck={false}
          onChange={(event) => setLandingDomain(event.target.value)}
        />
      </div>

      <div className="mt-4">
        <DnsTable rows={EXAMPLE_DNS} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-success">
        <CheckIcon /> TLS/HTTPS automático após apontar o domínio
      </p>

      {devOk && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3">
          <span className="text-success">
            <CheckIcon />
          </span>
          OK pelo ambiente (dev) — em produção a verificação resolve o DNS real.
        </p>
      )}
    </CardShell>
  );
}
