import { expect, test } from "@playwright/test";

/** Smoke: todas as telas principais renderizam sem erro e com o header certo. */

const SCREENS: Array<{ path: string; title: RegExp }> = [
  { path: "/dashboard", title: /dashboard/i },
  { path: "/pipeline", title: /pipeline/i },
  { path: "/leads", title: /leads/i },
  { path: "/inbox", title: /inbox/i },
  { path: "/campanhas", title: /campanhas/i },
  { path: "/pos-venda", title: /pós-venda/i },
  { path: "/landing-pages", title: /landing pages/i },
  { path: "/anuncios", title: /anúncios/i },
  { path: "/prospeccao", title: /prospecção/i },
  { path: "/emails", title: /templates de e-mail/i },
  { path: "/contexto", title: /contexto/i },
  { path: "/sdr", title: /sdr de ia/i },
  { path: "/financas", title: /roi & finanças/i },
  { path: "/criar", title: /criar com ia|o que vamos criar/i },
  { path: "/configuracoes", title: /configurações/i },
];

for (const screen of SCREENS) {
  test(`tela ${screen.path} renderiza`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(screen.path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: screen.title }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(pageErrors, `erros de runtime em ${screen.path}`).toEqual([]);
  });
}

test("busca global ⌘K encontra lead do seed", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder(/buscar leads, campanhas/i);
  await expect(input).toBeVisible();
  await input.fill("Marcos");
  await expect(page.getByText("Marcos Tavares").first()).toBeVisible({ timeout: 10_000 });
});
