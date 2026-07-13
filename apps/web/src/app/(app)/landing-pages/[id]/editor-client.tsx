"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import {
  autoPickWinnerAction,
  createVariantAction,
  renameLandingAction,
  setLandingPublishedAction,
  updateLandingExternalUrlAction,
  updateVariantAction,
} from "@/server/landing/actions";
import {
  BLOCK_KIND_LABELS,
  emptyBlock,
  type LandingBlock,
  type LandingBlockKind,
} from "@/server/landing/blocks";
import type { LandingDetail, LandingVariantDetail } from "@/server/landing/queries";

import { LandingBlocksView } from "@/app/p/landing-render";

import { BlockFields } from "./block-editors";

/** Editor de landing page: variantes A/B, blocos e preview por dispositivo. */

const KIND_LABELS: Record<LandingDetail["kind"], string> = {
  BUILDER: "Por blocos",
  EXTERNAL_URL: "Link externo",
  UPLOADED: "Arquivo enviado",
};

const DEVICE_OPTIONS = [
  { value: "ANY", label: "Qualquer" },
  { value: "MOBILE", label: "Mobile" },
  { value: "TABLET", label: "Tablet" },
  { value: "DESKTOP", label: "Desktop" },
] as const;

const BLOCK_KINDS: LandingBlockKind[] = [
  "hero",
  "pain",
  "method",
  "proof",
  "offer",
  "faq",
  "cta-whatsapp",
  "signup-form",
];

