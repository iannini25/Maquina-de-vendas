---
name: awesome-design-md
description: Pack de 74 DESIGN.md de marcas reais (Apple, Stripe, Linear, Vercel, Ferrari, Nike, Framer, Notion, Tesla, SpaceX, Spotify…) com tokens, tipografia, cores e regras de cada linguagem visual. Use SEMPRE que o brief citar uma marca como referência ("estilo Stripe", "vibe Apple", "parecido com Linear"), quando o design-director precisar de uma linguagem de partida, ou quando o usuário pedir "faça uma página na linguagem da marca X". Dispare em qualquer menção a "DESIGN.md", "linguagem de marca", "referência de marca", ou nome de marca conhecida como direção visual.
---

# awesome-design-md — Pack de linguagens de marca

74 pastas em `design-md/<marca>/`, cada uma com um `DESIGN.md` descrevendo a linguagem
visual real da marca: paleta com tokens, tipografia, espaçamento, raio, sombras, tom de
voz e regras de composição. Fonte: repo VoltAgent/awesome-design-md (vendorado).

## Como usar

1. **Escolha a marca pela vibe do brief** (lista completa: `ls design-md/`):
   - Carros/luxo: `ferrari` `lamborghini` `bugatti` `bmw` `bmw-m` `tesla` `renault`
   - Dev tools/infra: `vercel` `supabase` `sentry` `posthog` `clickhouse` `mongodb` `hashicorp` `warp` `cursor` `expo` `webflow` `resend` `sanity` `mintlify` `replicate` `composio` `opencode.ai`
   - IA: `claude` `cohere` `elevenlabs` `minimax` `mistral.ai` `runwayml` `x.ai` `together.ai` `ollama` `voltagent`
   - Fintech: `stripe` `binance` `coinbase` `kraken` `revolut` `wise` `mastercard`
   - Consumer/produto: `apple` `airbnb` `nike` `starbucks` `spotify` `playstation` `meta` `pinterest` `uber` `figma` `framer` `notion` `linear.app` `raycast` `superhuman` `lovable` `cal` `airtable` `slack` `intercom` `clay` `miro`
   - Editorial/mídia: `theverge` `wired` · Retrô: `dell-1996` `nintendo-2001` `hp` `ibm`
   - Outras: `nvidia` `vodafone` `shopify` `spacex`

2. **Copie o `DESIGN.md` da marca para a raiz do projeto** (ou leia direto daqui) e
   trate-o como o design system de partida: tokens, fontes e regras dele guiam o build.

3. **Adapte, nunca imite 1:1.** A linguagem é ponto de partida: troque conteúdo, marca
   e assets pelo contexto do projeto. Não use logotipos/nomes da marca de referência
   no produto final salvo pedido explícito.

## Regras

- Combine com UMA skill de estilo do kit (ver `SISTEMA.md`) — o DESIGN.md dá a
  linguagem, a skill dá a técnica e o rigor anti-genérico.
- As regras duras do kit continuam valendo (ícones de uma fonte só, nada de
  Inter/Roboto como display, motion só transform/opacity).
- Para gerar um DESIGN.md próprio do zero, use a skill `stitch-design-taste`.
