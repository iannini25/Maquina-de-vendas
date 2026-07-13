"use server";

import { createHmac } from "node:crypto";

import type { Prisma } from "@sales4u/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/events";
import { parseBRLToCents } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";
import { getCredentialData } from "@/server/credentials/service";

import type { CheckoutProvider } from "./checkout-verify";
import { stripeSignatureV1 } from "./checkout-verify";
import { readCheckoutMappings } from "./checkout";

/** Server Actions do módulo ROI & Finanças. */

export interface FinanceActionResult {
  ok: boolean;
  error?: string;
}

/**
 * parseBRLToCents trata "1.997" (sem vírgula) como decimal. Para valores
 * digitados com pontos de milhar e sem centavos ("R$ 8.200"), remove os
 * pontos antes de converter.
 */
function parseMoneyToCents(raw: string): number | null {
  const trimmed = raw.trim();
  const thousandsOnly = /^[^\d,]*\d{1,3}(\.\d{3})+[^\d,]*$/;
  const normalized = thousandsOnly.test(trimmed) ? trimmed.replace(/\./g, "") : trimmed;
  return parseBRLToCents(normalized);
}

const categorySchema = z.enum([
  "PAID_TRAFFIC",
  "SOFTWARE",
  "CREATIVE",
  "TOOLS",
  "TEAM",
  "OTHER",
]);

const expenseSchema = z.object({
  category: categorySchema,
  valueRaw: z.string().trim().min(1, "Informe o valor"),
  description: z.string().trim().min(2, "Descreva a despesa").max(300),
  paidBy: z.string().trim().max(120).optional(),
  /** Valor de <input type="date"> (YYYY-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  campaignId: z.string().nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

interface ParsedExpense {
  category: z.infer<typeof categorySchema>;
  valueCents: number;
  description: string;
  paidBy: string | null;
  date: Date;
  campaignId: string | null;
}

function parseExpense(
  input: ExpenseInput,
): { ok: true; data: ParsedExpense } | { ok: false; error: string } {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const valueCents = parseMoneyToCents(parsed.data.valueRaw);
  if (valueCents === null || valueCents <= 0) {
    return { ok: false, error: "Valor inválido — use o formato R$ 1.234,56" };
  }
  const date = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Data inválida" };
  return {
    ok: true,
    data: {
      category: parsed.data.category,
      valueCents,
      description: parsed.data.description,
      paidBy: parsed.data.paidBy?.trim() ? parsed.data.paidBy.trim() : null,
      date,
      campaignId: parsed.data.campaignId ?? null,
    },
  };
}

export async function createExpense(input: ExpenseInput): Promise<FinanceActionResult> {
  const ctx = await requireWorkspace();
  const parsed = parseExpense(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  if (parsed.data.campaignId) {
    const campaign = await ctx.db.campaign.findUnique({
      where: { id: parsed.data.campaignId },
      select: { id: true },
    });
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };
  }

  const expense = await ctx.db.expense.create({
    data: { workspaceId: ctx.workspaceId, ...parsed.data },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "expense.created",
    entity: "Expense",
    entityId: expense.id,
    data: { category: parsed.data.category, valueCents: parsed.data.valueCents },
  });

  revalidatePath("/financas");
  return { ok: true };
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseInput,
): Promise<FinanceActionResult> {
  const ctx = await requireWorkspace();
  const id = z.string().min(1).safeParse(expenseId);
  if (!id.success) return { ok: false, error: "Despesa inválida" };
  const parsed = parseExpense(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const existing = await ctx.db.expense.findUnique({
    where: { id: id.data },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Despesa não encontrada" };

  if (parsed.data.campaignId) {
    const campaign = await ctx.db.campaign.findUnique({
      where: { id: parsed.data.campaignId },
      select: { id: true },
    });
    if (!campaign) return { ok: false, error: "Campanha não encontrada" };
  }

  await ctx.db.expense.update({ where: { id: id.data }, data: parsed.data });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "expense.updated",
    entity: "Expense",
    entityId: id.data,
    data: { category: parsed.data.category, valueCents: parsed.data.valueCents },
  });

  revalidatePath("/financas");
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<FinanceActionResult> {
  const ctx = await requireWorkspace();
  const id = z.string().min(1).safeParse(expenseId);
  if (!id.success) return { ok: false, error: "Despesa inválida" };

  const existing = await ctx.db.expense.findUnique({
    where: { id: id.data },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Despesa não encontrada" };

  await ctx.db.expense.delete({ where: { id: id.data } });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "expense.deleted",
    entity: "Expense",
    entityId: id.data,
  });

  revalidatePath("/financas");
  return { ok: true };
}

const orderSchema = z.object({
  productOfferId: z.string().min(1, "Escolha um produto"),
  valueRaw: z.string().trim().min(1, "Informe o valor"),
  qty: z.number().int().min(1, "Qtd mínima: 1").max(999),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  /** Canal/origem do lançamento manual (rótulo do protótipo). */
  channel: z.enum(["manual", "pipeline", "checkout"]),
});

