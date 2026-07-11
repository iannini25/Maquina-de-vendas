import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  eduzzSignature,
  parseEduzzEvent,
  parseHotmartEvent,
  parseKiwifyEvent,
  parseStripeEvent,
  providerFromSlug,
  safeEqual,
  stripeSignatureV1,
  verifyEduzzSignature,
  verifyHotmartToken,
  verifyKiwifyToken,
  verifyStripeSignature,
} from "./checkout-verify";

/** Payloads de exemplo no formato real de cada provedor. */

const HOTMART_PAID = {
  event: "PURCHASE_APPROVED",
  data: {
    product: { id: 4818218, name: "Curso IA na Liderança" },
    buyer: {
      name: "Juliana Alves",
      email: "juliana@exemplo.com",
      checkout_phone: "5531988776655",
    },
    purchase: {
      transaction: "HP1723456789",
      status: "APPROVED",
      price: { value: 1997, currency_value: "BRL" },
    },
  },
};

const KIWIFY_PAID = {
  order_id: "c1a2b3d4-e5f6-7890",
  order_status: "paid",
  Product: { product_id: "prod_abc123", product_name: "Curso IA na Liderança" },
  Customer: {
    full_name: "Marcos Paulo",
    email: "marcos@exemplo.com",
    mobile: "+55 (11) 98888-7777",
  },
  Commissions: { charge_amount: 199700 },
};

const EDUZZ_PAID = {
  id: "evt_01J0XYZ",
  event: "myeduzz.invoice_paid",
  data: {
    id: 78901234,
    buyer: { name: "Renata Lima", email: "renata@exemplo.com", cellphone: "5541977776666" },
    items: [{ productId: 112233, name: "Curso IA na Liderança" }],
    paid: { value: 1997.0, currency: "BRL" },
  },
};

const STRIPE_PAID = {
  id: "evt_1PqRsT",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_a1b2c3",
      payment_intent: "pi_3PqRsT",
      amount_total: 199700,
      currency: "brl",
      customer_details: {
        name: "Otávio Souza",
        email: "otavio@exemplo.com",
        phone: "+5511955554444",
      },
      metadata: { product_id: "prod_stripe_1" },
    },
  },
};

