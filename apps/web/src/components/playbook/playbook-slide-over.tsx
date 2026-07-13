"use client";

import { pilotPlaybookMarkdown, validatePlaybookMarkdown } from "@sales4u/core";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea, FieldLabel, FieldError } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { SlideOver } from "@/components/ui/slide-over";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { getStagePlaybook, updatePlaybook } from "@/server/pipeline/actions";
import type { AutonomyDto } from "@/server/pipeline/types";

type ConfigMode = "manual" | "markdown";

const AUTONOMY_HINTS: Record<AutonomyDto, string> = {
  DRAFT: "A IA só prepara rascunhos — nada é enviado sem a sua aprovação.",
  SEMI: "A IA envia sozinha, mas pede aprovação para ações sensíveis (desconto, pagamento).",
  AUTO: "A IA envia e executa as ações liberadas sozinha, dentro dos guardrails.",
};

/**
 * Slide-over de configuração do SDR de IA por estágio (engrenagem da coluna).
 * Reutilizável: o módulo SDR importa este componente com os mesmos props.
 */
export function PlaybookSlideOver({
  stageId,
  stageName,
  open,
  onClose,
}: {
  stageId: string | null;
  stageName?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const mdInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<ConfigMode>("manual");
  const [loadedStageName, setLoadedStageName] = useState<string>(stageName ?? "");

  // Campos do modo manual
  const [objective, setObjective] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sendPaymentLink, setSendPaymentLink] = useState(false);
  const [sendSocialProof, setSendSocialProof] = useState(false);
  const [offerDiscount, setOfferDiscount] = useState(false);
  const [advanceWhen, setAdvanceWhen] = useState("");
  const [regressWhen, setRegressWhen] = useState("");
  const [autonomy, setAutonomy] = useState<AutonomyDto>("SEMI");
  const [fieldErrors, setFieldErrors] = useState<{ objective?: string; advanceWhen?: string }>({});

  // Modo markdown
  const [mdText, setMdText] = useState("");
  const [mdFileName, setMdFileName] = useState("");
  const [mdErrors, setMdErrors] = useState<string[]>([]);
  const [mdValid, setMdValid] = useState(false);

  async function load(id: string) {
    setLoading(true);
    setLoadError(null);
    const result = await getStagePlaybook(id);
    setLoading(false);
    if (!result.ok || !result.playbook) {
      setLoadError(result.error ?? "Não foi possível carregar o playbook.");
      return;
    }
    const p = result.playbook;
    setLoadedStageName(p.stageName);
    setMode(p.source === "MARKDOWN" ? "markdown" : "manual");
    setObjective(p.objective);
    setInstructions(p.instructions);
    setSendPaymentLink(p.allowedActions.includes("send_link"));
    setSendSocialProof(p.allowedActions.includes("send_image"));
    setOfferDiscount(p.allowedActions.includes("register_sale"));
    setAdvanceWhen(p.advanceWhen);
    setRegressWhen(p.regressWhen);
    setAutonomy(p.autonomy);
  }

  useEffect(() => {
    if (!open || !stageId) return;
    setLoadedStageName(stageName ?? "");
    setFieldErrors({});
    setMdText("");
    setMdFileName("");
    setMdErrors([]);
    setMdValid(false);
    void load(stageId);
  }, [open, stageId]);

  function handleMdFile(file: File) {
    void file.text().then((text) => {
      setMdFileName(file.name);
      setMdText(text);
      const validation = validatePlaybookMarkdown(text);
      setMdErrors(validation.errors);
      setMdValid(validation.ok);
    });
  }

  function downloadPilot() {
    const md = pilotPlaybookMarkdown(loadedStageName || "Estágio");
    const anchor = document.createElement("a");
    anchor.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`;
    anchor.download = `playbook-${(loadedStageName || "estagio").toLowerCase().replace(/\s+/g, "-")}.md`;
    anchor.click();
  }

  async function handleSave() {
    if (!stageId) return;

    if (mode === "manual") {
      const nextErrors: typeof fieldErrors = {};
      if (!objective.trim()) nextErrors.objective = "Informe o objetivo deste estágio";
      if (!advanceWhen.trim()) nextErrors.advanceWhen = "Informe o critério para avançar";
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
    } else if (!mdValid || !mdText) {
      setMdErrors((prev) => (prev.length > 0 ? prev : ["Anexe um arquivo .md válido antes de salvar."]));
      return;
    }

    setSaving(true);
    const result = await updatePlaybook(
      mode === "manual"
        ? {
            stageId,
            mode: "manual" as const,
            objective: objective.trim(),
            instructions: instructions.trim(),
            sendPaymentLink,
            sendSocialProof,
            offerDiscount,
            advanceWhen: advanceWhen.trim(),
            regressWhen: regressWhen.trim(),
            autonomy,
          }
        : { stageId, mode: "markdown" as const, rawText: mdText, fileName: mdFileName },
    );
    setSaving(false);

    if (result.ok) {
      toast("Playbook salvo — a IA já segue as novas regras neste estágio.");
      onClose();
    } else if (result.errors && result.errors.length > 0) {
      setMdErrors(result.errors);
    } else {
      toast(result.error ?? "Não foi possível salvar o playbook.", "danger");
    }
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      overline="SDR DE IA · ESTE ESTÁGIO"
      title={loadedStageName || stageName || "…"}
      subtitle="Defina como o vendedor de IA age com leads neste estágio."
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
            Salvar playbook
          </Button>
        </div>
      }
    >
      {loadError ? (
        <ErrorState message={loadError} onRetry={() => stageId && void load(stageId)} />
      ) : loading ? (
        <div className="space-y-4">
          <div className="skeleton h-10 w-full rounded-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <FieldLabel>Como configurar</FieldLabel>
            <Segmented<ConfigMode>
              options={[
                { value: "manual", label: "Configurar manual" },
                { value: "markdown", label: "Anexar markdown" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>

          {mode === "manual" ? (
            <>
              <Input
                label="Objetivo neste estágio"
                requiredMark
                placeholder="ex.: Apresentar o curso e criar conexão real com o lead."
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                error={fieldErrors.objective}
              />

              <Textarea
                label="Instruções e tom"
                placeholder="ex.: Apresente o curso com clareza, crie rapport e descubra a dor de liderança. Não fale de preço sem ser perguntado."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />

              <div>
                <FieldLabel>Ações liberadas</FieldLabel>
                <div className="space-y-3.5 rounded-2xl border border-hairline bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-ink">Enviar link de pagamento</span>
                    <Toggle checked={sendPaymentLink} onChange={setSendPaymentLink} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-ink">Enviar prova social / cases</span>
                    <Toggle checked={sendSocialProof} onChange={setSendSocialProof} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-ink">
                      Oferecer desconto — requer aprovação
                    </span>
                    <Toggle checked={offerDiscount} onChange={setOfferDiscount} />
                  </div>
                </div>
              </div>

              <Input
                label="Critério para avançar"
                requiredMark
                placeholder="ex.: Demonstrou interesse claro e perguntou sobre preço ou condições."
                value={advanceWhen}
                onChange={(e) => setAdvanceWhen(e.target.value)}
                error={fieldErrors.advanceWhen}
              />

              <Input
                label="Critério para regredir"
                placeholder="ex.: Ficou 3 dias sem responder ou disse que não é o momento."
                value={regressWhen}
                onChange={(e) => setRegressWhen(e.target.value)}
              />

              <div>
                <FieldLabel required>Nível de autonomia</FieldLabel>
                <Segmented<AutonomyDto>
                  options={[
                    { value: "DRAFT", label: "Rascunho" },
                    { value: "SEMI", label: "Semiauto" },
                    { value: "AUTO", label: "Auto" },
                  ]}
                  value={autonomy}
                  onChange={setAutonomy}
                />
                <p className="mt-2 text-[12px] text-ink-3">{AUTONOMY_HINTS[autonomy]}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] text-ink-3">
                  Configure este estágio com um arquivo .md no formato do doc piloto.
                </p>
                <Button variant="secondary" size="sm" onClick={downloadPilot}>
                  Baixar doc piloto
                </Button>
              </div>

              <input
                ref={mdInputRef}
                type="file"
                accept=".md,text/markdown"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMdFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => mdInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleMdFile(file);
                }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center transition-colors duration-[130ms] hover:border-brand-3/40"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-6 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
                </svg>
                <span className="text-sm font-semibold text-ink">
                  {mdFileName || "Arraste o .md aqui ou clique para escolher"}
                </span>
                <span className="text-[12px] text-ink-3">
                  Seções obrigatórias: Objetivo, Tom e condução, Ações permitidas, Avançar quando.
                </span>
              </button>

              {mdErrors.length > 0 && (
                <div className="rounded-xl border border-danger/25 bg-danger/5 p-3">
                  {mdErrors.map((err, i) => (
                    <FieldError key={i}>{err}</FieldError>
                  ))}
                </div>
              )}

              {mdValid && (
                <p className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-[12.5px] text-success">
                  Markdown válido — pronto para salvar.
                </p>
              )}
            </>
          )}

          <p className="rounded-xl border border-hairline bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-ink-3">
            Guardrails sempre ativos: nunca inventa preço/prazo/promessa; se faltar contexto,
            marca pendente.
          </p>
        </div>
      )}
    </SlideOver>
  );
}
