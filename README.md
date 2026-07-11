# VendaFlow — Máquina de Vendas

CRM multi-tenant com SDR de IA operando 24/7 no WhatsApp: atenção → lead → conversa →
venda → relacionamento. Self-hosted (Docker) numa VPS.

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
pnpm verify   # typecheck + lint + unit + build + check de segredos
pnpm e2e      # Playwright contra o app rodando
```

## Deploy

Ver [docs/DEPLOY.md](docs/DEPLOY.md) e [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Protótipo

A UI de produção é porte fiel do protótipo navegável em
[docs/prototype/Sales4U.html](docs/prototype/Sales4U.html) — fonte da verdade visual.
