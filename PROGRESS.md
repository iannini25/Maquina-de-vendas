# PROGRESS — VendaFlow / Máquina de Vendas

> Checklist vivo. Atualizado a cada commit. Este arquivo + DECISIONS.md são a memória
> entre sessões — releia ambos ao retomar o trabalho.

## Fase 0 — Fundações
- [x] git init + branch main + remote origin
- [x] Protótipo movido para docs/prototype/
- [x] .gitignore (sem segredos, sem _ref/vendor/fonts brutos)
- [x] Monorepo pnpm + turbo (package.json, pnpm-workspace.yaml, turbo.json)
- [x] Push inicial (credenciais git OK)
- [x] docker-compose.dev.yml (postgres+pgvector:5434, redis:6381, minio:9000, evolution:8081, mailpit:8025 — portas remapeadas por conflito com outros projetos da máquina)
- [x] packages/db — Prisma schema completo + migration init + tenantDb (regra de ouro) + crypto AES-GCM + testes
- [x] packages/core — máquina de estados, cadência, ROI/previsão, markdown configs, variantes de landing, filas/canais (42 testes verdes)
- [x] Auth.js v5 (credentials + bcrypt, split edge-safe p/ middleware) + requireWorkspace/tenantDb
- [x] Tokens do design system no Tailwind v4 (globals.css @theme)
- [x] Shell inicial (sidebar/topbar) — refinar na Fase 1 com o inventário
- [x] Seed demo completo (workspace Liderança IA, 10 leads c/ conversas, campanhas, landing 2 variantes, despesas, 2 vendas, 8 templates e-mail, contexto, prospecção)
- [x] scripts/gen-keys.mjs + scripts/check-secrets.mjs
- [ ] pnpm verify verde (aguarda pacotes paralelos: messaging/emails/automation/brain/worker)
- [ ] Inventário UI (agente rodando) → docs/UI-INVENTORY.md

## Fase 1 — Inventário e porte da UI
- [x] docs/UI-INVENTORY.md completo (18 telas, 24 abas, 9 modais, 101 screenshots)
- [x] Kit de componentes do design system (apps/web/src/components/ui/*)
- [x] Shell fiel (sidebar 4 grupos + card usuário + PageHeader contextual)
- [x] Onda 1 portada com dados reais: Dashboard, Pipeline (drag FLIP + efeitos), Leads,
      Inbox (SSE + assumir/devolver), Campanhas (+detalhe 5 abas), Pós-venda,
      Landing Pages (editor blocos + variantes + /p/[slug] público), Anúncios
- [ ] Onda 2 em andamento: Prospecção, Templates E-mail, Contexto, SDR, Finanças,
      Criar com IA, Setup Gate UI, Configurações, restyle Login/Signup

## Fase 2 — Setup Gate + Credenciais
- [x] Backend completo: criptografia, verificadores reais (Anthropic/Voyage/Evolution
      c/ QR/Resend c/ DNS/S3 RW/DNS domínio), computeSetupStatus, releaseSystem
- [x] Registro automático do webhook Evolution na instância ao verificar credencial
- [ ] UI do /setup e /configuracoes (agente da onda 2)

## Fase 3 — CRM vivo
- [x] Pipeline drag real + moveLeadStage (computeStageChange + efeitos WON) + toast
- [x] Novo lead + import CSV + espelho Leads + lead-detail slide-over + EventLog + SSE

## Fase 4 — Mensageria + Agente
- [x] Webhook Evolution inbound (dedupe, lead/conversa, SSE, aciona agente)
- [x] agent-reply completo no worker: loop de ferramentas + enforcement + classifier
      + RAG + opt-out PARAR + handoff keywords + typing delay + rate limit
- [x] RAG: ingestão (PDF via unpdf, chunking, embeddings Voyage, pgvector) + fallback full-text
- [x] Inbox UI com envio real (fila outbound), sugestão da IA, nova conversa

## Fase 5 — Automação
- [x] Motor de runs no worker (advance/expand, sleep_until, branch por resposta)
- [x] ensureStageAutomation (flow default da cadência do playbook)
- [x] Aprovações (DRAFT/SEMI → Approval) + pausa por handoff/opt-out
- [ ] Telas do SDR ligadas (onda 2)

## Fase 6 — Aquisição
- [x] Landing builder + variantes A/B + página pública + eventos + captura
- [x] Campanhas (incl. Lançamento/Live com lembretes agendados no worker)
- [x] Anúncios (gerador Grande Ideia + swipe vault + biblioteca)
- [ ] Criar com IA studio (onda 2)

## Fase 7 — Venda → Pós-venda
- [x] Ganho → Order → AccessGrant → /a/[token] + heartbeat + beacon.js
- [x] Worker: classificação diária NEVER/IDLE/ACTIVE + nudges + NPS + upsell c/ janela
- [ ] Templates de E-mail UI + opt-out (onda 2)

## Fase 8 — Finanças + Prospecção — (onda 2 em andamento)
## Fase 9 — Deploy-ready
- [x] compose.prod + Caddyfile + Dockerfiles + setup-vps.sh + backup.sh
- [x] docs/DEPLOY.md + docs/RUNBOOK.md + docs/API.md
- [ ] README final + smoke test do compose.prod local

## Fase 10 — Revisão geral ✅ CONCLUÍDA
- [x] Teste de vazamento multi-tenant (9 cenários verdes)
- [x] Suíte E2E completa: 47/48 verdes (1 skip por design) — 10 fluxos da spec cobertos
- [x] Varredura botão-a-botão: 221 controles em 15 telas → 0 botões mortos, 0 erros de console
- [x] Auditoria de segurança (seção 8): multi-tenant sem furos (61 usos auditados), segredos
      mascarados/criptografados, webhooks assinados, anti-injection, LGPD — tudo verde;
      achado médio (login sem rate limit) CORRIGIDO + hardening extra (POST fallback no login,
      timing-safe no secret Evolution, validação de variantId no A/B)
- [x] Fidelidade visual tela a tela vs protótipo: FIEL (correções: BRL sem centavos,
      segmented com preenchimento roxo)
- [x] Smoke test compose.prod: 7 serviços healthy, TLS Caddy ok, migrations automáticas
- [x] Bugs reais achados e corrigidos pelos E2E: nomes de jobs de fila divergentes (contexto/
      studio/cobrar), P2002 instanceof entre cópias do Prisma, captura de landing perdida
      pré-hidratação, .dockerignore ausente, healthcheck IPv6

## STATUS FINAL: Definition of Done atendida (exceto validações que exigem chaves reais).
Deploy aguardando IP + acesso SSH + domínio da VPS.

## Pendências que só validam com chave real
- Resposta real do agente no WhatsApp (precisa ANTHROPIC + Evolution pareada)
- Embeddings Voyage (sem chave usa fallback full-text — funcional)
- Envio real de e-mail via Resend (dev usa Mailpit)
- Busca Explorium/Vibe (sem chave mostra estado honesto)
- Geração de criativos Higgsfield (CTA de configurar)

## Notas de retomada
- Ambiente: Windows 11, node 22.18, pnpm 10.26.2, docker 29.1.3, git 2.52.
- Protótipo navegável: docs/prototype/Sales4U.html (fonte da verdade da UI).
- Referências locais (gitignored): _ref/ (react-bits, cult-ui, lightswind, shadcn-ui,
  shadergradient, watermelon), vendor/ (anime.js), fonts-woff2/ (Space Grotesk local).
