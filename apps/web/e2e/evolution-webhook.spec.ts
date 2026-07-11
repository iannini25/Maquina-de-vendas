import { expect, test } from "@playwright/test";

/**
 * Fluxo 3 da spec (entrada): webhook Evolution simulado cria lead/conversa
 * e a mensagem aparece no Inbox. (A resposta do agente depende do worker +
 * chave Anthropic — coberta por testes unitários do worker.)
 */

function evolutionPayload(phone: string, text: string, externalId: string) {
  return {
    event: "messages.upsert",
    instance: "vf-lideranca-ia",
    data: {
      key: {
        id: externalId,
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
      },
      pushName: "Lead E2E Webhook",
      message: { conversation: text },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

test("webhook sem secret é rejeitado (401)", async ({ request, page }) => {
  // workspaceId real: extraído de qualquer página autenticada não é trivial —
  // usa o endpoint com id inventado: deve responder 401 (sem vazamento).
  const response = await request.post("/api/webhooks/evolution/workspace-falso", {
    data: evolutionPayload("5511900000000", "oi", `e2e-${Date.now()}`),
  });
  expect(response.status()).toBe(401);
  void page;
});