describe("safeEqual", () => {
  it("compara em tempo constante sem vazar por tamanho", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("providerFromSlug", () => {
  it("aceita os 4 provedores e rejeita o resto", () => {
    expect(providerFromSlug("hotmart")).toBe("HOTMART");
    expect(providerFromSlug("kiwify")).toBe("KIWIFY");
    expect(providerFromSlug("eduzz")).toBe("EDUZZ");
    expect(providerFromSlug("stripe")).toBe("STRIPE");
    expect(providerFromSlug("paypal")).toBeNull();
  });
});

describe("Hotmart — X-HOTMART-HOTTOK", () => {
  it("aceita o hottok correto", () => {
    expect(verifyHotmartToken("tok_secreto_123", "tok_secreto_123")).toBe(true);
  });

  it("rejeita hottok errado, ausente ou credencial vazia", () => {
    expect(verifyHotmartToken("errado", "tok_secreto_123")).toBe(false);
    expect(verifyHotmartToken(null, "tok_secreto_123")).toBe(false);
    expect(verifyHotmartToken("tok_secreto_123", "")).toBe(false);
  });

  it("normaliza PURCHASE_APPROVED em evento pago", () => {
    const event = parseHotmartEvent(HOTMART_PAID);
    expect(event).toEqual({
      kind: "paid",
      externalId: "HP1723456789",
      productExternalId: "4818218",
      buyerName: "Juliana Alves",
      buyerEmail: "juliana@exemplo.com",
      buyerPhone: "5531988776655",
      valueCents: 199700,
      qty: 1,
    });
  });

  it("normaliza REFUNDED/CHARGEBACK e ignora eventos desconhecidos", () => {
    const refunded = parseHotmartEvent({
      ...HOTMART_PAID,
      event: "PURCHASE_REFUNDED",
    });
    expect(refunded?.kind).toBe("refunded");

    const chargeback = parseHotmartEvent({
      ...HOTMART_PAID,
      event: "PURCHASE_CHARGEBACK",
    });
    expect(chargeback?.kind).toBe("chargeback");

    expect(parseHotmartEvent({ ...HOTMART_PAID, event: "PURCHASE_DELAYED" })).toBeNull();
    expect(parseHotmartEvent({})).toBeNull();
  });
});

describe("Kiwify — token na query ou no corpo", () => {
  it("aceita o token correto e rejeita o errado", () => {
    expect(verifyKiwifyToken("kw_token_9", "kw_token_9")).toBe(true);
    expect(verifyKiwifyToken("outro", "kw_token_9")).toBe(false);
    expect(verifyKiwifyToken(null, "kw_token_9")).toBe(false);
  });

  it("normaliza order_status paid com valor em centavos", () => {
    const event = parseKiwifyEvent(KIWIFY_PAID);
    expect(event?.kind).toBe("paid");
    expect(event?.externalId).toBe("c1a2b3d4-e5f6-7890");
    expect(event?.productExternalId).toBe("prod_abc123");
    expect(event?.valueCents).toBe(199700);
    expect(event?.buyerEmail).toBe("marcos@exemplo.com");
  });

  it("normaliza refunded/chargedback e ignora waiting_payment", () => {
    expect(parseKiwifyEvent({ ...KIWIFY_PAID, order_status: "refunded" })?.kind).toBe("refunded");
    expect(parseKiwifyEvent({ ...KIWIFY_PAID, order_status: "chargedback" })?.kind).toBe(
      "chargeback",
    );
    expect(parseKiwifyEvent({ ...KIWIFY_PAID, order_status: "waiting_payment" })).toBeNull();
  });
});

describe("Eduzz — HMAC SHA256 do corpo (x-signature)", () => {
  const secret = "eduzz_chave_de_assinatura";
  const rawBody = JSON.stringify(EDUZZ_PAID);

  it("aceita a assinatura HMAC correta do corpo cru", () => {
    const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    expect(verifyEduzzSignature(rawBody, signature, secret)).toBe(true);
    // Assinatura com caixa alta também passa (normalizada para minúsculas).
    expect(verifyEduzzSignature(rawBody, signature.toUpperCase(), secret)).toBe(true);
  });

  it("rejeita corpo adulterado, assinatura errada ou ausente", () => {
    const signature = eduzzSignature(rawBody, secret);
    expect(verifyEduzzSignature(rawBody + " ", signature, secret)).toBe(false);
    expect(verifyEduzzSignature(rawBody, "deadbeef", secret)).toBe(false);
    expect(verifyEduzzSignature(rawBody, null, secret)).toBe(false);
    expect(verifyEduzzSignature(rawBody, signature, "outra_chave")).toBe(false);
  });

  it("normaliza myeduzz.invoice_paid", () => {
    const event = parseEduzzEvent(EDUZZ_PAID);
    expect(event?.kind).toBe("paid");
    expect(event?.externalId).toBe("78901234");
    expect(event?.productExternalId).toBe("112233");
    expect(event?.valueCents).toBe(199700);
    expect(parseEduzzEvent({ ...EDUZZ_PAID, event: "myeduzz.invoice_open" })).toBeNull();
  });
});

describe("Stripe — Stripe-Signature (t=...,v1=...)", () => {
  const secret = "whsec_test_secret_key";
  const rawBody = JSON.stringify(STRIPE_PAID);
  const nowMs = 1_760_000_000_000; // relógio fixo para o teste

  function signedHeader(timestampSeconds: number, body = rawBody): string {
    const v1 = stripeSignatureV1(body, String(timestampSeconds), secret);
    return `t=${timestampSeconds},v1=${v1}`;
  }

  it("aceita assinatura válida dentro da tolerância de 5 minutos", () => {
    const timestamp = Math.floor(nowMs / 1000) - 60; // 1 min atrás
    expect(verifyStripeSignature(rawBody, signedHeader(timestamp), secret, { nowMs })).toBe(true);
  });

  it("rejeita timestamp fora da tolerância (replay)", () => {
    const old = Math.floor(nowMs / 1000) - 6 * 60; // 6 min atrás
    expect(verifyStripeSignature(rawBody, signedHeader(old), secret, { nowMs })).toBe(false);
    const future = Math.floor(nowMs / 1000) + 6 * 60;
    expect(verifyStripeSignature(rawBody, signedHeader(future), secret, { nowMs })).toBe(false);
  });

  it("rejeita corpo adulterado, header malformado e segredo errado", () => {
    const timestamp = Math.floor(nowMs / 1000);
    const header = signedHeader(timestamp);
    expect(verifyStripeSignature(rawBody.replace("199700", "1"), header, secret, { nowMs })).toBe(
      false,
    );
    expect(verifyStripeSignature(rawBody, "v1=abc", secret, { nowMs })).toBe(false);
    expect(verifyStripeSignature(rawBody, `t=${timestamp}`, secret, { nowMs })).toBe(false);
    expect(verifyStripeSignature(rawBody, null, secret, { nowMs })).toBe(false);
    expect(verifyStripeSignature(rawBody, header, "whsec_outro", { nowMs })).toBe(false);
  });

  it("aceita múltiplos v1 desde que um seja válido", () => {
    const timestamp = Math.floor(nowMs / 1000);
    const valid = stripeSignatureV1(rawBody, String(timestamp), secret);
    const header = `t=${timestamp},v1=${"0".repeat(64)},v1=${valid}`;
    expect(verifyStripeSignature(rawBody, header, secret, { nowMs })).toBe(true);
  });

  it("normaliza checkout.session.completed usando o payment_intent como id", () => {
    const event = parseStripeEvent(STRIPE_PAID);
    expect(event?.kind).toBe("paid");
    expect(event?.externalId).toBe("pi_3PqRsT");
    expect(event?.productExternalId).toBe("prod_stripe_1");
    expect(event?.valueCents).toBe(199700);
  });

  it("normaliza charge.refunded casando pelo payment_intent", () => {
    const event = parseStripeEvent({
      type: "charge.refunded",
      data: { object: { id: "ch_1XyZ", payment_intent: "pi_3PqRsT", amount_refunded: 199700 } },
    });
    expect(event?.kind).toBe("refunded");
    expect(event?.externalId).toBe("pi_3PqRsT");
    expect(parseStripeEvent({ type: "invoice.created", data: { object: { id: "in_1" } } })).toBeNull();
  });
});
