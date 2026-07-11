"use client";

import { useCallback, useRef, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { SdrActionResult, SdrPageData } from "@/server/sdr/types";

import { CadencesTab } from "./cadences-tab";
import { GuardrailsTab } from "./guardrails-tab";
import { ModesTab } from "./modes-tab";
import { PersonaTab } from "./persona-tab";
import { PlaybooksTab } from "./playbooks-tab";

/** Tela SDR de IA — 5 abas do protótipo; o CTA do topo salva a aba ativa. */

type TabKey = "persona" | "modos" | "playbooks" | "guardrails" | "cadencias";

const TABS: Array<{ value: TabKey; label: string }> = [
  { value: "persona", label: "Persona" },
  { value: "modos", label: "Modos do agente" },
  { value: "playbooks", label: "Playbooks por estágio" },
  { value: "guardrails", label: "Guardrails" },
  { value: "cadencias", label: "Cadências" },
];

export type SaveHandler = () => Promise<SdrActionResult>;

export function SdrView({ data }: { data: SdrPageData }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("persona");
  const [saving, setSaving] = useState(false);
  const savesRef = useRef<Partial<Record<TabKey, SaveHandler>>>({});

  const registerSave = useCallback((key: TabKey) => {
    return (handler: SaveHandler) => {
      savesRef.current[key] = handler;
    };
  }, []);

  async function handleSave() {
    const save = savesRef.current[tab];
    if (!save) {
      // Playbooks salvam no próprio slide-over — nada pendente nesta aba.
      toast("Configuração do SDR salva.");
      return;
    }
    setSaving(true);
    const result = await save();
    setSaving(false);
    if (result.ok) toast("Configuração do SDR salva.");
    else toast(result.error ?? "Não foi possível salvar a configuração.", "danger");
  }

  return (
    <>
      <PageHeader
        title="SDR de IA"
        subtitle="Configure seu vendedor de IA"
        actions={
          <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
            Salvar configuração
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Button>
        }
      />

      <div className="p-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {/* Abas ficam montadas (hidden) para não perder edições ao alternar. */}
        <div className="mt-6">
          <div className={tab === "persona" ? "" : "hidden"}>
            <PersonaTab
              persona={data.persona}
              productName={data.productName}
              productPriceCents={data.productPriceCents}
              canUseAi={data.canUseAi}
              onRegisterSave={registerSave("persona")}
            />
          </div>
          <div className={tab === "modos" ? "" : "hidden"}>
            <ModesTab modes={data.modes} onRegisterSave={registerSave("modos")} />
          </div>
          <div className={tab === "playbooks" ? "" : "hidden"}>
            <PlaybooksTab stages={data.stages} />
          </div>
          <div className={tab === "guardrails" ? "" : "hidden"}>
            <GuardrailsTab
              guardrails={data.guardrails}
              handoffKeywords={data.handoffKeywords}
              onRegisterSave={registerSave("guardrails")}
            />
          </div>
          <div className={tab === "cadencias" ? "" : "hidden"}>
            <CadencesTab
              cadence={data.cadence}
              canUseAi={data.canUseAi}
              onRegisterSave={registerSave("cadencias")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
