import { expect, test } from "@playwright/test";

/**
 * Fluxo 9 da spec: editar template → preview → teste de envio (Mailpit no dev).
 */

const MAILPIT_API = "http://localhost:8025/api/v1";

test("galeria mostra os templates seed", async ({ page }) => {
  await page.goto("/emails", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/confirmação de compra/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/entrega de acesso/i).first()).toBeVisible();
  await expect(page.getByText(/pesquisa nps/i).first()).toBeVisible();
});

test("editor renderiza preview e envia teste via Mailpit", async ({ page, request }) => {
  await page.goto("/emails", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByText(/confirmação de compra/i).first().click();

  // Editor com preview
  await expect(page.getByText(/estrutura|branding/i).first()).toBeVisible({ timeout: 15_000 });

  // Testar envio para o Mailpit
  const testAddress = `teste-${Date.now()}@e2e.local`;
  await page.getByRole("button", { name: /testar envio/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").first().fill(testAddress);
  await dialog.getByRole("button", { name: /enviar/i }).click();

  await expect(page.getByText(/enviado|sucesso/i).first()).toBeVisible({ timeout: 20_000 });

  // Confirma no Mailpit que o e-mail chegou
  await expect(async () => {
    const response = await request.get(`${MAILPIT_API}/messages?limit=10`);
    const body = (await response.json()) as { messages?: Array<{ To: Array<{ Address: string }> }> };
    const found = body.messages?.some((message) =>
      message.To.some((to) => to.Address === testAddress),
    );
    expect(found).toBe(true);
  }).toPass({ timeout: 20_000 });
});