function convLabel(views: number, conversions: number): string {
  if (views === 0) return "conv. —";
  const rate = (conversions / views) * 100;
  return `conv. ${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function LandingEditorClient({
  landing,
  landingBaseUrl,
}: {
  landing: LandingDetail;
  landingBaseUrl: string;
}) {
  const { toast } = useToast();

  const [name, setName] = useState(landing.name);
  const [variants, setVariants] = useState<LandingVariantDetail[]>(landing.variants);
  const [selectedId, setSelectedId] = useState<string | null>(landing.variants[0]?.id ?? null);
  const [draftBlocks, setDraftBlocks] = useState<LandingBlock[]>(landing.variants[0]?.blocks ?? []);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [pickingWinner, setPickingWinner] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [externalUrl, setExternalUrl] = useState(landing.externalUrl ?? "");
  const [savingUrl, setSavingUrl] = useState(false);

  // Sincroniza a lista de variantes quando o server revalida após uma action.
  useEffect(() => {
    setVariants(landing.variants);
  }, [landing.variants]);

  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0] ?? null;
  const isPublished = landing.status === "PUBLISHED";
  const publicUrl = `${landingBaseUrl}/p/${landing.slug}`;

  const selectVariant = (variant: LandingVariantDetail) => {
    setSelectedId(variant.id);
    setDraftBlocks(variant.blocks);
  };

  const commitName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === landing.name) {
      setName(landing.name);
      return;
    }
    const result = await renameLandingAction(landing.id, trimmed);
    if (result.ok) toast("Nome atualizado.");
    else toast(result.error ?? "Não foi possível renomear.", "danger");
  };

  const togglePublish = async () => {
    setPublishing(true);
    const result = await setLandingPublishedAction(landing.id, !isPublished);
    setPublishing(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível alterar o status.", "danger");
      return;
    }
    toast(isPublished ? "Página despublicada." : "Página publicada.");
  };

  const saveBlocks = async () => {
    if (!selected) return;
    setSaving(true);
    const result = await updateVariantAction({ variantId: selected.id, blocks: draftBlocks });
    setSaving(false);
    if (result.ok) toast("Variante salva.");
    else toast(result.error ?? "Não foi possível salvar.", "danger");
  };

  const updateVariantMeta = async (
    variantId: string,
    patch: Partial<Pick<LandingVariantDetail, "deviceTarget" | "weight" | "name">>,
  ) => {
    setVariants((current) =>
      current.map((variant) => (variant.id === variantId ? { ...variant, ...patch } : variant)),
    );
    const result = await updateVariantAction({ variantId, ...patch });
    if (!result.ok) toast(result.error ?? "Não foi possível atualizar a variante.", "danger");
  };

  const newVariant = async () => {
    setCreatingVariant(true);
    const result = await createVariantAction(landing.id, selected?.id ?? null);
    setCreatingVariant(false);
    if (!result.ok || !result.variantId) {
      toast(result.error ?? "Não foi possível criar a variante.", "danger");
      return;
    }
    setSelectedId(result.variantId);
    setDraftBlocks(selected?.blocks ?? []);
    toast("Variante criada — blocos duplicados.");
  };

  const pickWinnerNow = async () => {
    setPickingWinner(true);
    const result = await autoPickWinnerAction(landing.id);
    setPickingWinner(false);
    if (!result.ok) {
      toast(result.error ?? "Não foi possível escolher a vencedora.", "danger");
      return;
    }
    if (!result.winnerId) {
      toast("Amostra insuficiente ou empate técnico.");
      return;
    }
    const winner = variants.find((variant) => variant.id === result.winnerId);
    toast(`Variante ${winner?.name ?? ""} definida como vencedora.`.replace("  ", " "), "success");
  };

  const saveExternalUrl = async () => {
    setSavingUrl(true);
    const result = await updateLandingExternalUrlAction(landing.id, externalUrl);
    setSavingUrl(false);
    if (result.ok) toast("URL atualizada.");
    else toast(result.error ?? "URL inválida.", "danger");
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <input
              aria-label="Nome da landing page"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-52 rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 font-display text-[17px] font-semibold tracking-tight text-ink transition-colors duration-[130ms] hover:border-hairline focus:border-brand-3 focus:outline-none"
            />
            <Badge tone={isPublished ? "success" : "muted"} dot>
              {isPublished ? "Publicada" : "Rascunho"}
            </Badge>
          </span>
        }
        subtitle={`${KIND_LABELS[landing.kind]} · ${publicUrl.replace(/^https?:\/\//, "")}`}
        actions={
          <>
            {isPublished ? (
              <Button variant="secondary" onClick={() => window.open(publicUrl, "_blank")}>
                Ver página
              </Button>
            ) : (
              <Button variant="secondary" disabled title="Publique para abrir a página">
                Ver página
              </Button>
            )}
            <Button
              variant={isPublished ? "secondary" : "primary"}
              loading={publishing}
              onClick={() => void togglePublish()}
            >
              {isPublished ? "Despublicar" : "Publicar"}
            </Button>
          </>
        }
      />

      <div
        className={cn(
          "grid flex-1 grid-cols-1 gap-4 p-6",
          landing.kind === "BUILDER"
            ? "xl:grid-cols-[270px_minmax(0,1fr)_minmax(0,400px)]"
            : "xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]",
        )}
      >
        {landing.kind === "BUILDER" && (
          <VariantsPanel
            variants={variants}
            selectedId={selected?.id ?? null}
            creating={creatingVariant}
            picking={pickingWinner}
            onSelect={selectVariant}
            onMetaChange={updateVariantMeta}
            onNewVariant={() => void newVariant()}
            onPickWinner={() => void pickWinnerNow()}
          />
        )}

        {landing.kind === "BUILDER" ? (
          selected ? (
            <BlocksPanel
              key={selected.id}
              variantName={selected.name}
              blocks={draftBlocks}
              onChange={setDraftBlocks}
              onSave={() => void saveBlocks()}
              saving={saving}
            />
          ) : (
            <EmptyState
              title="Nenhuma variante ainda"
              hint="Crie a variante A para começar a montar a página por blocos."
              action={
                <Button variant="primary" loading={creatingVariant} onClick={() => void newVariant()}>
                  Nova variante
                </Button>
              }
            />
          )
        ) : (
          <Card className="h-fit space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                {landing.kind === "EXTERNAL_URL" ? "Página externa" : "Arquivo enviado"}
              </h3>
              <p className="mt-1 text-[12.5px] text-ink-3">
                {landing.kind === "EXTERNAL_URL"
                  ? "O sistema emula a página dentro do Sales4U e repassa o visitante para a URL abaixo."
                  : "O HTML enviado é servido do storage. Para trocar o arquivo, crie uma nova landing page."}
              </p>
            </div>
            {landing.kind === "EXTERNAL_URL" && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="URL externa"
                    requiredMark
                    type="url"
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                  />
                </div>
                <Button variant="secondary" loading={savingUrl} onClick={() => void saveExternalUrl()}>
                  Salvar
                </Button>
              </div>
            )}
            {landing.kind === "UPLOADED" && landing.storageKey?.endsWith(".zip") && (
              <p className="rounded-[11px] border border-warm/25 bg-warm/[.08] px-3.5 py-2.5 text-[12px] text-warm">
                Arquivo .zip armazenado — a extração automática ainda não está disponível.
                Reenvie como .html único para pré-visualizar e publicar.
              </p>
            )}
          </Card>
        )}

        <PreviewPanel
          landing={landing}
          device={previewDevice}
          onDeviceChange={setPreviewDevice}
          externalUrl={externalUrl}
          blocks={draftBlocks}
        />
      </div>
    </div>
  );
}

