"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Overline } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import {
  activateEmailTemplateAction,
  generateEmailBodyAction,
  renderEmailPreviewAction,
  saveEmailTemplateAction,
  sendTestEmailAction,
  uploadEmailLogoAction,
} from "@/server/email-templates/actions";
import type { EmailEditorPageData, EmailPurposeDto } from "@/server/email-templates/queries";

/** Editor de template: coluna Estrutura & Branding + preview renderizado. */

const VARIABLE_CHIPS = ["{nome}", "{produto}", "{link_acesso}", "{valor}", "{data}"] as const;

const PURPOSE_OPTIONS: Array<{ value: EmailPurposeDto; label: string }> = [
  { value: "PURCHASE_CONFIRM", label: "Confirmação de compra · Pós-venda" },
  { value: "ACCESS", label: "Entrega de acesso · Pós-venda" },
  { value: "WELCOME", label: "Boas-vindas · Automação" },
  { value: "NPS", label: "Pesquisa NPS · Pós-venda" },
  { value: "UPSELL", label: "Oferta complementar (upsell) · Pós-venda" },
  { value: "REACTIVATION", label: "Reativação · Automação" },
  { value: "PASSWORD", label: "Recuperação de senha · Sistema" },
  { value: "LIVE_REMINDER", label: "Lembrete de live · Campanha" },
  { value: "CUSTOM", label: "Personalizado" },
];

interface EditorFields {
  name: string;
  purpose: EmailPurposeDto;
  bodySource: "AI" | "MANUAL";
  bodyText: string;
  headerTitle: string;
  headerLogoUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  footerText: string;
  accentColor: string;
  backgroundColor: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-semibold text-ink">{children}</h3>;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink-2">
      {label}
      <span className="relative inline-flex size-7 overflow-hidden rounded-lg border border-hairline">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="absolute -inset-1 size-9 cursor-pointer border-0 bg-transparent p-0"
        />
      </span>
    </label>
  );
}

