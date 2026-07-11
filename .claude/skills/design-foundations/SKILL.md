---
name: design-foundations
description: Fundamentos de design visual do estúdio, destilados dos mestres que criaram a lógica do design moderno (Vignelli, Müller-Brockmann, Paul Rand, Saul Bass, Milton Glaser, Paula Scher, Alexandre Wollner, Aloisio Magalhães) e conectados ao estado do web design atual. Use SEMPRE antes de definir layout, grid, sistema de espaçamento, escala tipográfica, tokens, hierarquia visual, logo/símbolo, elemento-assinatura, ou quando decidir entre estilos e tendências (bento, brutalism, tipografia como herói, dark mode, glassmorphism, 3D). É a camada do PORQUÊ, carregada pelo design-director antes das skills de execução (high-end-visual-design, gpt-taste, minimalist-ui, industrial-brutalist-ui). Dispare em: "grid", "hierarquia", "tokens", "escala", "tipografia", "layout", "composição", "identidade", "logo", "assinatura", "atemporal", "tendência", "fundamentos", "por que esse design".
---

# Design dos mestres — o fundamento de decisão visual

O kit já tem a camada de execução (componentes, efeitos, bans) e a de referência (74
marcas). Esta é a camada de **fundamento**: a lógica que permite decidir bem em situação
nova, em vez de só aplicar regra decorada. A régua de tudo: **um site que aplica efeitos
não é um site que tem composição.** O agente `design-director` carrega esta skill ANTES das
skills de estilo.

---

## As 4 decisões (nesta ordem, antes de qualquer pixel)

1. **SEMÂNTICA: qual é a ideia?** (Vignelli + Rand + Bass) O que este negócio SIGNIFICA e
   qual é a única ideia visual que carrega isso? Sem ideia, o design é arbitrário: decoração.
   A ideia vira o elemento-assinatura do kit.
2. **SISTEMA: qual é a estrutura?** (Müller-Brockmann + Vignelli) Grid, escala de espaçamento,
   escala tipográfica, tokens. O sistema decide ANTES; as telas obedecem. Ordem transmite
   credibilidade antes de qualquer palavra ser lida.
3. **HIERARQUIA: o que se lê primeiro, segundo, terceiro?** (Scher + Vignelli) Em cada dobra,
   o olho precisa de um caminho único e inequívoco. Tipografia é arquitetura, não enfeite.
4. **REDUÇÃO: o que sai?** (Bass + Rand) Depois de compor, subtrair até restar o essencial que
   ainda carrega o máximo de significado. Simplicidade é subproduto de uma boa ideia, não
   objetivo estético.

---

## As 12 leis do design do estúdio (síntese dos mestres)

1. **Busque o significado antes da forma** (Vignelli, semântica). Pesquise a empresa, o
   mercado, a concorrência e o público antes de desenhar. Design sem semântica é arbitrário.
2. **O grid é atitude mental, não gaiola** (Müller-Brockmann). Informação organizada é lida
   mais rápido, entendida melhor e retida por mais tempo; a ordem em si gera confiança.
   Estrutura estável é o que torna a variação significativa.
3. **A ideia primeiro; o logo só identifica** (Rand). Um logo não vende nem descreve:
   identifica. O significado vem por associação com a qualidade do negócio ao longo do tempo.
4. **Simbolize e sintetize** (Bass). Reduza a essência a uma frase visual simples que evoca a
   história inteira. Se é "simples simples", é chato: o alvo é o simples que faz pensar.
5. **Ver e entender são o mesmo ato** (Glaser). O leitor precisa captar a ideia no primeiro
   olhar; a ponte entre ver e compreender é onde o design acontece.
6. **Sério, não solene** (Scher). Domine as regras o suficiente para quebrá-las no momento
   exato. Solene segue tudo e é esquecível; sério arrisca com o lastro de décadas de padrão.
7. **Tipografia é imagem e arquitetura** (Scher + Müller-Brockmann). Letra tem massa, presença
   e escala. Em 2026, tipografia é a própria interface: ela pode SER o herói.
