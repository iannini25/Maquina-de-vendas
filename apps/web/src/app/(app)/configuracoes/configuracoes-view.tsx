"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";

import { CredentialCardsStack } from "@/app/setup/_components/cards-stack";
import type {
  CoreDetailsDTO,
  CredentialViewDTO,
  DomainSettingsDTO,
} from "@/app/setup/_components/types";
import { useCredentialStates } from "@/app/setup/_components/use-credential-states";

import { TeamTab, type TeamMemberDTO } from "./team-tab";
import { UsageTab, type UsageSummaryDTO } from "./usage-tab";

type TabId = "credentials" | "usage" | "team";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "credentials", label: "Credenciais & Integrações" },
  { id: "usage", label: "Uso & Custos das APIs" },
  { id: "team", label: "Conta & Equipe" },
];

const chipDot: Record<string, string> = {
  ok: "bg-success",
  error: "bg-danger",
  verifying: "bg-brand-2 animate-pulse",
  pending: "bg-ink-3/60",
};

export function ConfiguracoesView({
  views,
  core,
  domains,
  usage,
  team,
  userName,
  userEmail,
  canInvite,
}: {
  views: CredentialViewDTO[];
  core: CoreDetailsDTO;
  domains: DomainSettingsDTO;
  usage: UsageSummaryDTO;
  team: TeamMemberDTO[];
  userName: string;
  userEmail: string;
  canInvite: boolean;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("credentials");
  const { states, errors, setCardState, verifyAll, verifyingAll, chips, counts } =
    useCredentialStates(views, core, domains);

  const allRequiredOk = counts.requiredOk === counts.requiredTotal;
  const pendingCount = counts.requiredTotal - counts.requiredOk;

  async function handleReverifyAll() {
    setTab("credentials");
    const outcome = await verifyAll();
    const total = Object.keys(outcome).length;
    if (total === 0) {
      toast("Nenhuma credencial salva ainda — preencha os cards e verifique.");
      return;
    }
    const okCount = Object.values(outcome).filter(Boolean).length;
    toast(
      okCount === total
        ? "Tudo verificado — credenciais conectadas."
        : `Verificação concluída — ${okCount} de ${total} conectadas.`,
      okCount === total ? "success" : "brand",
    );
  }

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Suas chaves, segredos e domínio — o sistema se auto-configura"
        actions={
          <Button variant="primary" loading={verifyingAll} onClick={handleReverifyAll}>
            Re-verificar tudo
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* Sub-navegação lateral própria */}
        <nav aria-label="Seções de configurações" className="w-full shrink-0 lg:w-56">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {TABS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "w-full whitespace-nowrap rounded-[11px] px-4 py-2.5 text-left text-[13px] transition-colors duration-[130ms]",
                    tab === item.id
                      ? "bg-brand-soft font-medium text-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          {tab === "credentials" && (
            <div className="space-y-4">
              {/* Banner de status real */}
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-2xl border px-4.5 py-3.5",
                  allRequiredOk
                    ? "border-success/25 bg-success/[.06]"
                    : "border-warm/25 bg-warm/[.06]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    allRequiredOk ? "bg-success" : "bg-warm",
                  )}
                />
                <span
                  className={cn(
                    "text-[13px] font-semibold",
                    allRequiredOk ? "text-success" : "text-warm",
                  )}
                >
                  {allRequiredOk
                    ? "Tudo funcionando"
                    : `${pendingCount} ${pendingCount === 1 ? "pendente" : "pendentes"}`}
                </span>
                <span className="text-[12.5px] text-ink-2">
                  Cada login é um ambiente isolado · as chaves se auto-aplicam ao validar.
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="ml-auto"
                  loading={verifyingAll}
                  onClick={handleReverifyAll}
                >
                  Re-verificar tudo
                </Button>
              </div>

              {/* Grade de chips de status */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {chips.map((chip) => (
                  <span
                    key={chip.id}
                    className="flex items-center gap-2 truncate rounded-full border border-hairline bg-surface-2 px-3.5 py-2 text-[12px] text-ink-2"
                    title={chip.title}
                  >
                    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", chipDot[chip.state])} />
                    <span className="truncate">{chip.title}</span>
                  </span>
                ))}
              </div>

              {/* Banner escudo */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-brand-3/25 bg-brand-soft px-4.5 py-3 text-[12.5px] text-accent">
                <svg
                  viewBox="0 0 24 24"
                  className="size-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3 5 5.7v5c0 4.4 3 8.1 7 9.3 4-1.2 7-4.9 7-9.3v-5L12 3Z" />
                </svg>
                Chaves guardadas criptografadas; nunca expostas no front. Use Mostrar / Substituir
                em cada segredo.
              </div>

              <CredentialCardsStack
                views={views}
                core={core}
                domains={domains}
                mode="settings"
                states={states}
                errors={errors}
                onStateChange={setCardState}
              />
            </div>
          )}

          {tab === "usage" && <UsageTab usage={usage} />}

          {tab === "team" && (
            <TeamTab
              team={team}
              userName={userName}
              userEmail={userEmail}
              canInvite={canInvite}
            />
          )}
        </div>
      </div>
    </>
  );
}
