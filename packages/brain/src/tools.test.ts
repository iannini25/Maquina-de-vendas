import { ALL_AGENT_ACTIONS } from "@sales4u/core";
import { describe, expect, it } from "vitest";

import {
  AGENT_TOOLS,
  enforceToolCall,
  isLinkAllowed,
  isPaymentLinkUrl,
  mentionsDiscount,
  normalizeUrlPrefix,
  type EnforcementPolicy,
} from "./tools.js";

describe("AGENT_TOOLS", () => {
  it("cobre exatamente as ações do core", () => {
    const toolNames = AGENT_TOOLS.map((tool) => tool.name).sort();
    expect(toolNames).toEqual([...ALL_AGENT_ACTIONS].sort());
  });

  it("toda ferramenta tem JSON Schema de objeto com required coerente", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
      const properties = tool.inputSchema.properties as Record<string, unknown>;
      const required = (tool.inputSchema.required as string[] | undefined) ?? [];
      for (const key of required) {
        expect(properties[key]).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers de URL / desconto
// ---------------------------------------------------------------------------

describe("normalizeUrlPrefix", () => {
  it("remove protocolo, www e barra final", () => {
    expect(normalizeUrlPrefix("https://www.Exemplo.com/Pagina/")).toBe("exemplo.com/pagina");
    expect(normalizeUrlPrefix("http://exemplo.com")).toBe("exemplo.com");
  });
});

describe("isLinkAllowed", () => {
  const allowed = ["https://www.escola.com.br", "https://pay.hotmart.com/produto-x"];

  it("aceita variações de protocolo/www do mesmo prefixo", () => {
    expect(isLinkAllowed("http://escola.com.br/aula", allowed)).toBe(true);
    expect(isLinkAllowed("https://escola.com.br", allowed)).toBe(true);
    expect(isLinkAllowed("https://pay.hotmart.com/produto-x?src=wa", allowed)).toBe(true);
  });

  it("bloqueia domínio parecido (anti-bypass por prefixo)", () => {
    expect(isLinkAllowed("https://escola.com.br.golpe.io/aula", allowed)).toBe(false);
  });

  it("bloqueia URL fora da lista e lista vazia", () => {
    expect(isLinkAllowed("https://site-aleatorio.com", allowed)).toBe(false);
    expect(isLinkAllowed("https://escola.com.br", [])).toBe(false);
    expect(isLinkAllowed("", allowed)).toBe(false);
  });
});

describe("isPaymentLinkUrl", () => {
  it("detecta provedores conhecidos e caminhos de checkout", () => {
    expect(isPaymentLinkUrl("https://pay.hotmart.com/x")).toBe(true);
    expect(isPaymentLinkUrl("https://loja.com/checkout/plano")).toBe(true);
    expect(isPaymentLinkUrl("https://kiwify.com.br/oferta")).toBe(true);
  });

  it("usa prefixos registrados", () => {
    expect(isPaymentLinkUrl("https://loja.com/comprar", ["loja.com/comprar"])).toBe(true);
  });

  it("não marca link comum", () => {
    expect(isPaymentLinkUrl("https://escola.com.br/blog/post")).toBe(false);
  });
});

describe("mentionsDiscount", () => {
  it("detecta desconto, cupom e percentual", () => {
    expect(mentionsDiscount("Consigo um desconto especial pra você")).toBe(true);
    expect(mentionsDiscount("use o CUPOM BEMVINDO")).toBe(true);
    expect(mentionsDiscount("hoje sai com 20% off")).toBe(true);
    expect(mentionsDiscount("são 10% de desconto à vista")).toBe(true);
  });

  it("ignora texto sem desconto", () => {
    expect(mentionsDiscount("O curso custa R$ 1.997,00 à vista")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enforceToolCall — cada regra
// ---------------------------------------------------------------------------

const ALLOWED_LINKS = ["https://escola.com.br", "https://pay.hotmart.com/produto-x"];

function policy(overrides: Partial<EnforcementPolicy> = {}): EnforcementPolicy {
  return {
    allowedActions: [...ALL_AGENT_ACTIONS],
    autonomy: "AUTO",
    allowedLinkUrls: ALLOWED_LINKS,
    ...overrides,
  };
}

describe("enforceToolCall", () => {
  it("bloqueia ação fora de allowedActions (mesmo em AUTO)", () => {
    const result = enforceToolCall(
      { name: "register_sale", input: { offerId: "o1", valueCents: 1000 } },
      policy({ allowedActions: ["send_text"] }),
    );
    expect(result).toMatchObject({ verdict: "block" });
  });

  it("bloqueia send_link fora da allowlist em qualquer autonomia", () => {
    for (const autonomy of ["DRAFT", "SEMI", "AUTO"] as const) {
      const result = enforceToolCall(
        { name: "send_link", input: { url: "https://link-inventado.com/x" } },
        policy({ autonomy }),
      );
      expect(result).toMatchObject({ verdict: "block" });
    }
  });

  it("bloqueia send_link sem URL", () => {
    expect(enforceToolCall({ name: "send_link", input: {} }, policy())).toMatchObject({
      verdict: "block",
    });
  });

  describe("autonomia DRAFT", () => {
    it("toda ação de envio vira rascunho", () => {
      const sends = [
        { name: "send_text", input: { text: "oi" } },
        { name: "send_image", input: { assetKey: "banner" } },
        { name: "send_link", input: { url: "https://escola.com.br/aula" } },
        { name: "send_buttons", input: { text: "escolha", options: ["a", "b"] } },
      ];
      for (const call of sends) {
        expect(enforceToolCall(call, policy({ autonomy: "DRAFT" }))).toEqual({
          verdict: "to_draft",
        });
      }
    });

    it("ações internas continuam permitidas", () => {
      const internals = [
        { name: "update_lead", input: { fields: { score: 50 } } },
        { name: "move_stage", input: { stageKey: "qualificado", reason: "score alto" } },
        { name: "schedule_followup", input: { minutesFromNow: 60, note: "retomar" } },
        { name: "flag_missing_context", input: { question: "qual o prazo?" } },
      ];
      for (const call of internals) {
        expect(enforceToolCall(call, policy({ autonomy: "DRAFT" }))).toEqual({
          verdict: "allow",
        });
      }
    });
  });

  describe("autonomia SEMI", () => {
    const semi = policy({ autonomy: "SEMI" });

    it("send_link com URL de pagamento vai para aprovação", () => {
      const result = enforceToolCall(
        { name: "send_link", input: { url: "https://pay.hotmart.com/produto-x" } },
        semi,
      );
      expect(result).toEqual({ verdict: "to_approval", kind: "SEND_PAYMENT_LINK" });
    });

    it("send_link com prefixo de pagamento registrado vai para aprovação", () => {
      const result = enforceToolCall(
        { name: "send_link", input: { url: "https://escola.com.br/comprar" } },
        policy({ autonomy: "SEMI", paymentUrlPrefixes: ["escola.com.br/comprar"] }),
      );
      expect(result).toEqual({ verdict: "to_approval", kind: "SEND_PAYMENT_LINK" });
    });

    it("register_sale vai para aprovação", () => {
      const result = enforceToolCall(
        { name: "register_sale", input: { offerId: "o1", valueCents: 199700 } },
        semi,
      );
      expect(result).toEqual({ verdict: "to_approval", kind: "SEND_PAYMENT_LINK" });
    });

    it("envio oferecendo desconto vai para aprovação DISCOUNT", () => {
      const result = enforceToolCall(
        { name: "send_text", input: { text: "fecho hoje com 15% de desconto" } },
        semi,
      );
      expect(result).toEqual({ verdict: "to_approval", kind: "DISCOUNT" });
    });

    it("demais envios são permitidos", () => {
      expect(
        enforceToolCall({ name: "send_text", input: { text: "como posso ajudar?" } }, semi),
      ).toEqual({ verdict: "allow" });
      expect(
        enforceToolCall(
          { name: "send_link", input: { url: "https://escola.com.br/blog" } },
          semi,
        ),
      ).toEqual({ verdict: "allow" });
    });
  });

  describe("autonomia AUTO", () => {
    it("permite envio e ações internas dentro do playbook", () => {
      expect(enforceToolCall({ name: "send_text", input: { text: "oi" } }, policy())).toEqual({
        verdict: "allow",
      });
      expect(
        enforceToolCall(
          { name: "register_sale", input: { offerId: "o1", valueCents: 1000 } },
          policy(),
        ),
      ).toEqual({ verdict: "allow" });
    });
  });
});
