# PROGRESS — VendaFlow / Máquina de Vendas

> Checklist vivo. Atualizado a cada commit. Este arquivo + DECISIONS.md são a memória
> entre sessões — releia ambos ao retomar o trabalho.

## Fase 0 — Fundações
- [x] git init + branch main + remote origin
- [x] Protótipo movido para docs/prototype/
- [x] .gitignore (sem segredos, sem _ref/vendor/fonts brutos)
- [x] Monorepo pnpm + turbo (package.json, pnpm-workspace.yaml, turbo.json)
- [ ] Push inicial (validar credenciais git)
- [ ] docker-compose.dev.yml (postgres+pgvector, redis, minio, evolution, mailpit)
- [ ] packages/db — Prisma schema completo + primeira migration
- [ ] Auth.js v5 (credentials + bcrypt) + helper multi-tenant
- [ ] Tokens do design system no Tailwind v4
- [ ] Shell (sidebar/topbar) portado do protótipo
- [ ] scripts/gen-keys.mjs + scripts/check-secrets.mjs
- [ ] pnpm verify verde

## Fase 1 — Inventário e porte da UI
- [ ] Servir protótipo + Playwright → docs/UI-INVENTORY.md
- [ ] Portar todas as telas com mocks tipados

## Fase 2 — Setup Gate + Credenciais
## Fase 3 — CRM vivo
## Fase 4 — Mensageria + Agente
## Fase 5 — Automação
## Fase 6 — Aquisição
## Fase 7 — Venda → Pós-venda
## Fase 8 — Finanças + Prospecção
## Fase 9 — Deploy-ready
## Fase 10 — Revisão geral

## Pendências que só validam com chave real
- (nenhuma ainda)

## Notas de retomada
- Ambiente: Windows 11, node 22.18, pnpm 10.26.2, docker 29.1.3, git 2.52.
- Protótipo navegável: docs/prototype/Sales4U.html (fonte da verdade da UI).
- Referências locais (gitignored): _ref/ (react-bits, cult-ui, lightswind, shadcn-ui,
  shadergradient, watermelon), vendor/ (anime.js), fonts-woff2/ (Space Grotesk local).
