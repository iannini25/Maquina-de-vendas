import type { Autonomy } from "@vendaflow/core";

import type { LlmToolCall, ToolSpec } from "./router.js";

/**
 * Ferramentas do agente de conversa (specs para tool-calling) e
 * enforcement de guardrails sobre cada tool call antes da execução.
 */

// ---------------------------------------------------------------------------
// Specs das ferramentas (JSON Schema)
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: ToolSpec[] = [
  {
    name: "send_text",
    description: "Envia uma mensagem de texto curta e humana para o lead no WhatsApp.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texto da mensagem (curto, tom humano)" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "send_image",
    description: "Envia uma imagem já registrada na biblioteca de assets do workspace.",
    inputSchema: {
      type: "object",
      properties: {
        assetKey: { type: "string", description: "Chave do asset registrado" },
        caption: { type: "string", description: "Legenda opcional da imagem" },
      },
      required: ["assetKey"],
      additionalProperties: false,
    },
  },
  {
    name: "send_link",
    description:
      "Envia um link para o lead. Só use URLs explicitamente registradas — nunca invente links.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL registrada e permitida" },
        message: { type: "string", description: "Mensagem opcional que acompanha o link" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "send_buttons",
    description: "Envia mensagem com botões de resposta rápida.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texto da mensagem" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Rótulos dos botões (2 a 3 opções curtas)",
        },
      },
      required: ["text", "options"],
      additionalProperties: false,
    },
  },
  {
    name: "update_lead",
    description: "Atualiza dados do lead descobertos na conversa.",
    inputSchema: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome do lead" },
            email: { type: "string", description: "E-mail do lead" },
            score: { type: "number", description: "Score de 0 a 100" },
            temperature: {
              type: "string",
              enum: ["COLD", "WARM", "HOT"],
              description: "Temperatura do lead",
            },
            nextActionText: { type: "string", description: "Próxima ação sugerida" },
          },
          additionalProperties: false,
        },
      },
      required: ["fields"],
      additionalProperties: false,
    },
  },
  {
    name: "move_stage",
    description: "Move o lead para outro estágio do funil, com justificativa.",
    inputSchema: {
      type: "object",
      properties: {
        stageKey: { type: "string", description: "Chave do estágio de destino" },
        reason: { type: "string", description: "Motivo objetivo da mudança" },
      },
      required: ["stageKey", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_followup",
    description: "Agenda um follow-up para retomar a conversa mais tarde.",
    inputSchema: {
      type: "object",
      properties: {
        minutesFromNow: { type: "number", description: "Minutos a partir de agora" },
        note: { type: "string", description: "Contexto do follow-up" },
      },
      required: ["minutesFromNow", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "register_objection",
    description: "Registra uma objeção levantada pelo lead.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Tipo da objeção (preço, tempo, confiança...)" },
        detail: { type: "string", description: "Detalhe opcional da objeção" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "escalate_human",
    description: "Escala a conversa para um humano assumir imediatamente.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Motivo do handoff" },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "register_sale",
    description: "Registra uma venda fechada com a oferta e o valor combinado.",
    inputSchema: {
      type: "object",
      properties: {
        offerId: { type: "string", description: "ID da oferta vendida" },
        valueCents: { type: "number", description: "Valor da venda em centavos" },
      },
      required: ["offerId", "valueCents"],
      additionalProperties: false,
    },
  },
  {
    name: "flag_missing_context",
    description:
      "Sinaliza que falta contexto registrado para responder com segurança (nunca invente).",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Pergunta que a IA não soube responder" },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Enforcement (guardrails)
// ---------------------------------------------------------------------------

/** Valores espelham o enum ApprovalKind do Prisma (@vendaflow/db). */
export type ApprovalKindString =
  | "SEND_PAYMENT_LINK"
  | "DISCOUNT"
  | "BULK_OUTREACH"
  | "MESSAGE_DRAFT";

export interface EnforcementPolicy {
  /** Ações permitidas pelo playbook do estágio. */
  allowedActions: string[];
  autonomy: Autonomy;
  /** Prefixos de URL que a IA pode enviar (anti-alucinação de link). */
  allowedLinkUrls: string[];
  /** Prefixos de URL de checkout registrados — complementa a heurística de pagamento. */
  paymentUrlPrefixes?: string[];
}

export type EnforcementResult =
  | { verdict: "allow" }
  | { verdict: "to_draft" }
  | { verdict: "to_approval"; kind: ApprovalKindString }
  | { verdict: "block"; reason: string };

const SEND_ACTIONS = new Set(["send_text", "send_image", "send_link", "send_buttons"]);

const PAYMENT_URL_MARKERS = [
  "hotmart",
  "kiwify",
  "kirvano",
  "eduzz",
  "monetizze",
  "perfectpay",
  "pagseguro",
  "mercadopago",
  "pagar.me",
  "stripe.com",
  "checkout",
  "pay.",
  "/pay",
  "pagamento",
];

const DISCOUNT_PATTERN = /\bdesconto\b|\bcupom\b|\d+\s*%\s*(off|de\s+desconto)/i;

/** Normaliza URL para comparação por prefixo: sem protocolo, www e barra final. */
export function normalizeUrlPrefix(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/**
 * URL permitida se casa com algum prefixo normalizado E o caractere seguinte
 * ao prefixo é um separador — evita bypass tipo "exemplo.com.evil.com".
 */
export function isLinkAllowed(url: string, allowedLinkUrls: string[]): boolean {
  const normalized = normalizeUrlPrefix(url);
  if (!normalized) return false;
  return allowedLinkUrls.some((allowed) => {
    const prefix = normalizeUrlPrefix(allowed);
    if (!prefix || !normalized.startsWith(prefix)) return false;
    const boundary = normalized.charAt(prefix.length);
    return boundary === "" || boundary === "/" || boundary === "?" || boundary === "#";
  });
}

/** Heurística de URL de pagamento (checkout) + prefixos registrados. */
export function isPaymentLinkUrl(url: string, paymentUrlPrefixes: string[] = []): boolean {
  const normalized = normalizeUrlPrefix(url);
  if (!normalized) return false;
  const matchesRegistered = paymentUrlPrefixes.some((candidate) => {
    const prefix = normalizeUrlPrefix(candidate);
    return prefix !== "" && normalized.startsWith(prefix);
  });
  return matchesRegistered || PAYMENT_URL_MARKERS.some((marker) => normalized.includes(marker));
}

/** Detecta oferta de desconto no texto da mensagem. */
export function mentionsDiscount(text: string): boolean {
  return DISCOUNT_PATTERN.test(text);
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

/** Texto "visível" da mensagem de um tool call de envio. */
function messageTextOf(call: LlmToolCall): string {
  return ["text", "caption", "message"]
    .map((field) => stringField(call.input, field))
    .filter(Boolean)
    .join(" ");
}

/**
 * Aplica os guardrails a um tool call do agente:
 * 1. ação fora do playbook → block
 * 2. send_link fora da allowlist → block (anti-alucinação, vale em qualquer autonomia)
 * 3. autonomia DRAFT → qualquer envio vira rascunho
 * 4. autonomia SEMI → link de pagamento, register_sale e desconto pedem aprovação
 * 5. resto → allow
 */
export function enforceToolCall(call: LlmToolCall, policy: EnforcementPolicy): EnforcementResult {
  if (!policy.allowedActions.includes(call.name)) {
    return {
      verdict: "block",
      reason: `ação "${call.name}" fora das ações permitidas do estágio`,
    };
  }

  if (call.name === "send_link") {
    const url = stringField(call.input, "url");
    if (!isLinkAllowed(url, policy.allowedLinkUrls)) {
      return {
        verdict: "block",
        reason: `link "${url}" fora da lista de links permitidos`,
      };
    }
  }

  const isSendAction = SEND_ACTIONS.has(call.name);

  if (policy.autonomy === "DRAFT") {
    return isSendAction ? { verdict: "to_draft" } : { verdict: "allow" };
  }

  if (policy.autonomy === "SEMI") {
    if (call.name === "register_sale") {
      // Fechar venda é ação de alçada comercial — aprovação humana.
      return { verdict: "to_approval", kind: "SEND_PAYMENT_LINK" };
    }
    if (
      call.name === "send_link" &&
      isPaymentLinkUrl(stringField(call.input, "url"), policy.paymentUrlPrefixes ?? [])
    ) {
      return { verdict: "to_approval", kind: "SEND_PAYMENT_LINK" };
    }
    if (isSendAction && mentionsDiscount(messageTextOf(call))) {
      return { verdict: "to_approval", kind: "DISCOUNT" };
    }
  }

  return { verdict: "allow" };
}
