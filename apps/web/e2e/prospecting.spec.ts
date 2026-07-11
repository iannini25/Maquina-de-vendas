import { expect, test } from "@playwright/test";

/**
 * Fluxo 8 da spec: prospecção — fontes com estado honesto do Vibe,
 * prospects listados e geração de abordagem sem chave = estado honesto.
 */

test("fontes mostram estado honesto do Vibe (desconectado sem chave)", async ({ page }) => {
  await page.goto("/prospeccao", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/vibe prospecting/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/desconectado|conectar/i).first()).toBeVisible();
});

test("leads não contatados listam prospects do seed", async ({ page }) => {
  await page.goto("/prospeccao", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("tab", { name: /não contatados/i }).click();
  await expect(page.getByText(/fernanda rocha/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/tiago nunes/i).first()).toBeVisible();
});

test("gerar abordagem sem chave Anthropic mostra estado honesto", async ({ page }) => {
  await page.goto("/prospeccao", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("tab", { name: /não contatados/i }).click();
  await expect(page.getByText(/fernanda rocha/i).first()).toBeVisible({ timeout: 15_000 });

  // Seleciona a primeira linha e tenta gerar
  const firstCheckbox = page.locator('input[type="checkbox"]').nth(1);
  if (await firstCheckbox.isVisible().catch(() => false)) {
    await firstCheckbox.check();
  }
  await page.getByRole("button", { name: /gerar abordagem/i }).first().click();

  await expect(
    page.getByText(/configure sua chave|anthropic|configurações/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});
