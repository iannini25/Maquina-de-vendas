# DECISIONS — registro de decisões técnicas

- **D001 · Fontes via npm (fontsource).** Space Grotesk existe em fonts-woff2/ mas só Bold/SemiBold;
  Plus Jakarta Sans não existe local. Uso `@fontsource-variable/space-grotesk` e
  `@fontsource-variable/plus-jakarta-sans` (self-hosted, pesos variáveis, offline no build).
- **D002 · Referências locais fora do git.** `_ref/`, `vendor/`, `fonts-woff2/`, `_archive/` são
  material de consulta (clones inteiros de libs) — gitignored. Componentes úteis são portados
  para `packages/ui` adaptados ao design system, nunca colados crus.
- **D003 · Monorepo raiz = este diretório.** O repo é d:\1MAQUINA-DE-VENDAS (sem subpasta
  maquina-de-vendas/) para evitar path duplo no Windows; a estrutura interna segue a spec.
