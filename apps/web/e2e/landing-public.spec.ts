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
