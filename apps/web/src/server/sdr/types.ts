import { formatBRL } from "@vendaflow/core";

/**
 * Tipos, constantes e helpers puros do módulo SDR de IA.
 * Client components importam apenas daqui (nada de server-only).
 */

// ── Persona ───────────────────────────────────────────────────────────────

export type SpeaksAsDto = "owner" | "mentor" | "team";
export type ToneDto = "formal" | "balanced" | "informal";
export type MsgLengthDto = "short" | "medium";

export const SPEAKS_AS_OPTIONS: Array<{ value: SpeaksAsDto; label: string }> = [
  { value: "owner", label: "Você (o dono)" },
  { value: "mentor", label: "O Mentor" },
  { value: "team", label: "A Equipe" },
];

export const TONE_OPTIONS: Array<{ value: ToneDto; label: string }> = [
  { value: "formal", label: "Formal" },
  { value: "balanced", label: "Equilibrado" },
  { value: "informal", label: "Informal" },
];

export const MSG_LENGTH_OPTIONS: Array<{ value: MsgLengthDto; label: string }> = [
  { value: "short", label: "Curtas" },
  { value: "medium", label: "Médias" },
];

export interface PersonaDto {
  name: string;
  speaksAs: SpeaksAsDto;
  tone: ToneDto;
  msgLength: MsgLengthDto;
  emojis: boolean;
  /** Ativa 24/7 (true) ou limitada à janela de horário abaixo. */
  always: boolean;
  windowStart: string;
  windowEnd: string;
}

export interface PersonaPreviewInput {
  assistantName: string;
  tone: ToneDto;
  msgLength: MsgLengthDto;
  emojis: boolean;
  productName: string | null;
  priceCents: number | null;
}

/** "R$ 1.997,00" → "R$ 1.997" quando os centavos são zero (padrão do protótipo). */
function priceLabel(cents: number): string {
  return formatBRL(cents).replace(/,00$/, "");
}

/**
 * Prévia determinística da mensagem (painel PRÉVIA DA MENSAGEM),
 * interpolando produto e preço reais nas configurações atuais.
 */
export function buildPersonaPreview(input: PersonaPreviewInput): string {
  const greeting =
    input.tone === "formal" ? "Olá!" : input.tone === "informal" ? "Oii!" : "Oi!";

  if (!input.productName || input.priceCents == null) {
    return `${greeting} Ainda não tenho um produto cadastrado para te passar o preço — cadastre sua oferta e eu respondo na hora.`;
  }

  // "Curso IA na Liderança" → 'O curso "IA na Liderança"' (evita "curso Curso…")
  const displayName = input.productName.replace(/^curso\s+/i, "");
  const base = `${greeting} O curso "${displayName}" é ${priceLabel(input.priceCents)}, em até 12x.`;
  const question =
    input.msgLength === "medium"
      ? " Quer que eu te mostre o que está incluso antes? Posso te explicar também a garantia e os bônus."
      : " Quer que eu te mostre o que está incluso antes?";
  const emoji = input.emojis ? " 😊" : "";
  return `${base}${question}${emoji}`;
}

// ── Modos do agente ───────────────────────────────────────────────────────

export type ModeSourceDto = "PLATFORM" | "MARKDOWN";

export interface AgentModeDto {
  slot: number;
  /** Existe registro no banco para este slot. */
  configured: boolean;
  name: string;
  source: ModeSourceDto;
  sentiment: string;
  guidance: string;
  isActive: boolean;
  markdownName: string | null;
  markdownSize: number | null;
}

export const MAX_MODE_MARKDOWN_FILES = 3;

/** Template do arquivo markdown de modo/persona (card "Como montar o arquivo markdown"). */
export const PERSONA_MODE_TEMPLATE = `# Persona do agente
## Persona
Você é {nome}, do time de {empresa}. Fala como {tom}.
## Tom
Seja {empático/direto}. Mensagens curtas.
## Como conduzir
- Faça 1 pergunta por vez. Use o nome da pessoa.
- Venda {produto} com clareza, sem inventar nada.
## O que NUNCA fazer
- Nunca prometer preço/prazo fora do contexto.
## Objeções e respostas
- "Tá caro" → {resposta}
`;

// ── Playbooks por estágio ─────────────────────────────────────────────────

