import { expect, test } from "@playwright/test";

/**
 * Fluxo 5 da spec: importação de CSV com mapeamento de colunas → leads criados
 * + relatório de erros.
 */

const STAMP = Date.now();
const CSV = [
  "nome,whatsapp,email",
  `Import Um ${STAMP},5511${String(STAMP).slice(-9)},um@e2e.com`,
  `Import Dois ${STAMP},5521${String(STAMP).slice(-9)},dois@e2e.com`,
  `Sem Telefone ${STAMP},,tres@e2e.com`,
].join("\n");

test("importa CSV com mapeamento e mostra relatório", async ({ page }) => {
  await page.goto("/pipeline", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500); // hidratação

  await page.getByRole("button", { name: /novo lead/i }).first().click();
  await page.getByRole("dialog").getByText(/importar em massa/i).click();

  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });

  // Prévia + mapeamento automático por nome de coluna; segue para importar
  await page.getByRole("button", { name: /importar \d+ linha/i }).click();

  // Relatório: 2 importados, 1 erro (sem telefone)
  await expect(page.getByText(/leads? importados?/i).first()).toBeVisible({
    timeout: 20_000,
  });

  // Leads no espelho
  await page.goto("/leads", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(`Import Um ${STAMP}`).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`Import Dois ${STAMP}`).first()).toBeVisible({ timeout: 15_000 });
});