export type ManualOrderInput = z.infer<typeof orderSchema>;

/** "Lançar venda" — registro manual (source MANUAL; lead opcional fica de fora do modal). */
export async function createManualOrder(input: ManualOrderInput): Promise<FinanceActionResult> {
  const ctx = await requireWorkspace();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const valueCents = parseMoneyToCents(parsed.data.valueRaw);
  if (valueCents === null || valueCents <= 0) {
    return { ok: false, error: "Valor inválido — use o formato R$ 1.997,00" };
  }
  const paidAt = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(paidAt.getTime())) return { ok: false, error: "Data inválida" };

  const product = await ctx.db.productOffer.findUnique({
    where: { id: parsed.data.productOfferId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Produto não encontrado" };

  const order = await ctx.db.order.create({
    data: {
      workspaceId: ctx.workspaceId,
      productOfferId: product.id,
      valueCents,
      qty: parsed.data.qty,
      channel: parsed.data.channel,
      source: "MANUAL",
      status: "PAID",
      paidAt,
    },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "order.created",
    entity: "Order",
    entityId: order.id,
    data: { valueCents, qty: parsed.data.qty, channel: parsed.data.channel },
    notify: ["notify"],
  });

  revalidatePath("/financas");
  return { ok: true };
}

const providerSchema = z.enum(["HOTMART", "KIWIFY", "EDUZZ", "STRIPE"]);

const mappingsSchema = z
  .array(
    z.object({
      externalId: z.string().trim().min(1).max(120),
      productOfferId: z.string().min(1),
    }),
  )
  .max(50);

/** Persiste o mapeamento produto externo ↔ ProductOffer em Workspace.settings.checkoutMappings. */
export async function saveCheckoutMappings(
  provider: string,
  entries: Array<{ externalId: string; productOfferId: string }>,
): Promise<FinanceActionResult> {
  const ctx = await requireWorkspace();
  const parsedProvider = providerSchema.safeParse(provider);
  if (!parsedProvider.success) return { ok: false, error: "Provedor inválido" };
  const parsedEntries = mappingsSchema.safeParse(entries);
  if (!parsedEntries.success) return { ok: false, error: "Mapeamento inválido" };

  // Todos os produtos precisam existir neste workspace.
  const offerIds = [...new Set(parsedEntries.data.map((e) => e.productOfferId))];
  if (offerIds.length > 0) {
    const found = await ctx.db.productOffer.count({ where: { id: { in: offerIds } } });
    if (found !== offerIds.length) return { ok: false, error: "Produto não encontrado" };
  }

  const workspace = await ctx.db.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { settings: true },
  });
  if (!workspace) return { ok: false, error: "Workspace não encontrado" };

  const settings =
    workspace.settings && typeof workspace.settings === "object" && !Array.isArray(workspace.settings)
      ? (workspace.settings as Record<string, unknown>)
      : {};
  const current = readCheckoutMappings(settings);
  current[parsedProvider.data] = Object.fromEntries(
    parsedEntries.data.map((entry) => [entry.externalId, entry.productOfferId]),
  );

  await ctx.db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { settings: { ...settings, checkoutMappings: current } as Prisma.InputJsonValue },
  });

  await logEvent({
    workspaceId: ctx.workspaceId,
    actorType: "USER",
    actorId: ctx.userId,
    type: "checkout.mapping.updated",
    entity: "Workspace",
    entityId: ctx.workspaceId,
    data: { provider: parsedProvider.data, entries: parsedEntries.data.length },
  });

  revalidatePath("/financas");
  return { ok: true };
}

