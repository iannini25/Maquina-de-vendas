import { DEFAULT_CADENCE } from "@sales4u/core";
import type { TenantDb } from "@sales4u/db";

import { hasAiCredential } from "@/lib/ai";

import {
  DEFAULT_GUARDRAILS,
  DEFAULT_HANDOFF_KEYWORDS,
  type AgentModeDto,
  type CadenceChannelDto,
  type CadenceDto,
  type GuardrailsDto,
  type MsgLengthDto,
  type PersonaDto,
  type SdrPageData,
  type SdrStageDto,
  type SpeaksAsDto,
  type ToneDto,
} from "./types";

/**
 * Queries do módulo SDR de IA (somente server).
 * Persona/modos vêm das tabelas próprias; guardrails, handoff e cadência
 * default vivem em Workspace.settings.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// ── Persona ───────────────────────────────────────────────────────────────

function parseSpeaksAs(raw: string): SpeaksAsDto {
  if (raw === "mentor" || raw === "team" || raw === "owner") return raw;
  return "owner";
}

function parseTone(raw: string): ToneDto {
  if (raw === "formal" || raw === "informal" || raw === "balanced") return raw;
  return "balanced";
}

function parseMsgLength(raw: string): MsgLengthDto {
  return raw === "medium" ? "medium" : "short";
}

export function isAlwaysOn(activeHours: unknown): boolean {
  const hours = asRecord(activeHours);
  const days = Array.isArray(hours["days"]) ? (hours["days"] as unknown[]) : [];
  return (
    days.length === 7 &&
    asString(hours["start"]) === "00:00" &&
    asString(hours["end"]) === "23:59"
  );
}

const DEFAULT_PERSONA: PersonaDto = {
  name: "Nina",
  speaksAs: "owner",
  tone: "balanced",
  msgLength: "short",
  emojis: false,
  always: true,
  windowStart: "08:00",
  windowEnd: "21:00",
};

function toPersonaDto(persona: {
  name: string;
  speaksAs: string;
  tone: string;
  msgLength: string;
  emojis: boolean;
  activeHours: unknown;
} | null): PersonaDto {
  if (!persona) return DEFAULT_PERSONA;
  const hours = asRecord(persona.activeHours);
  const always = isAlwaysOn(persona.activeHours);
  return {
    name: persona.name,
    speaksAs: parseSpeaksAs(persona.speaksAs),
    tone: parseTone(persona.tone),
    msgLength: parseMsgLength(persona.msgLength),
    emojis: persona.emojis,
    always,
    windowStart: always ? "08:00" : asString(hours["start"], "08:00"),
    windowEnd: always ? "21:00" : asString(hours["end"], "21:00"),
  };
}

// ── Modos ─────────────────────────────────────────────────────────────────

function toModeDto(
  slot: number,
  mode:
    | {
        slot: number;
        name: string;
        source: "PLATFORM" | "MARKDOWN";
        configJson: unknown;
        markdownKey: string | null;
        isActive: boolean;
      }
    | undefined,
): AgentModeDto {
  if (!mode) {
    return {
      slot,
      configured: false,
      name: "",
      source: "PLATFORM",
      sentiment: "",
      guidance: "",
      isActive: false,
      markdownName: null,
      markdownSize: null,
    };
  }
  const config = asRecord(mode.configJson);
  const markdownSize = config["markdownSize"];
  return {
    slot,
    configured: true,
    name: mode.name,
    source: mode.source,
    // Compat com o seed antigo ({ style, description })
    sentiment: asString(config["sentiment"], asString(config["style"])),
    guidance: asString(config["guidance"], asString(config["description"])),
    isActive: mode.isActive,
    markdownName: mode.markdownKey ? asString(config["markdownName"], "modo.md") : null,
    markdownSize:
      mode.markdownKey && typeof markdownSize === "number" ? markdownSize : null,
  };
}

// ── Guardrails / cadência (Workspace.settings) ────────────────────────────

export function parseGuardrails(settings: unknown): GuardrailsDto {
  const raw = asRecord(asRecord(settings)["guardrails"]);
  const result = { ...DEFAULT_GUARDRAILS };
  for (const key of Object.keys(result) as Array<keyof GuardrailsDto>) {
    if (typeof raw[key] === "boolean") result[key] = raw[key] as boolean;
  }
  return result;
}

export function parseHandoffKeywords(settings: unknown): string[] {
  const raw = asRecord(settings)["handoffKeywords"];
  if (!Array.isArray(raw)) return [...DEFAULT_HANDOFF_KEYWORDS];
  return raw.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
}

function parseChannel(value: unknown): CadenceChannelDto {
  return value === "email" ? "email" : "whatsapp";
}

/** Canais default do protótipo para a cadência padrão (T+3d por e-mail). */
function defaultChannelsFor(intervals: number[]): CadenceChannelDto[] {
  const isDefault = intervals.join(",") === DEFAULT_CADENCE.intervals.join(",");
  return intervals.map((_, i) => (isDefault && i === 4 ? "email" : "whatsapp"));
}

