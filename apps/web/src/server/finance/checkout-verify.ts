import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificação de assinatura e normalização dos webhooks de checkout
 * (Hotmart, Kiwify, Eduzz, Stripe). Funções puras — testadas em
 * checkout-verify.test.ts sem tocar banco nem rede.
 */

export type CheckoutProvider = "HOTMART" | "KIWIFY" | "EDUZZ" | "STRIPE";

export const CHECKOUT_PROVIDERS: CheckoutProvider[] = [
  "HOTMART",
  "KIWIFY",
  "EDUZZ",
  "STRIPE",
];

export const CHECKOUT_PROVIDER_LABELS: Record<CheckoutProvider, string> = {
  HOTMART: "Hotmart",
  KIWIFY: "Kiwify",
  EDUZZ: "Eduzz",
  STRIPE: "Stripe",
};

/** Slug da URL do webhook (/api/webhooks/checkout/{slug}/{workspaceId}). */
export function providerFromSlug(slug: string): CheckoutProvider | null {
  const upper = slug.toUpperCase();
  return (CHECKOUT_PROVIDERS as string[]).includes(upper)
    ? (upper as CheckoutProvider)
    : null;
}

/** Evento normalizado — o processamento é igual para os 4 provedores. */
export interface NormalizedCheckoutEvent {
  kind: "paid" | "refunded" | "chargeback";
  /** Id externo da transação (idempotência por [workspaceId, provider, externalId]). */
  externalId: string;
  /** Id do produto no checkout — mapeado para ProductOffer via settings.checkoutMappings. */
  productExternalId: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  /** Valor pago em centavos; null usa o preço do produto mapeado. */
  valueCents: number | null;
  qty: number;
}

/** Comparação em tempo constante (evita timing attack em tokens). */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

// ── Hotmart: header X-HOTMART-HOTTOK ─────────────────────────────────────────

export function verifyHotmartToken(hottok: string | null, expected: string): boolean {
  return Boolean(hottok && expected) && safeEqual(hottok ?? "", expected);
}

// ── Kiwify: token na query (?token=) ou no corpo (body.token) ────────────────

export function verifyKiwifyToken(token: string | null, expected: string): boolean {
  return Boolean(token && expected) && safeEqual(token ?? "", expected);
}

// ── Eduzz: HMAC SHA256 do corpo cru no header x-signature ────────────────────

export function eduzzSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyEduzzSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  return safeEqual(signature.trim().toLowerCase(), eduzzSignature(rawBody, secret));
}

// ── Stripe: header Stripe-Signature "t=...,v1=..." (HMAC SHA256, tolerância) ─

export function stripeSignatureV1(rawBody: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  options?: { toleranceSeconds?: number; nowMs?: number },
): boolean {
  if (!header || !secret) return false;

  let timestamp: string | null = null;
  const candidates: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && value) timestamp = value;
    if (key === "v1" && value) candidates.push(value);
  }
  if (!timestamp || candidates.length === 0) return false;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;

  // Tolerância padrão de 5 minutos contra replay de payloads antigos.
  const tolerance = options?.toleranceSeconds ?? 300;
  const nowSeconds = (options?.nowMs ?? Date.now()) / 1000;
  if (Math.abs(nowSeconds - seconds) > tolerance) return false;

  const expected = stripeSignatureV1(rawBody, timestamp, secret);
  return candidates.some((candidate) => safeEqual(candidate, expected));
}

// ── Helpers de leitura tolerante do JSON dos provedores ──────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(source: Record<string, unknown> | null, key: string): string | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readNumber(source: Record<string, unknown> | null, key: string): number | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Valor em unidades da moeda (ex.: 1997.0) → centavos. */
function unitsToCents(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}

// ── Parse Hotmart ────────────────────────────────────────────────────────────

const HOTMART_PAID_EVENTS = new Set(["PURCHASE_COMPLETE", "PURCHASE_APPROVED"]);

export function parseHotmartEvent(body: unknown): NormalizedCheckoutEvent | null {
  const root = asRecord(body);
  const event = readString(root, "event");
  const data = asRecord(root?.["data"]);
  const purchase = asRecord(data?.["purchase"]);
  const externalId = readString(purchase, "transaction");
  if (!event || !externalId) return null;

  let kind: NormalizedCheckoutEvent["kind"];
  if (HOTMART_PAID_EVENTS.has(event)) kind = "paid";
  else if (event === "PURCHASE_REFUNDED") kind = "refunded";
  else if (event === "PURCHASE_CHARGEBACK") kind = "chargeback";
  else return null;

  const product = asRecord(data?.["product"]);
  const buyer = asRecord(data?.["buyer"]);
  const price = asRecord(purchase?.["price"]);

  return {
    kind,
    externalId,
    productExternalId: readString(product, "id"),
    buyerName: readString(buyer, "name"),
    buyerEmail: readString(buyer, "email"),
    buyerPhone: readString(buyer, "checkout_phone") ?? readString(buyer, "phone"),
    valueCents: unitsToCents(readNumber(price, "value")),
    qty: 1,
  };
}

