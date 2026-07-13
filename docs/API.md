# API — superfícies públicas do Sales4U

O painel usa Server Actions (não documentadas aqui). Esta página cobre as rotas
HTTP expostas: webhooks, páginas públicas e integrações.

## Saúde

| Rota | Método | Auth | Descrição |
| --- | --- | --- | --- |
| `/api/health` | GET | — | Saúde do web + banco (`{ok, service, db}`) |
| `:3001/health` (worker) | GET | — | Saúde do worker + filas (interno) |

## Tempo real

| Rota | Método | Auth | Descrição |
| --- | --- | --- | --- |
| `/api/sse` | GET | sessão | Stream SSE do workspace — eventos `inbox`, `pipeline`, `notify` |

## WhatsApp (Evolution)

| Rota | Método | Auth | Descrição |
| --- | --- | --- | --- |
| `/api/webhooks/evolution/{workspaceId}?secret=…` | POST | secret por workspace | Entrada de mensagens (`messages.upsert`). Dedupe por `externalId`; cria lead/conversa; aciona o SDR de IA quando a conversa está com o bot. |

A URL (com secret) é registrada automaticamente na instância ao verificar a
credencial no Setup Gate.

## Checkouts (vendas automáticas no ROI)

| Rota | Método | Verificação |
| --- | --- | --- |
| `/api/webhooks/checkout/hotmart/{workspaceId}` | POST | header `X-HOTMART-HOTTOK` |
| `/api/webhooks/checkout/kiwify/{workspaceId}` | POST | token |
| `/api/webhooks/checkout/eduzz/{workspaceId}` | POST | assinatura HMAC |
| `/api/webhooks/checkout/stripe/{workspaceId}` | POST | header `Stripe-Signature` (HMAC, tolerância 5 min) |

Efeito comum: cria `Order` (idempotente por transação externa), vincula lead por
e-mail/telefone, gera `AccessGrant` e dispara o pós-venda. Reembolso/chargeback
atualizam o status da venda.

## Monitor de uso do produto

| Rota | Método | Descrição |
| --- | --- | --- |
| `/a/{token}` | GET | Link rastreado de acesso — registra `LINK_OPENED` e redireciona para a área de membros |
| `/api/usage/{token}` | POST | Heartbeat de atividade (+60 s por batida; CORS aberto) |
| `/api/usage/{token}/beacon.js` | GET | Snippet pronto para embedar na plataforma do curso |

Snippet para a área de membros:

```html
<script src="https://app.SEUDOMINIO.com/api/usage/SEU_TOKEN/beacon.js"></script>
```

## LGPD / opt-out

| Rota | Método | Descrição |
| --- | --- | --- |
| `/api/optout?token=…` | GET | Descadastro de e-mail (token HMAC) — marca o lead e cancela automações |

No WhatsApp, a palavra **PARAR** tem o mesmo efeito, imediato.

## Landing pages públicas

| Rota | Método | Descrição |
| --- | --- | --- |
| `/p/{slug}` | GET | Página publicada (SSR) — variante por dispositivo + bucket A/B via cookie `vf-visitor`; registra `VIEW` |
| `/p/{slug}` (form) | POST (action) | Captura → cria lead + `SIGNUP`; rate-limited por IP |
