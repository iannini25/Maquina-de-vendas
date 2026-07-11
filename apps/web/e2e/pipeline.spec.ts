import { expect, test } from "@playwright/test";

/**
 * Fluxo 2 da spec: criar lead → aparece no Pipeline/Leads → mover estágio → toast
 * com o efeito do playbook.
 */

const LEAD_NAME = `E2E Teste ${Date.now()}`;
const LEAD_PHONE = `5511${String(Date.now()).slice(-9)}`;

test.describe.configure({ mode: "serial" });

test("criar lead pelo modal do Pipeline", async ({ page }) => {
  await page.goto("/pipeline", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /novo lead/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/nome/i).first().fill(LEAD_NAME);
  await dialog.getByLabel(/whatsapp/i).first().fill(LEAD_PHONE);
  await dialog.getByRole("button", { name: /adicionar lead/i }).click();

  await expect(page.getByText(LEAD_NAME).first()).toBeVisible({ timeout: 15_000 });
});

test("lead aparece no espelho Leads", async ({ page }) => {
  await page.goto("/leads", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(LEAD_NAME).first()).toBeVisible({ timeout: 15_000 });
});

test("mover estágio pelo Inbox dispara o toast do playbook", async ({ page }) => {
  // O drag HTML5 é instável em automação; o seletor de estágio do Inbox usa a
  // mesma action moveLeadStage — mesmo efeito, caminho clicável.
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });

  await page.getByText(LEAD_NAME).first().click();
  await page.getByRole("button", { name: /mover estágio/i }).click();
  await page.getByRole("button", { name: /em conversa/i }).first().click();

  await expect(
    page.getByText(/a ia agora vai|movido para/i).first(),
  ).toBeVisible({ timeout: 15_000 });
});
