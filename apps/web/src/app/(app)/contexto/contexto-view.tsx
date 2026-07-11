"use client";

import { useRef, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  createContextFile,
  deleteContextFile,
  reindexContextFile,
  updateContextFileText,
  uploadDesignSystem,
} from "@/server/context/actions";
import {
  CONTEXT_CATEGORY_CARDS,
  CONTEXT_TYPE_OPTIONS,
  CONTEXT_TYPE_SHORT,
  DESIGN_SYSTEM_TEMPLATE,
  type ContextFileDto,
  type ContextPageData,
  type ContextStatusDto,
  type ContextTypeDto,
} from "@/server/context/types";

/** Tela Contexto — fiel ao protótipo (banner, card Design System, categorias, tabela). */

const STATUS_META: Record<ContextStatusDto, { label: string; className: string }> = {
  INDEXED: { label: "Indexado", className: "text-success" },
  PROCESSING: { label: "Processando", className: "text-warm" },
  PENDING: { label: "Pendente", className: "text-ink-3" },
  ERROR: { label: "Erro", className: "text-danger" },
};

function StatusDot({ status }: { status: ContextStatusDto }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${meta.className}`}>
      <span aria-hidden className="text-[9px] leading-none">●</span>
      {meta.label}
    </span>
  );
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
}

export function ContextoView({ data }: { data: ContextPageData }) {
  const { toast } = useToast();

  // Modal Adicionar contexto
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<ContextTypeDto>("TEXT");
  const [addLink, setAddLink] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Modal ver/editar texto
  const [editFile, setEditFile] = useState<ContextFileDto | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Modal excluir
  const [deleteTarget, setDeleteTarget] = useState<ContextFileDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ações por linha / card destaque
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [dsUploading, setDsUploading] = useState(false);
  const dsInputRef = useRef<HTMLInputElement>(null);

  const dsTemplate = data.designSystem?.rawText?.trim() || DESIGN_SYSTEM_TEMPLATE;

  function openAdd(type: ContextTypeDto) {
    setAddType(type);
    setAddLink("");
    setAddContent("");
    setAddFile(null);
    setAddError(null);
    setAddOpen(true);
  }

  async function handleAddSave() {
    if (!addContent.trim() && !addFile) {
      setAddError("Cole o texto do contexto ou anexe um arquivo.");
      return;
    }
    setAddError(null);
    setSaving(true);
    const form = new FormData();
    form.set("type", addType);
    form.set("link", addLink);
    form.set("content", addContent);
    if (addFile) form.set("file", addFile);
    const result = await createContextFile(form);
    setSaving(false);
    if (result.ok) {
      setAddOpen(false);
      toast("Contexto salvo — indexação iniciada.");
    } else {
      setAddError(result.error ?? "Não foi possível salvar.");
    }
  }

  async function handleDsUpload(file: File) {
    setDsUploading(true);
    const form = new FormData();
    form.set("file", file);
    const result = await uploadDesignSystem(form);
    setDsUploading(false);
    if (result.ok) toast("Design System enviado — indexação iniciada.");
    else toast(result.error ?? "Não foi possível enviar o .md.", "danger");
  }

  function downloadTemplate() {
    const anchor = document.createElement("a");
    anchor.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(DESIGN_SYSTEM_TEMPLATE)}`;
    anchor.download = "design-system-exemplo.md";
    anchor.click();
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(dsTemplate);
      toast("Template do Design System copiado.");
    } catch {
      toast("Não foi possível copiar — copie manualmente do bloco abaixo.", "danger");
    }
  }

  async function handleReindex(file: ContextFileDto) {
    setReindexingId(file.id);
    const result = await reindexContextFile(file.id);
    setReindexingId(null);
    if (result.ok) toast("Reindexação iniciada.");
    else toast(result.error ?? "Não foi possível reindexar.", "danger");
  }

  async function handleEditSave() {
    if (!editFile) return;
    setEditSaving(true);
    const result = await updateContextFileText({ id: editFile.id, rawText: editText });
    setEditSaving(false);
    if (result.ok) {
      setEditFile(null);
      toast("Texto salvo — reindexação iniciada.");
    } else {
      toast(result.error ?? "Não foi possível salvar a edição.", "danger");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteContextFile(deleteTarget.id);
    setDeleting(false);
    if (result.ok) {
      setDeleteTarget(null);
      toast("Arquivo de contexto excluído.");
    } else {
      toast(result.error ?? "Não foi possível excluir.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Arquivos de Contexto"
        subtitle="A base de conhecimento da sua IA"
        actions={
          <Button variant="primary" onClick={() => openAdd("TEXT")}>
            Adicionar contexto
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Button>
        }
      />

      <div className="flex flex-col gap-5 p-6">
        {/* Banner escudo */}
        <div className="flex items-center gap-3 rounded-2xl border border-brand-3/20 bg-brand-soft/40 px-4.5 py-3.5">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 5 6v5c0 4.4 3 8.4 7 9.7 4-1.3 7-5.3 7-9.7V6l-7-3Z" />
          </svg>
          <p className="text-[13px] text-ink-2">
            A IA nunca inventa preço, prazo ou promessa. Se faltar contexto, ela marca como pendente
            e te avisa.
          </p>
        </div>

        {/* Card destaque Design System (.md) */}
        <section className="rounded-2xl border border-brand-3/35 bg-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(139,92,246,.12),0_12px_40px_-18px_rgba(139,92,246,.35)]">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-accent">
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4c0-5-4-9-9-9Z" />
                <circle cx="7.5" cy="11.5" r=".8" fill="currentColor" />
                <circle cx="10.5" cy="7.5" r=".8" fill="currentColor" />
                <circle cx="15" cy="8" r=".8" fill="currentColor" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[16px] font-semibold text-ink">Design System (.md)</h2>
                <Badge tone="brand">lido pela IA</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-[13px] text-ink-3">
                A IA lê este arquivo sempre que gera templates de e-mail e outras saídas visuais —
                para seguir sua marca, cores, tipografia e tom.
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <input
                  ref={dsInputRef}
                  type="file"
                  accept=".md,text/markdown"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleDsUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="primary" size="sm" loading={dsUploading} onClick={() => dsInputRef.current?.click()}>
                  Enviar .md
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                  Baixar exemplo .md
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void copyTemplate()}>
                  Copiar template
                </Button>
              </div>

              {data.designSystem ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-success">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                  {data.designSystem.name} · {STATUS_META[data.designSystem.status].label.toLowerCase()}
                </p>
              ) : (
                <p className="mt-2.5 text-[12.5px] text-ink-3">
                  Nenhum arquivo enviado ainda — use o exemplo abaixo como ponto de partida.
                </p>
              )}
            </div>
          </div>

          <pre className="mt-4 overflow-x-auto whitespace-pre rounded-xl border border-hairline bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-accent/90">
            {dsTemplate}
          </pre>
        </section>

        {/* Cards de categoria */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {CONTEXT_CATEGORY_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => openAdd(card.type)}
              className="rounded-2xl border border-hairline bg-white/[0.03] px-5 py-4 text-left text-[13.5px] font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-[130ms] hover:border-brand-3/40"
            >
              {card.label}
            </button>
          ))}
        </div>

        {/* Tabela de arquivos */}
        {data.files.length === 0 ? (
          <EmptyState
            title="Nenhum arquivo de contexto ainda"
            hint="Adicione preços, objeções, FAQ e ICP — quanto mais contexto, melhor a IA vende sem inventar nada."
            action={
              <Button variant="primary" size="sm" onClick={() => openAdd("TEXT")}>
                Adicionar contexto
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>Arquivo</TH>
              <TH>Tipo</TH>
              <TH>Vínculo</TH>
              <TH>Status</TH>
              <TH className="w-0 text-right">
                <span className="sr-only">Ações</span>
              </TH>
            </THead>
            <TBody>
              {data.files.map((file) => (
                <TR key={file.id} className="group">
                  <TD className="font-medium text-ink">{file.name}</TD>
                  <TD>{CONTEXT_TYPE_SHORT[file.type]}</TD>
                  <TD>{file.linkLabel ?? "—"}</TD>
                  <TD>
                    <StatusDot status={file.status} />
                    {file.status === "ERROR" && file.error && (
                      <p className="mt-0.5 max-w-56 truncate text-[11px] text-danger/80">{file.error}</p>
                    )}
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity duration-[130ms] group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Ver e editar texto de ${file.name}`}
                        onClick={() => {
                          setEditFile(file);
                          setEditText(file.rawText ?? "");
                        }}
                        className="flex size-7.5 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink"
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3ZM14.5 6.5l3 3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Reindexar ${file.name}`}
                        disabled={reindexingId === file.id}
                        onClick={() => void handleReindex(file)}
                        className="flex size-7.5 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                      >
                        {reindexingId === file.id ? (
                          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" />
                            <path d="M20 4v4h-4M4 20v-4h4" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir ${file.name}`}
                        onClick={() => setDeleteTarget(file)}
                        className="flex size-7.5 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-danger/10 hover:text-danger"
                      >
                        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Modal Adicionar contexto */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar contexto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void handleAddSave()}>
              Salvar e indexar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              requiredMark
              value={addType}
              onChange={(e) => setAddType(e.target.value as ContextTypeDto)}
            >
              {CONTEXT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Vincular a"
              hint="opcional"
              value={addLink}
              onChange={(e) => setAddLink(e.target.value)}
            >
              <option value="">Sem vínculo</option>
              {data.linkOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Conteúdo"
            requiredMark
            placeholder="Cole o texto do contexto aqui, ou arraste um PDF…"
            className="min-h-28"
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
          />

          <input
            ref={addFileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAddFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => addFileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) setAddFile(file);
            }}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-hairline px-6 py-6 text-center transition-colors duration-[130ms] hover:border-brand-3/40"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />
            </svg>
            {addFile ? (
              <span className="text-[12.5px] font-medium text-ink">
                {addFile.name} · {formatKb(addFile.size)}
              </span>
            ) : (
              <span className="text-[12.5px] text-ink-3">ou arraste um PDF / arquivo de texto</span>
            )}
          </button>
          {addFile && (
            <div className="-mt-2 text-right">
              <button
                type="button"
                onClick={() => setAddFile(null)}
                className="text-[12px] font-medium text-danger hover:underline"
              >
                Remover arquivo
              </button>
            </div>
          )}
          <FieldError>{addError}</FieldError>
        </div>
      </Modal>

      {/* Modal ver/editar texto */}
      <Modal
        open={editFile !== null}
        onClose={() => setEditFile(null)}
        title={editFile?.name ?? ""}
        subtitle={editFile ? `${CONTEXT_TYPE_SHORT[editFile.type]} · edite o texto e reindexe` : undefined}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditFile(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={editSaving}
              disabled={!editText.trim()}
              onClick={() => void handleEditSave()}
            >
              Salvar e reindexar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editFile?.hasStorage && !editFile.rawText && (
            <p className="rounded-xl border border-hairline bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-ink-3">
              Arquivo binário (PDF) — o texto extraído fica disponível após a indexação. Você pode
              colar um texto aqui para indexar junto.
            </p>
          )}
          <Textarea
            label="Conteúdo"
            requiredMark
            className="min-h-56 font-mono text-[12.5px]"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Cole o texto do contexto aqui…"
          />
        </div>
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Excluir arquivo de contexto"
        subtitle="A IA deixa de usar este conteúdo imediatamente."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void handleDelete()}>
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-2">
          Excluir <strong className="text-ink">{deleteTarget?.name}</strong>? Os trechos indexados
          (chunks) também são apagados. Essa ação não tem volta.
        </p>
      </Modal>
    </>
  );
}
