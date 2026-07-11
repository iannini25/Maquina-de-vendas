# DECISIONS — registro de decisões técnicas

- **D001 · Fontes via npm (fontsource).** Space Grotesk existe em fonts-woff2/ mas só Bold/SemiBold;
  Plus Jakarta Sans não existe local. Uso `@fontsource-variable/space-grotesk` e
  `@fontsource-variable/plus-jakarta-sans` (self-hosted, pesos variáveis, offline no build).
- **D002 · Referências locais fora do git.** `_ref/`, `vendor/`, `fonts-woff2/`, `_archive/` são
  material de consulta (clones inteiros de libs) — gitignored. Componentes úteis são portados
  para `packages/ui` adaptados ao design system, nunca colados crus.
- **D003 · Monorepo raiz = este diretório.** O repo é d:\1MAQUINA-DE-VENDAS (sem subpasta
  maquina-de-vendas/) para evitar path duplo no Windows; a estrutura interna segue a spec.
- **D004 · Portas dev remapeadas.** 5432/5433/6379/6380/8080/3001 estão ocupadas por outros
  projetos nesta máquina (tribex, betv). Dev usa: postgres 5434, redis 6381, evolution 8081,
  worker health 3005. Produção (VPS) usa portas padrão internas na rede Docker.
- **D005 · Setup Gate via cookie espelho.** O middleware roda no edge (sem Prisma); o estado
  do SetupState é espelhado no cookie httpOnly `vf-setup-done`, gravado no login e revalidado
  a cada mutação do setup. Fonte da verdade continua sendo o banco.
- **D006 · Multi-tenant enforcement no client Prisma.** `tenantDb(workspaceId)` ($extends)
  injeta filtro em leituras/mutações em massa, valida dono em mutações por id (custo: 1 query
  extra) e carimba workspaceId em creates; modelos-filhos guardados pela relação com o pai.
- **D007 · E-mail sem SDK do Resend.** Envio via fetch direto na API (menos deps); dev usa
  Mailpit por SMTP (nodemailer).
