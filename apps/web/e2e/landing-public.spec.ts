import { expect, test } from "@playwright/test";

/**
 * Fluxo 4 da spec: landing publicada, variante por dispositivo (A/B),
 * eventos e visual público.
 */

test("landing pública renderiza a variante certa por dispositivo", async ({
  page,
  isMobile,
}) => {
  await page.goto("/p/ia-na-lideranca", { waitUntil: "domcontentloaded" });

  if (isMobile) {
    // Variante B tem deviceTarget MOBILE — determinística no celular.
    await expect(
      page.getByText(/5 horas por semana de volta na sua agenda/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  } else {
    // No desktop só a variante A (ANY) entra no pool.
    await expect(page.getByText(/seu time usa ia/i).first()).toBeVisible({
      timeout: 15_000,
    });
  }
});

test("visitante mantém a mesma variante entre visitas (sticky bucket)", async ({ page }) => {
  await page.goto("/p/ia-na-lideranca", { waitUntil: "domcontentloaded" });
  const first = await page.locator("h1").first().textContent();
  await page.reload({ waitUntil: "domcontentloaded" });
  const second = await page.locator("h1").first().textContent();
  expect(second).toBe(first);
});

test("landing inexistente responde 404", async ({ page }) => {
  const response = await page.goto("/p/nao-existe-xyz", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
});

test("form de captura cria lead no CRM", async ({ page, isMobile }) => {
  test.skip(isMobile, "variante mobile do seed não tem form de captura");

  const name = `Captura E2E ${Date.now()}`;
  await page.goto("/p/ia-na-lideranca", { waitUntil: "domcontentloaded" });

  await page.getByPlaceholder(/seu nome/i).fill(name);
  await page.getByPlaceholder(/whatsapp/i).fill(`5511${String(Date.now()).slice(-9)}`);
  await page.getByRole("button", { name: /quero me inscrever|inscrever|garantir/i }).click();

  // Página de obrigado / confirmação
  await expect(
    page.getByText(/obrigado|recebemos|te chama|whatsapp/i).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Lead aparece no espelho (sessão autenticada)
  await page.goto("/leads", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
});
