# VendaFlow — Máquina de Vendas

CRM multi-tenant com SDR de IA operando 24/7 no WhatsApp: atenção → lead → conversa →
venda → relacionamento. Self-hosted (Docker) numa VPS.

**O que funciona de ponta a ponta:**

- **Pipeline = painel de controle da IA** — cada estágio tem playbook (objetivo, ações
  liberadas, critérios, cadência, autonomia); arrastar um lead muda o comportamento do
  SDR na hora (toast confirma o efeito)
- **SDR de IA no WhatsApp** — responde via Evolution API com RAG (pgvector + fallback
  full-text), guardrails com enforcement no código, opt-out "PARAR", handoff por
  palavra-gatilho, aprovações para ações sensíveis
- **Funil completo** — landing pages A/B por dispositivo (`/p/slug`) → captura → conversa
  → venda (pipeline "Ganho" ou webhooks Hotmart/Kiwify/Eduzz/Stripe) → acesso rastreado
  (`/a/token` + heartbeat) → pós-venda (nudge/NPS/upsell) → reativação
- **Setup Gate** — cada workspace pluga as próprias chaves; verificação real de cada
  credencial (QR do WhatsApp, tabela DNS do Resend, teste RW do S3); segredos
  criptografados com AES-256-GCM
- **ROI & Finanças** — despesas, vendas (manual + pipeline + webhooks assinados),
  KPIs (ROI/ROAS/CAC/ticket) e previsão (tendência 30d + pipeline ponderado)

## Stack

- **Monorepo**: pnpm + Turborepo, TypeScript estrito
- **apps/web**: Next.js 15 (App Router) — UI, API, landing pages públicas, webhooks, SSE
- **apps/worker**: Node + BullMQ — cadências, follow-ups, ingestão RAG, e-mails, jobs 24/7
- **packages/db**: Prisma + PostgreSQL 16 + pgvector
- **packages/core**: domínio puro (máquina de estados do funil, cadências, ROI)
- **packages/brain**: IA (model router, agente com ferramentas, RAG, guardrails)
- **packages/messaging**: providers de canal (Evolution API / WhatsApp)
- **packages/automation**: engine de flows/runs
- **packages/emails**: React Email + Resend
- **packages/ui**: design system portado do protótipo

## Rodando em dev

```bash
pnpm install
cp .env.example .env       # preencha AUTH_SECRET e APP_ENCRYPTION_KEY (pnpm gen:keys)
pnpm setup                 # sobe docker compose dev + migra + seeda
pnpm dev                   # web em http://localhost:3000
```

Login demo (com `SEED_DEMO=true`): `demo@vendaflow.local` / `demo1234`.

## Qualidade

```bash
pnpm verify   # typecheck + lint + unit + build + check de segredos (36 tasks)
pnpm e2e      # Playwright contra o app rodando (47 testes, 10 fluxos da spec)
```

Estado atual: 433 testes unitários + 47 E2E verdes, incluindo teste de vazamento
multi-tenant (9 cenários) e verificação de assinatura dos 4 webhooks de checkout.

## Deploy

Ver [docs/DEPLOY.md](docs/DEPLOY.md) e [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Protótipo

A UI de produção é porte fiel do protótipo navegável em
[docs/prototype/Sales4U.html](docs/prototype/Sales4U.html) — fonte da verdade visual.
