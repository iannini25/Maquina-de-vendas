import { NextResponse } from "next/server";

import { logEvent } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCredentialData } from "@/server/credentials/service";
import {
  parseCheckoutEvent,
  providerFromSlug,
  verifyEduzzSignature,
  verifyHotmartToken,
  verifyKiwifyToken,
  verifyStripeSignature,
  type CheckoutProvider,
} from "@/server/finance/checkout-verify";
import { processCheckoutEvent } from "@/server/finance/checkout";

export const dynamic = "force-dynamic";

/**
 * Webhook público de checkout: /api/webhooks/checkout/{provider}/{workspaceId}.
 * Valida a assinatura do provedor (Hotmart hottok · Kiwify token · Eduzz HMAC ·
 * Stripe t=/v1=), normaliza o evento e registra a venda no ROI.
 */

async function rejectSignature(
  workspaceId: string,
  provider: CheckoutProvider,
  reason: string,
): Promise<NextResponse> {
  await logEvent({
    workspaceId,
    actorType: "WEBHOOK",
    type: "webhook.rejected",
    entity: "WebhookEndpoint",
    entityId: provider,
    data: { provider, reason },
  });
  return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; workspaceId: string }> },
) {
  const { provider: slug, workspaceId } = await params;

  const provider = providerFromSlug(slug);
  if (!provider) {
    return NextResponse.json({ error: "provedor desconhecido" }, { status: 404 });
  }

  const limit = await rateLimit(
    `webhook:checkout:${workspaceId}`,
    RATE_LIMITS.webhook.max,
    RATE_LIMITS.webhook.windowSeconds,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // Corpo cru primeiro: Eduzz/Stripe assinam os bytes exatos do payload.
  const rawBody = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const credential = await getCredentialData(workspaceId, provider);
  const secret =
    provider === "STRIPE" ? credential?.webhookSecret : credential?.webhookToken;
  if (!secret) {
    return rejectSignature(workspaceId, provider, "credencial ausente ou não verificada");
  }

  let valid = false;
  if (provider === "HOTMART") {
    valid = verifyHotmartToken(request.headers.get("x-hotmart-hottok"), secret);
  } else if (provider === "KIWIFY") {
    const queryToken = new URL(request.url).searchParams.get("token");
    const bodyToken =
      body && typeof body === "object" && "token" in body && typeof body.token === "string"
        ? body.token
        : null;
    valid = verifyKiwifyToken(queryToken ?? bodyToken, secret);
  } else if (provider === "EDUZZ") {
    valid = verifyEduzzSignature(rawBody, request.headers.get("x-signature"), secret);
  } else {
    valid = verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret);
  }
  if (!valid) {
    return rejectSignature(workspaceId, provider, "assinatura inválida");
  }

  const event = parseCheckoutEvent(provider, body);
  if (!event) {
    // Evento válido mas fora do escopo (ex.: boleto gerado) — 200 rápido.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await processCheckoutEvent(workspaceId, provider, event);
  return NextResponse.json(result.body, { status: result.status });
}
