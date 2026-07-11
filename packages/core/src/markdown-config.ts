import { z } from "zod";

import type { PlaybookSeed } from "./stages.js";

/**
 * Parser/validador dos arquivos .md de configuração (persona/modos/playbooks).
 * Formato: seções por heading `## <chave>`; corpo em texto livre; listas com `-`.
 * O "mínimo necessário": objetivo, tom/condução, ações permitidas, avançar/regredir, handoff.
 */

export interface ParsedMarkdownConfig {
  title: string;
  sections: Record<string, string>;
}

const HEADING_ALIASES: Record<string, string> = {
  objetivo: "objective",
  objective: "objective",
  "tom e condução": "instructions",
  "tom e conducao": "instructions",
  instruções: "instructions",
  instrucoes: "instructions",
  conducao: "instructions",
  condução: "instructions",
  "ações permitidas": "allowedActions",
  "acoes permitidas": "allowedActions",
  "allowed actions": "allowedActions",
  "avançar quando": "advanceWhen",
  "avancar quando": "advanceWhen",
  "regredir quando": "regressWhen",
  cadência: "cadence",
  cadencia: "cadence",
  handoff: "handoffTriggers",
  "gatilhos de handoff": "handoffTriggers",
  autonomia: "autonomy",
  persona: "persona",
  tom: "tone",
  icp: "icp",
  "regras comerciais": "commercialRules",
};

export function parseMarkdownConfig(md: string): ParsedMarkdownConfig {
  const lines = md.split(/\r?\n/);
  let title = "";
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey) {
      sections[currentKey] = buffer.join("\n").trim();
    }
    buffer = [];
  };

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h1 && !title) {
      title = h1[1]?.trim() ?? "";
      continue;
    }
    if (h2) {
      flush();
      const raw = (h2[1] ?? "").trim().toLowerCase();
      currentKey = HEADING_ALIASES[raw] ?? raw;
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();

  return { title, sections };
}

function parseList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

const AUTONOMY_MAP: Record<string, "DRAFT" | "SEMI" | "AUTO"> = {
  rascunho: "DRAFT",
  draft: "DRAFT",
  semiauto: "SEMI",
  "semi-auto": "SEMI",
  semi: "SEMI",
  auto: "AUTO",
  automático: "AUTO",
  automatico: "AUTO",
};

const VALID_ACTIONS = new Set([
  "send_text",
  "send_image",
  "send_link",
  "send_buttons",
  "update_lead",
  "move_stage",
  "schedule_followup",
  "register_objection",
  "escalate_human",
  "register_sale",
  "flag_missing_context",
]);

export interface MarkdownValidation<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}

export type PlaybookFromMarkdown = Omit<PlaybookSeed, "toastText"> & { title: string };

export function validatePlaybookMarkdown(md: string): MarkdownValidation<PlaybookFromMarkdown> {
  const parsed = parseMarkdownConfig(md);
  const errors: string[] = [];

  const objective = parsed.sections["objective"];
  const instructions = parsed.sections["instructions"];
  const allowedRaw = parsed.sections["allowedActions"];
  const advanceWhen = parsed.sections["advanceWhen"];
  const regressWhen = parsed.sections["regressWhen"] ?? "";
  const handoffRaw = parsed.sections["handoffTriggers"] ?? "";
  const autonomyOriginal = (parsed.sections["autonomy"] ?? "Semiauto").trim();
  const autonomyRaw = autonomyOriginal.toLowerCase();
  const cadenceRaw = parsed.sections["cadence"] ?? "";

  if (!parsed.title) errors.push("Falta o título (# Nome do playbook)");
  if (!objective) errors.push("Falta a seção `## Objetivo`");
  if (!instructions) errors.push("Falta a seção `## Tom e condução` (ou `## Instruções`)");
  if (!allowedRaw) errors.push("Falta a seção `## Ações permitidas`");
  if (!advanceWhen) errors.push("Falta a seção `## Avançar quando`");

  const allowedActions = allowedRaw ? parseList(allowedRaw) : [];
  for (const action of allowedActions) {
    if (!VALID_ACTIONS.has(action)) {
      errors.push(`Ação desconhecida em Ações permitidas: "${action}"`);
    }
  }

  const autonomy = AUTONOMY_MAP[autonomyRaw];
  if (!autonomy) {
    errors.push(`Autonomia inválida: "${autonomyOriginal}" (use Rascunho | Semiauto | Auto)`);
  }

  let intervals: number[] = [];
  let maxTouches = 0;
  if (cadenceRaw) {
    const numbers = cadenceRaw.match(/\d+\s*(min|h|d)/gi) ?? [];
    intervals = numbers.map((n) => {
      const value = parseInt(n, 10);
      if (/h/i.test(n)) return value * 60;
      if (/d/i.test(n)) return value * 1440;
      return value;
    });
    maxTouches = intervals.length;
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    value: {
      title: parsed.title,
      objective: objective ?? "",
      instructions: instructions ?? "",
      allowedActions,
      advanceWhen: advanceWhen ?? "",
      regressWhen,
      cadence: { intervals, maxTouches },
      handoffTriggers: handoffRaw ? parseList(handoffRaw) : [],
      autonomy: autonomy ?? "SEMI",
    },
  };
}

export const personaMarkdownSchema = z.object({
  title: z.string().min(1),
  speaksAs: z.string().min(1),
  tone: z.string().min(1),
  icp: z.string().optional(),
  commercialRules: z.string().optional(),
});

export type PersonaFromMarkdown = z.infer<typeof personaMarkdownSchema>;

export function validatePersonaMarkdown(md: string): MarkdownValidation<PersonaFromMarkdown> {
  const parsed = parseMarkdownConfig(md);
  const candidate = {
    title: parsed.title,
    speaksAs: parsed.sections["persona"] ?? parsed.sections["speaksas"] ?? "",
    tone: parsed.sections["tone"] ?? parsed.sections["instructions"] ?? "",
    icp: parsed.sections["icp"],
    commercialRules: parsed.sections["commercialRules"],
  };
  const result = personaMarkdownSchema.safeParse(candidate);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, errors: [], value: result.data };
}

/** Documento-piloto de playbook (mesmo conteúdo servido para download na UI). */
export function pilotPlaybookMarkdown(stageName: string): string {
  return `# Playbook — ${stageName}

## Objetivo
Descreva em uma frase o que a IA deve alcançar com o lead neste estágio.

## Tom e condução
Como a IA conduz: perguntas curtas, uma por vez, tom humano. Sem inventar preço, prazo ou promessa.

## Ações permitidas
- send_text
- update_lead
- move_stage
- schedule_followup
- escalate_human
- flag_missing_context

## Avançar quando
Critério objetivo para avançar (ex.: lead demonstra interesse explícito).

## Regredir quando
Critério para regredir (ex.: lead esfria após cadência completa).

## Cadência
0min, 20min, 3h, 1d, 3d, 7d

## Handoff
- pedido explícito de falar com humano
- pedido de desconto acima da alçada

## Autonomia
Semiauto
`;
}