export interface TestWebhookResult extends FinanceActionResult {
  httpStatus?: number;
  detail?: string;
}

/** Id externo fixo do teste — criado e removido na mesma ação (não polui o ROI). */
const TEST_EXTERNAL_ID = "TESTE-SALES4U";

function testPayloadFor(provider: CheckoutProvider): Record<string, unknown> {
  switch (provider) {
    case "HOTMART":
      return {
        event: "PURCHASE_APPROVED",
        data: {
          product: { id: 0, name: "Teste Sales4U" },
          buyer: { name: "Compra de teste", email: "teste@sales4u.local" },
          purchase: { transaction: TEST_EXTERNAL_ID, price: { value: 1 } },
        },
      };
    case "KIWIFY":
      return {
        order_id: TEST_EXTERNAL_ID,
        order_status: "paid",
        Product: { product_id: "teste" },
        Customer: { full_name: "Compra de teste", email: "teste@sales4u.local" },
        Commissions: { charge_amount: 100 },
      };
    case "EDUZZ":
      return {
        event: "myeduzz.invoice_paid",
        data: {
          id: TEST_EXTERNAL_ID,
          buyer: { name: "Compra de teste", email: "teste@sales4u.local" },
          items: [{ productId: "teste" }],
          paid: { value: 1 },
        },
      };
    case "STRIPE":
      return {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_sales4u",
            payment_intent: TEST_EXTERNAL_ID,
            amount_total: 100,
            customer_details: { name: "Compra de teste", email: "teste@sales4u.local" },
            metadata: { product_id: "teste" },
          },
        },
      };
  }
}

/**
 * "Testar" — envia um payload de exemplo assinado com a credencial salva para o
 * próprio endpoint do webhook e mostra o resultado. O pedido de teste criado é
 * removido em seguida.
 */
export async function testCheckoutWebhook(provider: string): Promise<TestWebhookResult> {
  const ctx = await requireWorkspace();
  const parsedProvider = providerSchema.safeParse(provider);
  if (!parsedProvider.success) return { ok: false, error: "Provedor inválido" };
  const p = parsedProvider.data;

  const credential = await getCredentialData(ctx.workspaceId, p);
  const secret = p === "STRIPE" ? credential?.webhookSecret : credential?.webhookToken;
  if (!secret) {
    return { ok: false, error: "Salve e verifique o segredo do webhook antes de testar." };
  }

  const payload = testPayloadFor(p);
  const rawBody = JSON.stringify(payload);
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  let url = `${baseUrl}/api/webhooks/checkout/${p.toLowerCase()}/${ctx.workspaceId}`;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (p === "HOTMART") headers["x-hotmart-hottok"] = secret;
  if (p === "KIWIFY") url += `?token=${encodeURIComponent(secret)}`;
  if (p === "EDUZZ") {
    headers["x-signature"] = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  }
  if (p === "STRIPE") {
    const timestamp = String(Math.floor(Date.now() / 1000));
    headers["stripe-signature"] = `t=${timestamp},v1=${stripeSignatureV1(rawBody, timestamp, secret)}`;
  }

  let httpStatus: number;
  let detail: string;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(15_000),
    });
    httpStatus = response.status;
    detail = (await response.text()).slice(0, 300);
  } catch {
    return {
      ok: false,
      error: "Não consegui chamar o endpoint. Confira o APP_URL do servidor.",
    };
  }

  // Limpa o pedido de teste (idempotência garante no máximo um).
  await ctx.db.order.deleteMany({
    where: { provider: p, externalId: TEST_EXTERNAL_ID },
  });

  revalidatePath("/financas");

  if (httpStatus === 200) {
    return {
      ok: true,
      httpStatus,
      detail,
    };
  }
  return {
    ok: false,
    httpStatus,
    detail,
    error:
      httpStatus === 401
        ? "O endpoint recusou a assinatura (401). Confira o segredo salvo."
        : `O endpoint respondeu ${httpStatus}.`,
  };
}
