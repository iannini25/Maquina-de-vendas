import { expect, test } from "@playwright/test";

/**
 * Fluxo 6 (parte pública): link rastreado /a/:token registra o acesso
 * e redireciona; heartbeat soma tempo ativo.
 */

const SEEDED_TOKEN = "demo-joao-a1b2c3d4";

test("link rastreado redireciona para a área de membros", async ({ request }) => {
  const response = await request.get(`/a/${SEEDED_TOKEN}`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers()["location"]).toContain("membros.liderancaia.com.br");
});

test("token inválido responde 404", async ({ request }) => {
  const response = await request.get("/a/token-que-nao-existe", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

test("heartbeat de uso responde ok e soma atividade", async ({ request }) => {
  const response = await request.post(`/api/usage/${SEEDED_TOKEN}`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { ok: boolean };
  expect(body.ok).toBe(true);
});

test("beacon.js serve o snippet com o token", async ({ request }) => {
  const response = await request.get(`/api/usage/${SEEDED_TOKEN}/beacon.js`);
  expect(response.ok()).toBeTruthy();
  const script = await response.text();
  expect(script).toContain(SEEDED_TOKEN);
  expect(script).toContain("sendBeacon");
});
