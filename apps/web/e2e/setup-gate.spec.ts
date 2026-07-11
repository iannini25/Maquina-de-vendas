import { expect, test } from "@playwright/test";

/**
 * Fluxo 1 da spec: signup → Setup Gate trava o app → credenciais obrigatórias
 * controlam o [Liberar sistema]. (Sem chaves reais o gate DEVE bloquear —
 * comportamento honesto validado aqui; a liberação real acontece com chaves.)
 */

test.use({ storageState: { cookies: [], origins: [] } });

const STAMP = Date.now();

test("signup cria workspace e cai no Setup Gate travado", async ({ page }) => {
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await page.getByRole("textbox", { name: /seu nome/i }).fill("Usuário E2E");
  await page.getByRole("textbox", { name: /nome do negócio/i }).fill(`Negócio E2E ${STAMP}`);
  await page.getByRole("textbox", { name: /e-mail/i }).fill(`e2e-${STAMP}@teste.local`);
  await page.getByRole("textbox", { name: /senha/i }).fill("senha-e2e-12345");
  await page.getByRole("button", { name: /criar minha máquina/i }).click();

  // Novo workspace → setup incompleto → gate
  await page.waitForURL(/\/setup/, { timeout: 30_000 });
  await expect(page.getByText(/configuração inicial do ambiente/i).first()).toBeVisible();

  // Barra de progresso e cards obrigatórios visíveis
  await expect(page.getByText(/obrigatórios verificados/i).first()).toBeVisible();
  await expect(page.getByText(/anthropic|claude/i).first()).toBeVisible();
  await expect(page.getByText(/whatsapp|evolution/i).first()).toBeVisible();

  // Liberar sistema desabilitado sem credenciais verdes
  const release = page.getByRole("button", { name: /liberar sistema/i });
  await expect(release).toBeVisible();
  await expect(release).toBeDisabled();

  // Navegar para o app é bloqueado pelo middleware
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/setup/);
});

test("credencial inválida mostra estado de erro honesto", async ({ page }) => {
  // Loga com o usuário e2e recém-criado (mesmo storage vazio → login manual)
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByRole("textbox", { name: /e-mail/i }).fill(`e2e-${STAMP}@teste.local`);
  await page.getByRole("textbox", { name: /senha/i }).fill("senha-e2e-12345");
  await page.getByRole("button", { name: /^entrar/i }).click();
  await page.waitForURL(/\/setup/, { timeout: 30_000 });

  // Preenche uma chave Anthropic falsa e verifica — a API real responde 401
  const anthropicCard = page
    .locator("section, div")
    .filter({ hasText: /anthropic/i })
    .filter({ has: page.getByRole("button", { name: /verificar/i }) })
    .first();
  await anthropicCard.getByPlaceholder(/sk-ant/i).first().fill("sk-ant-chave-invalida-e2e");
  await anthropicCard.getByRole("button", { name: /^verificar$/i }).first().click();

  await expect(
    page.getByText(/api key inválida|falha|erro/i).first(),
  ).toBeVisible({ timeout: 30_000 });
});