8. **Poucas famílias, disciplina total** (Vignelli). Duas famílias bem usadas superam cinco
   justificadas. Contenção é o que faz o display característico brilhar.
9. **Atemporal na base, tendência como acento** (Vignelli + estado 2026). Construa sobre um
   estilo duradouro (suíço, minimal, editorial, brutalista) e use tendências como acentos
   removíveis. Site que é só tendência envelhece em 18 meses.
10. **Uma solução com racional, não um leque de opções** (Rand). Apresente A resposta com a
    história do porquê (o padrão NeXT). Quem mostra dez ideias enfraquece todas.
11. **Sistema total, não peça avulsa** (Wollner). A identidade vale quando o MESMO critério
    governa tudo: site, Maps, redes, materiais. É o que nenhum concorrente local faz.
12. **Modernidade nasce do contexto, não da importação** (Aloisio). A base cultural local é
    matéria-prima do design moderno. A cidade, o nome, a história do negócio carregam a semântica.

---

## Diagnóstico visual (responda por escrito antes do layout)

1. Qual é a **ideia em uma frase**? (Se não existe, volte à pesquisa: semântica.)
2. Qual é o **sistema**: grid de quantas colunas, escala de espaçamento, escala tipográfica,
   tokens de cor? (Máximo 3 cores estruturais + neutros.)
3. Quais **2 famílias tipográficas** e por quê? (Display com caráter + corpo legível; mono
   opcional. Nunca mais que 3.)
4. Qual é o **estilo-base duradouro** e quais **acentos de tendência** (removíveis)?
5. O que foi **reduzido** na última passada? (Se nada saiu, não houve redução.)

---

## Roteamento: qual referência ler para cada decisão

| Decisão / tarefa | Leia |
|---|---|
| Tokens, tipografia, atemporalidade, disciplina (o Cânone) | `reference/vignelli-canon.md` |
| Grid, espaçamento, bento, ritmo, whitespace | `reference/grid-suico.md` |
| Ideia, logo, elemento-assinatura, apresentar ao cliente | `reference/rand-ideia.md` |
| Herói como abertura, motion com significado | `reference/bass-simbolo-movimento.md` |
| Herói tipográfico, theming, identidade viva, o desvio "sério" | `reference/glaser-scher-tipo.md` |
| Sistema total do cliente local, semântica da cidade/nome | `reference/escola-brasileira.md` |
| Fundamento → tendência 2026 + **checklist de decisão visual** | `reference/ponte-2026.md` |

---

## Como esta skill conversa com as outras (mapa de sinergia)

| Fundamento daqui | Skill de execução que ele governa |
|---|---|
| Semântica/ideia (Vignelli, Rand) | design-director (elemento-assinatura), brandkit, stitch-design-taste |
| Grid/sistema (Müller-Brockmann) | gpt-taste (bento denso), minimalist-ui, ui-ux-pro-max |
| Tipo como imagem (Scher) | fonts-system + FONTES.md (display de caráter) |
| Símbolo e movimento (Bass) | scroll-cinematic, animejs/anime-motion |
| Sério, não solene (Scher) | o desvio único por página em QUALQUER skill de estilo |
| Sistema total (Wollner) | brandkit + proposta comercial (site + Maps + redes) |
| Ponte 2026 | component-libraries (o que adotar), redesign-existing-projects |

> **Fronteira honesta.** O conteúdo vem de fontes verificadas (o *Vignelli Canon* do próprio
> Vignelli, o *Grid Systems* do Müller-Brockmann, os ensaios e o teste de 7 critérios do Rand,
> entrevistas do Bass, o TED da Scher, a Enciclopédia Itaú Cultural e acervos sobre
> Wollner/Aloisio, e levantamentos de 2026 sobre o estado do web design). As "aplicações web
> diretas" nas referências são tradução dos princípios para o contexto do kit, não citação.
> Nenhum número inventado; os cases são reais e verificáveis.