export function parseCadence(settings: unknown, fallbackIntervals: number[] | null): CadenceDto {
  const root = asRecord(settings);
  const stored = asRecord(root["defaultCadence"]);
  const templates = Array.isArray(root["cadenceTemplates"])
    ? (root["cadenceTemplates"] as unknown[])
    : [];

  const storedIntervals = Array.isArray(stored["intervals"])
    ? (stored["intervals"] as unknown[]).filter((n): n is number => typeof n === "number")
    : null;

  const intervals =
    storedIntervals && storedIntervals.length > 0
      ? storedIntervals
      : (fallbackIntervals ?? DEFAULT_CADENCE.intervals);

  const storedChannels = Array.isArray(stored["channels"])
    ? (stored["channels"] as unknown[])
    : null;
  const channels = storedChannels
    ? intervals.map((_, i) => parseChannel(storedChannels[i]))
    : defaultChannelsFor(intervals);

  const maxTouches =
    typeof stored["maxTouches"] === "number" && stored["maxTouches"] > 0
      ? (stored["maxTouches"] as number)
      : intervals.length;

  return {
    touches: intervals.map((minutes, i) => ({
      minutes,
      channel: channels[i] ?? "whatsapp",
      text: typeof templates[i] === "string" ? (templates[i] as string) : "",
    })),
    maxTouches,
  };
}

/** Cadência do playbook do estágio "Em conversa" (fallback da aba Cadências). */
function playbookIntervals(cadence: unknown): number[] | null {
  const raw = asRecord(cadence)["intervals"];
  if (!Array.isArray(raw)) return null;
  const intervals = raw.filter((n): n is number => typeof n === "number");
  return intervals.length > 0 ? intervals : null;
}

// ── Página ────────────────────────────────────────────────────────────────

export async function getSdrPageData(
  db: TenantDb,
  workspaceId: string,
): Promise<SdrPageData> {
  const [persona, modes, stages, workspace, product, canUseAi] = await Promise.all([
    db.agentPersona.findFirst({ orderBy: { createdAt: "asc" } }),
    db.agentMode.findMany({ orderBy: { slot: "asc" } }),
    db.pipelineStage.findMany({
      orderBy: { order: "asc" },
      include: { playbook: { select: { objective: true, cadence: true } } },
    }),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } }),
    db.productOffer.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true, priceCents: true },
    }),
    hasAiCredential(workspaceId),
  ]);

  const stageDtos: SdrStageDto[] = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    objective: stage.playbook?.objective ?? "sem playbook configurado",
  }));

  const emConversa = stages.find((s) => s.name.toLowerCase() === "em conversa");
  const fallbackIntervals = emConversa?.playbook
    ? playbookIntervals(emConversa.playbook.cadence)
    : null;

  const settings = workspace?.settings ?? {};

  return {
    persona: toPersonaDto(persona),
    modes: [1, 2, 3].map((slot) =>
      toModeDto(slot, modes.find((m) => m.slot === slot)),
    ),
    stages: stageDtos,
    guardrails: parseGuardrails(settings),
    handoffKeywords: parseHandoffKeywords(settings),
    cadence: parseCadence(settings, fallbackIntervals),
    productName: product?.name ?? null,
    productPriceCents: product?.priceCents ?? null,
    canUseAi,
  };
}
