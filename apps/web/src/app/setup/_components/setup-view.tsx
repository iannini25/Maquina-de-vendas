"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { releaseSystemAction } from "@/server/credentials/actions";

import { CredentialCardsStack } from "./cards-stack";
import { Sales4ULogo } from "./logo";
import type { CoreDetailsDTO, CredentialViewDTO, DomainSettingsDTO } from "./types";
import { useCredentialStates } from "./use-credential-states";

/** Setup Gate — página própria sem sidebar, coluna central ~860px. */
export function SetupGateView({
  views,
  core,
  domains,
  alreadyCompleted,
}: {
  views: CredentialViewDTO[];
  core: CoreDetailsDTO;
  domains: DomainSettingsDTO;
  /** SetupState.completedAt já existe (ex.: liberado noutro navegador). */
  alreadyCompleted?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { states, errors, setCardState, verifyAll, verifyingAll, counts, canRelease } =
    useCredentialStates(views, core, domains);
  const [releasing, setReleasing] = useState(false);

  async function handleVerifyAll() {
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

  async function release() {
    setReleasing(true);
    const result = await releaseSystemAction();
    if (!result.ok) {
      toast(result.error ?? "Ainda faltam credenciais obrigatórias.", "danger");
      setReleasing(false);
      return;
    }
    toast("Ambiente pronto. Bora vender.");
    // Deixa o toast aparecer antes de trocar de rota (o provider desmonta).
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 900);
  }

  const progress = (counts.requiredOk / counts.requiredTotal) * 100;

  return (
    <main className="relative min-h-dvh pb-32">
      <div className="mx-auto w-full max-w-[860px] px-6 pt-14">
        <div className="rise-in">
          <Sales4ULogo />
          <h1 className="mt-7 font-display text-[27px] font-semibold tracking-tight text-ink">
            Configuração inicial do ambiente
          </h1>
          <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink-2">
            Cada login é um ambiente isolado. Pluga suas próprias chaves e o sistema se
            auto-configura — o acesso libera quando todas as credenciais obrigatórias ficarem
            verdes.
          </p>
        </div>

        {alreadyCompleted && (
          <p className="rise-in mt-6 rounded-2xl border border-brand-3/25 bg-brand-soft px-4.5 py-3 text-[12.5px] text-accent">
            Este ambiente já foi liberado em outro acesso — confirme em “Liberar sistema” para
            entrar no painel.
          </p>
        )}

        <div className="rise-in mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "40ms" }}>
          <ProgressBar value={progress} className="max-w-[340px] flex-1 basis-48" />
          <p className="text-[13px] text-ink-2">
            <span className="font-semibold text-ink">{counts.requiredOk} de {counts.requiredTotal}</span>{" "}
            obrigatórios verificados
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            loading={verifyingAll}
            onClick={handleVerifyAll}
          >
            Verificar todos
          </Button>
        </div>

        <div className="mt-6">
          <CredentialCardsStack
            views={views}
            core={core}
            domains={domains}
            mode="setup"
            states={states}
            errors={errors}
            onStateChange={setCardState}
          />
        </div>
      </div>

      {/* Barra fixa inferior */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline-soft bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-[76px] w-full max-w-[860px] items-center justify-between gap-4 px-6">
          <p className="text-[13px] text-ink-2">
            <span className="font-semibold text-ink">
              {counts.requiredOk}/{counts.requiredTotal}
            </span>{" "}
            obrigatórios · {counts.optionalOk}/{counts.optionalTotal} opcionais
          </p>
          <Button
            variant={canRelease ? "primary" : "secondary"}
            size="lg"
            disabled={!canRelease}
            loading={releasing}
            onClick={release}
          >
            Liberar sistema
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 12h16m-6-6 6 6-6 6" />
            </svg>
          </Button>
        </div>
      </div>
    </main>
  );
}
