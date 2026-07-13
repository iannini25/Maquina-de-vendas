import { randomBytes } from "node:crypto";

import { prisma } from "@sales4u/db";

/** P2002 sem depender de instanceof entre cópias do runtime do Prisma. */
function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

import { logEvent } from "@/lib/events";

import type { CheckoutProvider, NormalizedCheckoutEvent } from "./checkout-verify";
import { CHECKOUT_PROVIDER_LABELS } from "./checkout-verify";

/**
 * Processamento comum dos webhooks de checkout: mapeia produto, vincula lead,
 * cria Order WEBHOOK + AccessGrant e registra eventos. Roda em rota pública
 * (sem sessão), por isso usa prisma com workspaceId explícito em toda query.
 */

export interface CheckoutProcessResult {
  status: number;
  body: Record<string, unknown>;
}

/** Formato persistido em Workspace.settings.checkoutMappings. */
export type CheckoutMappings = Record<string, Record<string, string>>;

export function readCheckoutMappings(settings: unknown): CheckoutMappings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  const raw = (settings as Record<string, unknown>)["checkoutMappings"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: CheckoutMappings = {};
  for (const [provider, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const pairs: Record<string, string> = {};
    for (const [externalId, offerId] of Object.entries(value as Record<string, unknown>)) {
      if (typeof offerId === "string" && offerId) pairs[externalId] = offerId;
    }
    result[provider] = pairs;
  }
  return result;
}

/** ProductOffer do id externo mapeado; fallback: primeiro produto do workspace. */
async function resolveProductOffer(
  workspaceId: string,
  provider: CheckoutProvider,
  productExternalId: string | null,
): Promise<{ id: string; priceCents: number; accessLinks: unknown } | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true },
  });
  const mappings = readCheckoutMappings(workspace?.settings);
  const mappedId = productExternalId ? mappings[provider]?.[productExternalId] : undefined;

  if (mappedId) {
    const mapped = await prisma.productOffer.findFirst({
      where: { id: mappedId, workspaceId },
      select: { id: true, priceCents: true, accessLinks: true },
    });
    if (mapped) return mapped;
  }

  return prisma.productOffer.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, priceCents: true, accessLinks: true },
  });
}

/** Tenta vincular o comprador a um lead existente por e-mail ou telefone. */
async function findLeadForBuyer(
  workspaceId: string,
  event: NormalizedCheckoutEvent,
): Promise<{ id: string } | null> {
  if (event.buyerEmail) {
    const byEmail = await prisma.lead.findFirst({
      where: { workspaceId, email: { equals: event.buyerEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (byEmail) return byEmail;
  }
  if (event.buyerPhone) {
    const digits = event.buyerPhone.replace(/\D/g, "");
    if (digits.length >= 8) {
      const byPhone = await prisma.lead.findFirst({
        where: { workspaceId, phone: { contains: digits.slice(-8) } },
        select: { id: true },
      });
      if (byPhone) return byPhone;
    }
  }
  return null;
}

function firstAccessLink(accessLinks: unknown): string {
  if (!Array.isArray(accessLinks)) return "";
  const first = accessLinks[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    const url = (first as Record<string, unknown>)["url"];
    if (typeof url === "string") return url;
  }
  return typeof first === "string" ? first : "";
}

export async function processCheckoutEvent(
  workspaceId: string,
  provider: CheckoutProvider,
  event: NormalizedCheckoutEvent,
): Promise<CheckoutProcessResult> {
  const providerLabel = CHECKOUT_PROVIDER_LABELS[provider];

  // Reembolso/chargeback: atualiza a Order existente pelo id externo.
  if (event.kind === "refunded" || event.kind === "chargeback") {
    const status = event.kind === "refunded" ? "REFUNDED" : "CHARGEBACK";
    const updated = await prisma.order.updateMany({
      where: { workspaceId, provider, externalId: event.externalId },
      data: { status },
    });
    if (updated.count > 0) {
      await logEvent({
        workspaceId,
        actorType: "WEBHOOK",
        type: "order.refunded",
        entity: "Order",
        entityId: event.externalId,
        data: { provider, status, externalId: event.externalId },
        notify: ["notify"],
      });
    }
    return { status: 200, body: { ok: true, updated: updated.count } };
  }

  // Pagamento: idempotente por unique [workspaceId, provider, externalId].
  const product = await resolveProductOffer(workspaceId, provider, event.productExternalId);
  if (!product) {
    return { status: 200, body: { ok: false, ignored: true, reason: "workspace sem produto" } };
  }

  const lead = await findLeadForBuyer(workspaceId, event);
  const valueCents = event.valueCents ?? product.priceCents;
  const qty = Math.max(1, event.qty);

  let orderId: string;
  try {
    const order = await prisma.order.create({
      data: {
        workspaceId,
        leadId: lead?.id ?? null,
        productOfferId: product.id,
        valueCents,
        qty,
        channel: provider.toLowerCase(),
        source: "WEBHOOK",
        provider,
        externalId: event.externalId,
        status: "PAID",
        paidAt: new Date(),
      },
    });
    orderId = order.id;
  } catch (error) {
    // Conflito no unique = reentrega do provedor — responde 200 sem duplicar.
    // Checagem estrutural (não instanceof): com transpilePackages existem duas
    // cópias do runtime do Prisma e o instanceof falha entre elas.
    if (isPrismaUniqueViolation(error)) {
      return { status: 200, body: { ok: true, duplicated: true } };
    }
    throw error;
  }

  // AccessGrant exige lead — sem lead vinculado, a venda entra só no ROI.
  let grantId: string | null = null;
  if (lead) {
    const grant = await prisma.accessGrant.create({
      data: {
        workspaceId,
        orderId,
        leadId: lead.id,
        url: firstAccessLink(product.accessLinks),
        trackedToken: randomBytes(16).toString("hex"),
      },
    });
    grantId = grant.id;
  }

  await logEvent({
    workspaceId,
    actorType: "WEBHOOK",
    type: "order.paid",
    entity: "Order",
    entityId: orderId,
    data: {
      provider,
      providerLabel,
      externalId: event.externalId,
      valueCents,
      qty,
      leadId: lead?.id ?? null,
      buyerEmail: event.buyerEmail,
    },
    notify: ["notify"],
  });
  if (grantId) {
    await logEvent({
      workspaceId,
      actorType: "WEBHOOK",
      type: "access.granted",
      entity: "AccessGrant",
      entityId: grantId,
      data: { orderId, leadId: lead?.id ?? null },
    });
  }

  return { status: 200, body: { ok: true, orderId, leadLinked: Boolean(lead) } };
}