export interface SdrStageDto {
  id: string;
  name: string;
  color: string;
  objective: string;
}

// ── Guardrails ────────────────────────────────────────────────────────────

export type GuardrailKey =
  | "neverInvent"
  | "productOnly"
  | "noCompetitors"
  | "respectOptOut"
  | "respectTouchCap"
  | "escalateSensitive";

export type GuardrailsDto = Record<GuardrailKey, boolean>;

/** Copy exata do protótipo — todos default on. */
export const GUARDRAIL_ITEMS: Array<{ key: GuardrailKey; label: string }> = [
  { key: "neverInvent", label: "Nunca inventar preço, prazo ou promessa" },
  { key: "productOnly", label: "Só falar do produto e da oferta" },
  { key: "noCompetitors", label: "Não comparar com concorrente" },
  { key: "respectOptOut", label: "Não insistir com quem pediu pra parar" },
  { key: "respectTouchCap", label: "Respeitar teto de toques e janela de 24h" },
  { key: "escalateSensitive", label: "Escalar reembolso, cancelamento ou jurídico" },
];

export const DEFAULT_GUARDRAILS: GuardrailsDto = {
  neverInvent: true,
  productOnly: true,
  noCompetitors: true,
  respectOptOut: true,
  respectTouchCap: true,
  escalateSensitive: true,
};

export const DEFAULT_HANDOFF_KEYWORDS = ["cancelar", "reembolso", "advogado"];

// ── Cadências ─────────────────────────────────────────────────────────────

export type CadenceChannelDto = "whatsapp" | "email";

export const CADENCE_CHANNEL_OPTIONS: Array<{ value: CadenceChannelDto; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
];

export type CadenceUnit = "min" | "h" | "d";

export interface CadenceTouchDto {
  /** Minutos após o toque anterior/entrada no estágio. */
  minutes: number;
  channel: CadenceChannelDto;
  /** Texto do toque (gerado com IA ou manual); persiste em settings.cadenceTemplates. */
  text: string;
}

export interface CadenceDto {
  touches: CadenceTouchDto[];
  maxTouches: number;
}

export const MAX_CADENCE_TOUCHES = 12;

/** 4320 → { value: 3, unit: "d" } (maior unidade exata). */
export function minutesToUnit(minutes: number): { value: number; unit: CadenceUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "d" };
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: "h" };
  return { value: minutes, unit: "min" };
}

export function unitToMinutes(value: number, unit: CadenceUnit): number {
  if (unit === "d") return value * 1440;
  if (unit === "h") return value * 60;
  return value;
}

/** Tag da timeline: 0 → "T+0" · 20 → "T+20min" · 180 → "T+3h" · 4320 → "T+3d". */
export function touchTag(minutes: number): string {
  if (minutes <= 0) return "T+0";
  const { value, unit } = minutesToUnit(minutes);
  return `T+${value}${unit}`;
}

/** Rótulo da timeline: "após imediato" · "após 20 minutos" · "após 3 horas" · "após 1 dia". */
export function touchDelayLabel(minutes: number): string {
  if (minutes <= 0) return "após imediato";
  const { value, unit } = minutesToUnit(minutes);
  if (unit === "d") return `após ${value} ${value === 1 ? "dia" : "dias"}`;
  if (unit === "h") return `após ${value} ${value === 1 ? "hora" : "horas"}`;
  return `após ${value} ${value === 1 ? "minuto" : "minutos"}`;
}

// ── Página / resultados de actions ────────────────────────────────────────

export interface SdrPageData {
  persona: PersonaDto;
  modes: AgentModeDto[];
  stages: SdrStageDto[];
  guardrails: GuardrailsDto;
  handoffKeywords: string[];
  cadence: CadenceDto;
  productName: string | null;
  productPriceCents: number | null;
  /** Workspace tem chave da Anthropic (para estados honestos). */
  canUseAi: boolean;
}

export interface SdrActionResult {
  ok: boolean;
  error?: string;
}

export interface PreviewResult extends SdrActionResult {
  text?: string;
}

export interface CadenceTextResult extends SdrActionResult {
  text?: string;
}

export interface ModeMarkdownResult extends SdrActionResult {
  errors?: string[];
  markdownName?: string;
  markdownSize?: number;
}