export function EmailEditorView({ data }: { data: EmailEditorPageData }) {
  const router = useRouter();
  const { toast } = useToast();

  const [templateId, setTemplateId] = useState(data.template.id);
  const [status, setStatus] = useState(data.template.status);
  const [fields, setFields] = useState<EditorFields>({
    name: data.template.name,
    purpose: data.template.purpose,
    bodySource: data.template.bodySource,
    bodyText: data.template.bodyText,
    headerTitle: data.template.headerTitle,
    headerLogoUrl: data.template.headerLogoUrl,
    buttonLabel: data.template.buttonLabel,
    buttonUrl: data.template.buttonUrl,
    footerText: data.template.footerText,
    accentColor: data.template.accentColor,
    backgroundColor: data.template.backgroundColor,
  });

  const [previewHtml, setPreviewHtml] = useState(data.initialHtml);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const previewRequest = useRef(0);
  const firstRender = useRef(true);

  const set = useCallback(<K extends keyof EditorFields>(key: K, value: EditorFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  }, []);

  // Preview ao vivo: debounce de 400ms → renderEmail no servidor.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const requestId = ++previewRequest.current;
    const timer = setTimeout(async () => {
      const result = await renderEmailPreviewAction({ ...fields });
      if (result.ok && result.html && previewRequest.current === requestId) {
        setPreviewHtml(result.html);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [fields]);

  function buildInput() {
    return { id: templateId, ...fields };
  }

  function validateName(): boolean {
    if (!fields.name.trim()) {
      setNameError("Dê um nome ao template.");
      return false;
    }
    setNameError(undefined);
    return true;
  }

  async function handleSave() {
    if (!validateName()) return;
    setSaving(true);
    const result = await saveEmailTemplateAction(buildInput());
    setSaving(false);
    if (!result.ok || !result.id) {
      toast(result.error ?? "Não foi possível salvar.", "danger");
      return;
    }
    if (!templateId) {
      setTemplateId(result.id);
      window.history.replaceState(null, "", `/emails/${result.id}`);
    }
    if (result.status) setStatus(result.status);
    toast("Template salvo.");
  }

  async function handleActivate() {
    if (!validateName()) return;
    setActivating(true);
    const result = await activateEmailTemplateAction(buildInput());
    setActivating(false);
    if (!result.ok || !result.id) {
      toast(result.error ?? "Não foi possível ativar.", "danger");
      return;
    }
    if (!templateId) {
      setTemplateId(result.id);
      window.history.replaceState(null, "", `/emails/${result.id}`);
    }
    setStatus("ACTIVE");
    toast("Template ativado.", "success");
  }

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateEmailBodyAction({
      purpose: fields.purpose,
      name: fields.name,
      currentBody: fields.bodyText,
    });
    setGenerating(false);
    if (!result.ok || !result.bodyText) {
      toast(result.error ?? "Não foi possível gerar o corpo.", "danger");
      return;
    }
    setFields((current) => ({ ...current, bodyText: result.bodyText ?? current.bodyText, bodySource: "AI" }));
    toast("Corpo gerado com IA.");
  }

  function insertVariable(variable: string) {
    const textarea = bodyRef.current;
    setFields((current) => {
      const start = textarea?.selectionStart ?? current.bodyText.length;
      const end = textarea?.selectionEnd ?? current.bodyText.length;
      const bodyText = current.bodyText.slice(0, start) + variable + current.bodyText.slice(end);
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(start + variable.length, start + variable.length);
      });
      return { ...current, bodyText, bodySource: "MANUAL" };
    });
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    const formData = new FormData();
    formData.set("logo", file);
    const result = await uploadEmailLogoAction(formData);
    setUploadingLogo(false);
    if (!result.ok || !result.url) {
      toast(result.error ?? "Não foi possível enviar o logo.", "danger");
      return;
    }
    set("headerLogoUrl", result.url);
    toast("Logo enviado.");
  }

  async function handleSendTest() {
    setSendingTest(true);
    const result = await sendTestEmailAction({ to: testEmail, fields: { ...fields } });
    setSendingTest(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível enviar o teste.", "danger");
      return;
    }
    setTestOpen(false);
    toast(`E-mail de teste enviado para ${testEmail}.`, "success");
  }

  return (
    <>
      <PageHeader
        title="Templates de E-mail"
        subtitle="Conteúdo por IA · estrutura e marca configuráveis"
        actions={
          <Button variant="primary" onClick={() => router.push("/emails/novo")}>
            Novo template
            <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </Button>
        }
      />

      <div className="flex h-[calc(100dvh-4rem)] min-h-0">
        {/* ── Coluna esquerda: Estrutura & Branding ─────────────────────── */}
        <aside className="flex w-[300px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-hairline-soft p-5">
          <div>
            <Link
              href="/emails"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 transition-colors duration-[130ms] hover:text-ink"
            >
              <span aria-hidden>‹</span> Templates
            </Link>
            <Overline className="mt-3">Estrutura &amp; Branding</Overline>
          </div>

          <Input
            label="Nome do template"
            requiredMark
            placeholder="Ex.: Entrega de acesso"
            value={fields.name}
            onChange={(event) => {
              set("name", event.target.value);
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
          />

          <Select
            label="Categoria"
            value={fields.purpose}
            onChange={(event) => set("purpose", event.target.value as EmailPurposeDto)}
          >
            {PURPOSE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          {/* Cabeçalho */}
          <div className="flex flex-col gap-3 border-t border-hairline-soft pt-4">
            <SectionTitle>Cabeçalho</SectionTitle>
            <Input
              label="Título do cabeçalho"
              placeholder="Nome da marca"
              value={fields.headerTitle}
              onChange={(event) => set("headerTitle", event.target.value)}
            />
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleLogoUpload(file);
                event.target.value = "";
              }}
            />
            {fields.headerLogoUrl ? (
              <div className="flex items-center justify-between gap-2 rounded-[11px] border border-hairline bg-surface-2 px-3 py-2">
                <img src={fields.headerLogoUrl} alt="Logo do e-mail" className="h-8 max-w-28 object-contain" />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" loading={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                    Trocar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => set("headerLogoUrl", "")}>
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="rounded-[11px] border border-dashed border-hairline px-3 py-4 text-center text-[12.5px] text-ink-3 transition-colors duration-[130ms] hover:border-brand-3/40 hover:text-ink-2 disabled:opacity-50"
              >
                {uploadingLogo ? "Enviando…" : "Upload do logo"}
              </button>
            )}
            <ColorField
              label="Cor do header"
              value={fields.backgroundColor}
              onChange={(value) => set("backgroundColor", value)}
            />
          </div>

          {/* Corpo */}
          <div className="flex flex-col gap-3 border-t border-hairline-soft pt-4">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Corpo (conteúdo por IA)</SectionTitle>
              <Button size="sm" loading={generating} onClick={handleGenerate} aria-label="Gerar corpo com IA">
                <span aria-hidden>✦</span> Gerar com IA
              </Button>
            </div>
            {!data.hasAi && (
              <p className="rounded-[11px] border border-warm/25 bg-warm/[0.08] px-3 py-2 text-[11.5px] text-warm">
                Configure sua chave da Anthropic em Configurações para gerar o corpo com IA.
              </p>
            )}
            <Textarea
              ref={bodyRef}
              aria-label="Corpo do e-mail"
              rows={7}
              value={fields.bodyText}
              onChange={(event) => setFields((current) => ({ ...current, bodyText: event.target.value, bodySource: "MANUAL" }))}
              placeholder="Olá {nome}! Seu acesso ao {produto} está pronto…"
            />
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_CHIPS.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => insertVariable(variable)}
                  className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-ink-2 transition-colors duration-[130ms] hover:border-brand-3/40 hover:text-ink"
                >
                  {variable}
                </button>
              ))}
            </div>
          </div>

          {/* Botão / CTA */}
          <div className="flex flex-col gap-3 border-t border-hairline-soft pt-4">
            <SectionTitle>Botão / CTA</SectionTitle>
            <Input
              aria-label="Texto do botão"
              placeholder="Acessar o curso"
              value={fields.buttonLabel}
              onChange={(event) => set("buttonLabel", event.target.value)}
            />
            <Input
              aria-label="Link do botão"
              placeholder="{link_acesso}"
              value={fields.buttonUrl}
              onChange={(event) => set("buttonUrl", event.target.value)}
            />
          </div>

          {/* Rodapé */}
          <div className="flex flex-col gap-3 border-t border-hairline-soft pt-4">
            <SectionTitle>Rodapé</SectionTitle>
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Nome da empresa, endereço, redes sociais e{" "}
              <span className="font-medium text-danger">link de descadastro*</span> (obrigatório para
              não cair em spam).
            </p>
            <Input
              aria-label="Texto do rodapé"
              placeholder="Sua empresa · Cidade, UF"
              value={fields.footerText}
              onChange={(event) => set("footerText", event.target.value)}
            />
            <p className="text-[11px] text-ink-3">
              O link de descadastro é adicionado automaticamente em todo envio.
            </p>
          </div>

          {/* Estilo */}
          <div className="flex flex-col gap-3 border-t border-hairline-soft pt-4 pb-2">
            <SectionTitle>Estilo</SectionTitle>
            <div className="flex items-center justify-between">
              <ColorField
                label="Cor primária"
                value={fields.accentColor}
                onChange={(value) => set("accentColor", value)}
              />
              <p className="text-[12.5px] text-ink-3">
                Largura <span className="font-semibold text-ink">600px</span>
              </p>
            </div>
          </div>
        </aside>

        {/* ── Preview ───────────────────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline-soft px-5 py-3">
            <Segmented
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "mobile", label: "Mobile" },
              ]}
              value={previewMode}
              onChange={setPreviewMode}
              size="sm"
            />
            {data.designSystemIndexed ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
                <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 13 4 4L19 7" />
                </svg>
                Seguindo o Design System
              </span>
            ) : (
              <span className="text-[12px] text-ink-3">Sem Design System — cadastre no Contexto</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {status === "ACTIVE" && (
                <Badge tone="success" dot>
                  Ativo
                </Badge>
              )}
              <Button onClick={() => setTestOpen(true)}>Testar envio</Button>
              <Button loading={saving} onClick={handleSave}>
                Salvar
              </Button>
              {status !== "ACTIVE" && (
                <Button variant="primary" loading={activating} onClick={handleActivate}>
                  Ativar
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-black/25 p-6">
            <iframe
              srcDoc={previewHtml}
              title="Preview do e-mail"
              sandbox=""
              className={cn(
                "mx-auto block h-full min-h-[560px] rounded-xl border border-hairline bg-[#08080B] transition-all duration-200 ease-[var(--ease-out)]",
                previewMode === "mobile" ? "w-[375px]" : "w-full max-w-[860px]",
              )}
            />
          </div>
        </section>
      </div>

      {/* Modal de teste de envio */}
      <Modal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        title="Testar envio"
        subtitle="Enviamos o template com dados de exemplo para o e-mail informado."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTestOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={sendingTest} onClick={handleSendTest} disabled={!testEmail.trim()}>
              Enviar teste
            </Button>
          </>
        }
      >
        <Input
          label="E-mail de destino"
          requiredMark
          type="email"
          placeholder="voce@empresa.com"
          value={testEmail}
          onChange={(event) => setTestEmail(event.target.value)}
        />
      </Modal>
    </>
  );
}
