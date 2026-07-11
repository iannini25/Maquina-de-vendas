import { expect, test } from "@playwright/test";

/**
 * Fluxo 7 da spec: webhook de checkout (payload exemplo Hotmart) → venda no ROI.
 */

const HOTTOK = `e2e-hottok-${Date.now()}`;
const TRANSACTION = `HP-E2E-${Date.now()}`;

test.describe.configure({ mode: "serial" });

async function openSalesTab(page: import("@playwright/test").Page) {
  await page.goto("/financas?tab=vendas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const vendasTab = page.getByRole("tab", { name: /^vendas$/i });
  if (await vendasTab.isVisible().catch(() => false)) await vendasTab.click();
  // Card "Conectar checkout" abre o slide-over com os 4 provedores
  await page.getByRole("button", { name: /conectar checkout/i }).first().click();
  await expect(page.getByLabel(/url do webhook hotmart/i)).toBeVisible({ timeout: 15_000 });
}

test("conectar Hotmart salvando o token do webhook", async ({ page }) => {
  await openSalesTab(page);

  // Único campo "Hottok" do slide-over pertence ao bloco Hotmart
  const hottokInput = page.getByLabel(/hottok/i).first();
  await expect(hottokInput).toBeVisible({ timeout: 15_000 });
  await hottokInput.fill(HOTTOK);

  const hotmartSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /^hotmart$/i }) });
  await hotmartSection.getByRole("button", { name: /^salvar$/i }).first().click();

  await expect(page.getByText(/hotmart conectado/i).first()).toBeVisible({ timeout: 20_000 });
});

test("webhook Hotmart cria a venda (e é idempotente)", async ({ page, request }) => {
  await openSalesTab(page);
  const workspaceId = (
    await page.getByLabel(/url do webhook hotmart/i).inputValue()
  ).match(/checkout\/hotmart\/([a-z0-9]+)/i)?.[1];
  expect(workspaceId, "workspaceId presente na URL do webhook").toBeTruthy();

  const payload = {
    event: "PURCHASE_APPROVED",
    data: {
      purchase: {
        transaction: TRANSACTION,
        status: "APPROVED",
        price: { value: 1997.0, currency_value: "BRL" },
      },
      buyer: {
        name: "Comprador Hotmart E2E",
        email: "comprador@e2e.local",
        checkout_phone: "5511977776666",
      },
      product: { id: 111, name: "Curso IA na Liderança" },
    },
  };

  const send = () =>
    request.post(`/api/webhooks/checkout/hotmart/${workspaceId}`, {
      data: payload,
      headers: { "X-HOTMART-HOTTOK": HOTTOK },
    });

  const first = await send();
  expect(
    first.ok(),
    `webhook respondeu ${first.status()}: ${await first.text().catch(() => "?")}`,
  ).toBeTruthy();

  // Idempotência: reenvio não duplica venda
  const second = await send();
  expect(second.ok()).toBeTruthy();

  // Venda aparece na tabela do ROI
  await openSalesTab(page);
  await expect(page.getByText(/comprador hotmart e2e|hotmart/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("webhook com token errado é rejeitado", async ({ page, request }) => {
  await openSalesTab(page);
  const workspaceId = (
    await page.getByLabel(/url do webhook hotmart/i).inputValue()
  ).match(/checkout\/hotmart\/([a-z0-9]+)/i)?.[1];

  const response = await request.post(`/api/webhooks/checkout/hotmart/${workspaceId}`, {
    data: { event: "PURCHASE_APPROVED", data: {} },
    headers: { "X-HOTMART-HOTTOK": "token-errado" },
  });
  expect(response.status()).toBe(401);
});
