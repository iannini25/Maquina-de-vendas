"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { addStudioTemplate } from "@/server/studio/actions";

type Mode = "upload" | "link";

/** Modal "+ Adicionar template": upload de arquivo ou link → Template LANDING. */
export function AddTemplateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("upload");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setMode("upload");
    setUrl("");
    setError(null);
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("mode", mode);
    if (mode === "link") formData.set("url", url);
    else if (fileRef.current?.files?.[0]) formData.set("file", fileRef.current.files[0]);

    const result = await addStudioTemplate(formData);
    setSaving(false);
    if (result.ok) {
      toast("Template adicionado à biblioteca.", "success");
      onClose();
    } else {
      setError(result.error ?? "Não foi possível adicionar o template.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar template"
      subtitle="Adicione um template por upload ou link."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Adicionar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Nome do template"
          requiredMark
          placeholder="VSL Centralizada"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Origem</p>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "upload", label: "Upload" },
              { value: "link", label: "Link" },
            ]}
          />
        </div>

        {mode === "upload" ? (
          <div>
            <label htmlFor="template-file" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Arquivo (.html, .zip ou imagem)
            </label>
            <input
              ref={fileRef}
              id="template-file"
              type="file"
              accept=".html,.htm,.zip,.png,.jpg,.jpeg,.webp"
              className="w-full rounded-[11px] border border-dashed border-hairline bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-3 file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-[12px] file:font-semibold file:text-accent"
            />
          </div>
        ) : (
          <Input
            label="Link do template"
            placeholder="https://exemplo.com/template"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        )}

        {error && <ErrorState message={error} />}
      </div>
    </Modal>
  );
}
