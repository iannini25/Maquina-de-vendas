import { expect, test } from "@playwright/test";

/**
 * Fluxo 6 da spec (via UI): mover lead para Ganho → Order + AccessGrant →
 * cliente aparece no Pós-venda.
 */

const LEAD_NAME = `Ganho E2E ${Date.now()}`;
const LEAD_PHONE = `5531${String(Date.now()).slice(-9)}`;

test.describe.configure({ mode: "serial" });

test("criar lead e mover para Ganho registra a venda", async ({ page }) => {
  // Cria o lead
  await page.goto("/pipeline", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /novo lead/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/nome/i).first().fill(LEAD_NAME);
  await dialog.getByLabel(/whatsapp/i).first().fill(LEAD_PHONE);
  await dialog.getByLabel(/valor/i).first().fill("1997").catch(() => null);
  await dialog.getByRole("button", { name: /adicionar lead/i }).click();
  await expect(page.getByText(LEAD_NAME).first()).toBeVisible({ timeout: 15_000 });

  // Move para Ganho pelo seletor do Inbox (mesma action do drag)
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByText(LEAD_NAME).first().click();
  await page.getByRole("button", { name: /mover estágio/i }).click();
  await page.getByRole("button", { name: /^ganho$/i }).first().click();

  await expect(page.getByText(/venda registrada|acesso e pós-venda/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("cliente aparece no Pós-venda com acesso emitido", async ({ page }) => {
  await page.goto("/pos-venda", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(LEAD_NAME).first()).toBeVisible({ timeout: 15_000 });

  // Acessos & uso mostra o novo cliente (nunca usou ainda)
  await page.getByRole("tab", { name: /acessos & uso/i }).click();
  await expect(page.getByText(LEAD_NAME).first()).toBeVisible({ timeout: 15_000 });
});

test("venda do Ganho entra no ROI", async ({ page }) => {
  await page.goto("/financas?tab=vendas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const vendasTab = page.getByRole("tab", { name: /^vendas$/i });
  if (await vendasTab.isVisible().catch(() => false)) await vendasTab.click();
  await expect(page.getByText(/pipeline \(ganho\)/i).first()).toBeVisible({ timeout: 15_000 });
});
