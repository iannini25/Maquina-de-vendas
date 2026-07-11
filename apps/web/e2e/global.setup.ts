import { expect, test as setup } from "@playwright/test";

/**
 * Autentica com o usuário demo do seed e persiste o storage state
 * usado por todos os specs.
 */
setup("autenticar usuário demo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /e-mail/i }).fill("demo@vendaflow.local");
  await page.getByRole("textbox", { name: /senha/i }).fill("demo1234");
  await page.getByRole("button", { name: /^entrar/i }).click();

  await expect(page).toHaveURL(/dashboard|setup/, { timeout: 15_000 });

  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