// ── Parse Kiwify ─────────────────────────────────────────────────────────────

export function parseKiwifyEvent(body: unknown): NormalizedCheckoutEvent | null {
  const root = asRecord(body);
  const status = readString(root, "order_status")?.toLowerCase();
  const externalId = readString(root, "order_id");
  if (!status || !externalId) return null;

  let kind: NormalizedCheckoutEvent["kind"];
  if (status === "paid") kind = "paid";
  else if (status === "refunded") kind = "refunded";
  else if (status === "chargedback" || status === "chargeback") kind = "chargeback";
  else return null;

  const product = asRecord(root?.["Product"]);
  const customer = asRecord(root?.["Customer"]);
  const commissions = asRecord(root?.["Commissions"]);

  return {
    kind,
    externalId,
    productExternalId: readString(product, "product_id") ?? readString(root, "product_id"),
    buyerName: readString(customer, "full_name") ?? readString(customer, "first_name"),
    buyerEmail: readString(customer, "email"),
    buyerPhone: readString(customer, "mobile") ?? readString(customer, "phone"),
    // Kiwify envia charge_amount já em centavos.
    valueCents: readNumber(commissions, "charge_amount"),
    qty: 1,
  };
}

// ── Parse Eduzz (myeduzz.*) ──────────────────────────────────────────────────

export function parseEduzzEvent(body: unknown): NormalizedCheckoutEvent | null {
  const root = asRecord(body);
  const event = readString(root, "event");
  const data = asRecord(root?.["data"]);
  const externalId = readString(data, "id");
  if (!event || !externalId) return null;

  let kind: NormalizedCheckoutEvent["kind"];
  if (event === "myeduzz.invoice_paid") kind = "paid";
  else if (event === "myeduzz.invoice_refunded") kind = "refunded";
  else if (event === "myeduzz.invoice_chargeback") kind = "chargeback";
  else return null;

  const buyer = asRecord(data?.["buyer"]);
  const items = Array.isArray(data?.["items"]) ? (data?.["items"] as unknown[]) : [];
  const firstItem = asRecord(items[0]);
  const paid = asRecord(data?.["paid"]) ?? asRecord(data?.["price"]);

  return {
    kind,
    externalId,
    productExternalId: readString(firstItem, "productId"),
    buyerName: readString(buyer, "name"),
    buyerEmail: readString(buyer, "email"),
    buyerPhone: readString(buyer, "cellphone") ?? readString(buyer, "phone"),
    valueCents: unitsToCents(readNumber(paid, "value")),
    qty: 1,
  };
}

// ── Parse Stripe ─────────────────────────────────────────────────────────────

export function parseStripeEvent(body: unknown): NormalizedCheckoutEvent | null {
  const root = asRecord(body);
  const type = readString(root, "type");
  const object = asRecord(asRecord(root?.["data"])?.["object"]);
  if (!type || !object) return null;

  if (type === "checkout.session.completed") {
    // Usa o payment_intent como id externo para casar com charge.refunded depois.
    const externalId = readString(object, "payment_intent") ?? readString(object, "id");
    if (!externalId) return null;
    const customer = asRecord(object["customer_details"]);
    const metadata = asRecord(object["metadata"]);
    return {
      kind: "paid",
      externalId,
      productExternalId: readString(metadata, "product_id"),
      buyerName: readString(customer, "name"),
      buyerEmail: readString(customer, "email"),
      buyerPhone: readString(customer, "phone"),
      // amount_total já vem em centavos.
      valueCents: readNumber(object, "amount_total"),
      qty: 1,
    };
  }

  if (type === "charge.refunded") {
    const externalId = readString(object, "payment_intent") ?? readString(object, "id");
    if (!externalId) return null;
    return {
      kind: "refunded",
      externalId,
      productExternalId: null,
      buyerName: null,
      buyerEmail: null,
      buyerPhone: null,
      valueCents: null,
      qty: 1,
    };
  }

  return null;
}

/** Dispatcher de parse por provedor. */
export function parseCheckoutEvent(
  provider: CheckoutProvider,
  body: unknown,
): NormalizedCheckoutEvent | null {
  switch (provider) {
    case "HOTMART":
      return parseHotmartEvent(body);
    case "KIWIFY":
      return parseKiwifyEvent(body);
    case "EDUZZ":
      return parseEduzzEvent(body);
    case "STRIPE":
      return parseStripeEvent(body);
  }
}