function VariantsPanel({
  variants,
  selectedId,
  creating,
  picking,
  onSelect,
  onMetaChange,
  onNewVariant,
  onPickWinner,
}: {
  variants: LandingVariantDetail[];
  selectedId: string | null;
  creating: boolean;
  picking: boolean;
  onSelect: (variant: LandingVariantDetail) => void;
  onMetaChange: (
    variantId: string,
    patch: Partial<Pick<LandingVariantDetail, "deviceTarget" | "weight" | "name">>,
  ) => Promise<void>;
  onNewVariant: () => void;
  onPickWinner: () => void;
}) {
  return (
    <aside className="h-fit space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
        Variantes
      </p>
      {variants.map((variant) => {
        const active = variant.id === selectedId;
        return (
          <div
            key={variant.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(variant)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(variant);
            }}
            className={cn(
              "cursor-pointer space-y-2.5 rounded-2xl border p-3.5 transition-colors duration-[130ms]",
              active
                ? "border-brand-3/40 bg-brand-soft"
                : "border-hairline bg-white/[0.03] hover:border-brand-3/25",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">Variante {variant.name}</span>
              {variant.isWinner && (
                <Badge tone="success" dot>
                  Vencedora
                </Badge>
              )}
            </div>
            <p className="tnum text-[11.5px] text-ink-3">
              {variant.views.toLocaleString("pt-BR")} views · {convLabel(variant.views, variant.conversions)}
            </p>
            <div
              className="grid grid-cols-[1fr_72px] gap-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Select
                aria-label={`Dispositivo da variante ${variant.name}`}
                value={variant.deviceTarget}
                className="py-1.5 text-[12px]"
                onChange={(event) =>
                  void onMetaChange(variant.id, {
                    deviceTarget: event.target.value as LandingVariantDetail["deviceTarget"],
                  })
                }
              >
                {DEVICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`Peso da variante ${variant.name}`}
                type="number"
                min={0}
                max={100}
                className="py-1.5 text-[12px]"
                value={variant.weight}
                onChange={(event) => {
                  const weight = Math.max(0, Math.min(100, Number(event.target.value) || 0));
                  void onMetaChange(variant.id, { weight });
                }}
              />
            </div>
          </div>
        );
      })}

      <Button variant="secondary" size="sm" className="w-full" loading={creating} onClick={onNewVariant}>
        + Nova variante
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        loading={picking}
        onClick={onPickWinner}
        disabled={variants.length < 2}
        title={variants.length < 2 ? "Crie ao menos 2 variantes" : undefined}
      >
        Escolher vencedora automaticamente
      </Button>
    </aside>
  );
}

function BlocksPanel({
  variantName,
  blocks,
  onChange,
  onSave,
  saving,
}: {
  variantName: string;
  blocks: LandingBlock[];
  onChange: (blocks: LandingBlock[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [newKind, setNewKind] = useState<LandingBlockKind>("hero");

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
          Blocos — Variante {variantName}
        </p>
        <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
          Salvar variante
        </Button>
      </div>

      {blocks.length === 0 && (
        <EmptyState
          title="Página sem blocos"
          hint="Adicione o primeiro bloco abaixo — hero e oferta são um bom começo."
        />
      )}

      {blocks.map((block, index) => (
        <Card key={`${block.kind}-${index}`} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {BLOCK_KIND_LABELS[block.kind]}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mover bloco para cima"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="flex size-7 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Mover bloco para baixo"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
                className="flex size-7 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Remover bloco"
                onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                className="flex size-7 items-center justify-center rounded-lg text-ink-3 transition-colors duration-[130ms] hover:bg-danger/10 hover:text-danger"
              >
                ✕
              </button>
            </div>
          </div>
          <BlockFields
            block={block}
            onChange={(updated) => onChange(blocks.map((current, i) => (i === index ? updated : current)))}
          />
        </Card>
      ))}

      <div className="flex items-end gap-2 rounded-2xl border border-dashed border-hairline p-3.5">
        <div className="flex-1">
          <Select
            label="Adicionar bloco"
            value={newKind}
            onChange={(event) => setNewKind(event.target.value as LandingBlockKind)}
          >
            {BLOCK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {BLOCK_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" onClick={() => onChange([...blocks, emptyBlock(newKind)])}>
          Adicionar
        </Button>
      </div>
    </section>
  );
}

function PreviewPanel({
  landing,
  device,
  onDeviceChange,
  externalUrl,
  blocks,
}: {
  landing: LandingDetail;
  device: "desktop" | "mobile";
  onDeviceChange: (device: "desktop" | "mobile") => void;
  externalUrl: string;
  blocks: LandingBlock[];
}) {
  const width = device === "mobile" ? 375 : "100%";

  return (
    <aside className="flex h-fit flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Preview</p>
        <Segmented<"desktop" | "mobile">
          size="sm"
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: "Mobile" },
          ]}
          value={device}
          onChange={onDeviceChange}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-bg">
        {landing.kind === "BUILDER" && (
          <div className="max-h-[68vh] overflow-y-auto">
            <div className="mx-auto" style={{ width, maxWidth: "100%" }}>
              <LandingBlocksView blocks={blocks} ctx={null} />
            </div>
          </div>
        )}

        {landing.kind === "EXTERNAL_URL" &&
          (externalUrl ? (
            <div className="mx-auto" style={{ width, maxWidth: "100%" }}>
              <iframe
                src={externalUrl}
                title="Preview da página externa"
                className="h-[68vh] w-full border-0 bg-white"
              />
            </div>
          ) : (
            <EmptyState
              className="m-4"
              title="Sem URL para pré-visualizar"
              hint="Informe a URL externa ao lado para emular a página aqui."
            />
          ))}

        {landing.kind === "UPLOADED" && (
          <div className="mx-auto" style={{ width, maxWidth: "100%" }}>
            <iframe
              src={`/landing-pages/${landing.id}/preview`}
              title="Preview do arquivo enviado"
              className="h-[68vh] w-full border-0 bg-white"
            />
          </div>
        )}
      </div>

      {landing.kind === "EXTERNAL_URL" && (
        <p className="text-[11px] text-ink-3">
          Se a página não aparecer, o site de origem bloqueia exibição em iframe.
        </p>
      )}
    </aside>
  );
}
