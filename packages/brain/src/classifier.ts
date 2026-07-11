import { z } from "zod";

import { safeJsonParse } from "./http.js";

/**
 * Qualificador de leads: prompt para o modelo classifier e parser tolerante
 * da resposta (extrai JSON de texto com lixo em volta, valida com Zod).
 */

export interface ClassifierMessage {
  author: "lead" | "agent";
  text: string;
}

export function buildClassifierPrompt(lastMessages: ClassifierMessage[]): string {
  const transcript = lastMessages
    .map((message) => `${message.author === "lead" ? "Lead" : "Vendedor"}: ${message.text}`)
    .join("\n");

  return [
    "Você é um qualificador de leads de um CRM de vendas via WhatsApp.",
    "Analise a conversa abaixo e classifique o lead.",
    "",
    "<conversa>",
    transcript,
    "</conversa>",
    "",
    "Responda APENAS com um JSON válido, sem texto em volta, no formato:",
    '{"intent": "<intenção principal do lead em poucas palavras>", "temperature": "COLD" | "WARM" | "HOT", "score": <número de 0 a 100>, "objection": "<objeção principal, se houver>"}',
    'Se não houver objeção, omita o campo "objection".',
  ].join("\n");
}

const classifierResponseSchema = z.object({
  intent: z.string().min(1),
  temperature: z.enum(["COLD", "WARM", "HOT"]),
  score: z.coerce.number().min(0).max(100),
  objection: z
    .string()
    .nullish()
    .transform((value) => (value ? value : undefined)),
});

export interface ClassifierResult {
  intent: string;
  temperature: "COLD" | "WARM" | "HOT";
  score: number;
  objection?: string;
}

/**
 * Parser tolerante: extrai o primeiro bloco {...} do texto (modelos às vezes
 * devolvem prosa ou cercas de código em volta), valida com Zod e devolve
 * null se nada aproveitável.
 */
export function parseClassifierResponse(text: string): ClassifierResult | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  const parsed = classifierResponseSchema.safeParse(safeJsonParse(text.slice(start, end + 1)));
  if (!parsed.success) return null;

  const { intent, temperature, score, objection } = parsed.data;
  if (objection === undefined) return { intent, temperature, score };
  return { intent, temperature, score, objection };
}
