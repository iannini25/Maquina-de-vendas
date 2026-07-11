import { expect, test } from "@playwright/test";

/**
 * Fluxo 10 da spec: upload de contexto texto → job de ingestão no worker →
 * status Indexado ao vivo. (Worker precisa estar rodando.)
 */

test("adicionar contexto texto → indexado pelo worker", async ({ page }) => {
  // O nome do arquivo é derivado da primeira linha do conteúdo.
  const title = `FAQ E2E ${Date.now()}`;
  const content = `${title}\nPergunta: o curso tem certificado? Resposta: sim, certificado de 40 horas.\nPergunta: quanto tempo de acesso? Resposta: 12 meses de área de membros.`;

  await page.goto("/contexto", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /adicionar contexto/i }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/conteúdo/i).fill(content);
  await dialog.getByRole("button", { name: /salvar e indexar/i }).click();

  // Arquivo aparece na tabela com o nome derivado da primeira linha
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });

  // Worker processa: Pendente/Processando → Indexado (fallback full-text sem Voyage)
  await expect(async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    const row = page.locator("tr", { hasText: title });
    await expect(row.getByText(/indexado/i)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000, intervals: [3_000] });
});
