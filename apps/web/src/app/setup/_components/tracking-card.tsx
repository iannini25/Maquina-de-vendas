"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveCredentialAction } from "@/server/credentials/actions";

import { CardShell, type CardVisualState } from "./card-shell";
import type { CardMode, CardStateChange } from "./credential-card";
import { findView, TRACKING_PROVIDERS, type CredentialViewDTO } from "./types";
import { groupVisualState } from "./use-credential-states";

/**
 * Card Rastreamento / Pixels — agrupa Meta Pixel e Google Tag num card só,
 * como no protótipo. Verifica cada provedor preenchido.
 */
export function TrackingCard({
  views,
  mode,
  states,
  errors,
  onStateChange,
}: {
  views: CredentialViewDTO[];
  mode: CardMode;
  states: Record<string, CardVisualState>;
  errors: Record<string, string | null>;
  onStateChange: CardStateChange;
}) {
  const { toast } = useToast();
  const pixelView = findView(views, "META_PIXEL");
  const tagView = findView(views, "GOOGLE_TAG");
  const [pixelId, setPixelId] = useState(pixelView.values.pixelId ?? "");
  const [tagId, setTagId] = useState(tagView.values.tagId ?? "");
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const groupState = pending
    ? "verifying"
    : groupVisualState(TRACKING_PROVIDERS.map((p) => states[p] ?? "pending"));
  const firstError =
    TRACKING_PROVIDERS.map((p) => errors[p]).find(Boolean) ??
    pixelView.lastError ??
    tagView.lastError;

  async function verify() {
    if (!pixelId.trim() && !tagId.trim()) {
      toast("Preencha ao menos um dos campos.", "danger");
      return;
    }
    setPending(true);
    let allOk = true;
    if (pixelId.trim()) {
      onStateChange("META_PIXEL", "verifying", null);
      const result = await saveCredentialAction("META_PIXEL", { pixelId: pixelId.trim() });
      onStateChange("META_PIXEL", result.ok ? "ok" : "error", result.error ?? null);
      allOk = allOk && result.ok;
      if (!result.ok) toast(result.error ?? "Pixel ID inválido.", "danger");
    }
    if (tagId.trim()) {
      onStateChange("GOOGLE_TAG", "verifying", null);
      const result = await saveCredentialAction("GOOGLE_TAG", { tagId: tagId.trim() });
      onStateChange("GOOGLE_TAG", result.ok ? "ok" : "error", result.error ?? null);
      allOk = allOk && result.ok;
      if (!result.ok) toast(result.error ?? "Tag ID inválido.", "danger");
    }
    if (allOk) toast("Rastreamento configurado.", "success");
    setPending(false);
  }

  return (
    <CardShell
      icon="pixel"
      title="Rastreamento / Pixels"
      required={false}
      description="Libera rastreio de conversão nas landing pages."
      state={groupState}
      error={groupState === "error" ? firstError : null}
      footerLeft={
        <>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={verify}
            className="border-brand-3/40 text-ink"
          >
            {mode === "settings" ? "Verificar / Testar" : "Verificar"}
          </Button>
          {mode === "setup" && (
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? "Configurar agora" : "Configurar depois"}
            </Button>
          )}
        </>
      }
    >
      {!collapsed ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Meta Pixel ID"
            placeholder="ex.: 123456789012345"
            value={pixelId}
            spellCheck={false}
            onChange={(event) => setPixelId(event.target.value)}
          />
          <Input
            label="Google tag / Analytics"
            placeholder="G-… ou AW-…"
            value={tagId}
            spellCheck={false}
            onChange={(event) => setTagId(event.target.value)}
          />
        </div>
      ) : null}
    </CardShell>
  );
}
