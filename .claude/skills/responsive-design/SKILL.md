---
name: responsive-design
description: Sistema de responsividade do estúdio. Use SEMPRE que a tarefa envolver mobile, tablet, breakpoints, media queries, container queries, "adaptar pro celular", "quebrar no mobile", "não fica bom no celular", layout que muda por tamanho de tela, ou quando qualquer página/componente for construído (responsividade não é passo final, é parte do build). Sabe reflowar (não encolher) cada tipo de seção no mobile — cards viram carrossel/lista/2-col em vez de blocos gigantes empilhados —, remover/degradar efeitos que não funcionam no toque (hover, parallax, pin, cursor custom, tilt, blur pesado), e acertar toque, dvh, safe-area, imagens e performance. O agente responsive-engineer executa. Dispare em: "responsivo", "responsividade", "mobile", "celular", "tablet", "breakpoint", "media query", "container query", "adaptar", "quebrar layout", "não fica bom no mobile".
---

# Responsividade — o sistema do estúdio

Mobile não é desktop encolhido. Responsividade boa é **reflow**: o conteúdo se
**reorganiza** para caber e ficar limpo, não só diminui de tamanho. A régua: no celular a
página tem que ficar **mais fácil de ler e mais bonita**, não uma pilha infinita de blocos.

> **O pecado nº 1 (o "trem de cards"):** pegar um grid de 3-4 cards e no mobile virar
> `grid-template-columns: 1fr` — cada card ocupa a tela inteira, um embaixo do outro, e o
> usuário rola 8 telas de cards gigantes. **Isso é banido por padrão.** Card no mobile vira
> **carrossel, lista compacta, 2 colunas ou accordion** (ver §3). Um card por tela só quando
> o card É o conteúdo (ex.: um depoimento por vez num carrossel).

---

## 0. Ordem de trabalho

1. **Mobile-first sempre.** Escreva o estilo-base para a tela pequena; use `min-width`
   para ADICIONAR complexidade em telas maiores. O caminho contrário (desktop com
   `max-width` desfazendo tudo) gera o "trem de cards" e overflow.
2. **Audite seção a seção.** Para cada bloco, pergunte: qual o padrão desktop? Qual a
   **forma certa** dele no mobile (§3)? Que efeitos precisam **morrer** no toque (§4)?
3. **Reflowe, degrade o motion, acerte o toque, teste.** Nunca entregue sem passar o
   checklist §10 em 360px de largura.

---

## 1. Breakpoints e estratégia

Breakpoints do kit (herdados de `design-taste-frontend`): **sm 640 · md 768 · lg 1024 ·
xl 1280 · 2xl 1536**. Regra prática de faixas: **≤ 640 = phone**, **641-1024 = tablet**,
**≥ 1025 = desktop**. Motion cinematográfico (pin, scroll-vídeo) desliga em **≤ 860**
(ver `scroll-cinematic`).

- **Container queries > media queries para COMPONENTES reutilizáveis.** Um card que aparece
  num grid largo E numa sidebar estreita deve reagir ao tamanho do CONTÊINER, não da tela:
  ```css
  .card-wrap { container-type: inline-size; }
  @container (min-width: 420px) { .card { grid-template-columns: auto 1fr; } }
  ```
  Media query fica para o LAYOUT da página (o esqueleto); container query para os pedaços.
- **Mobile-first em Tailwind:** classes sem prefixo = mobile; `md:` `lg:` sobem. Ex.:
  `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. Nunca `lg:grid-cols-1` desfazendo.
- **Nunca hardcode largura em px** em containers de layout — use `max-width` + `%`/`fr`/
  `minmax()`. Um `width: 1200px` fixo é overflow garantido no celular.

---

## 2. Unidades e fluidez (sem saltos)

- **Altura de viewport:** `100dvh` (dynamic) ou `100svh`/`100lvh`, **nunca `100vh`** — no
  iOS a barra de endereço quebra o `100vh` (corta ou sobra conteúdo). Herói: `min-height: 100dvh`.
- **`clamp()` para tudo que escala** (tipo, gap, padding de seção): interpola suave entre
  mobile e desktop, sem degraus bruscos no breakpoint. Ex.: `font-size: clamp(2rem, 6vw, 4.5rem)`,
  `padding-block: clamp(3rem, 10vw, 8rem)`.
- **`env(safe-area-inset-*)`** em barras fixas (nav topo, CTA sticky-bottom) para não ficar
  embaixo do notch / home indicator do iPhone: `padding-bottom: calc(1rem + env(safe-area-inset-bottom))`.
  Requer `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **`gap`** no lugar de margens para espaçar filhos de flex/grid — colapsa e reflowa sozinho.

---

## 3. O catálogo de transformações (o coração)

Para cada padrão de desktop, a forma limpa no mobile. **Nunca defaulte para "1 coluna de
blocos gigantes".** Código copiável em `reference/recipes.md`.

| Padrão no desktop | No mobile (≤ 640) faça… | Por quê |
|---|---|---|
| **Grid de 3-4 cards** (feature/serviço) | **2 colunas compactas** (card menor, ícone+título+1 linha) OU **carrossel scroll-snap** horizontal com "peek" do próximo OU **lista** (linha: ícone · título · seta) | 1-col de cards grandes = 8 telas de scroll. 2-col ou carrossel mostra muito numa tela. |
| **Bento assimétrico** | Card-herói full-width no topo, resto em **2 col**; use `order` para priorizar. Não vire tudo 1-col igual. | Mantém a hierarquia visual do bento, não achata tudo. |
| **Pricing 3 colunas** | **Carrossel** com o plano recomendado **primeiro/centralizado**, OU stack com o recomendado no topo e os outros condensados | Evita rolar 3 tabelas de preço gigantes; foca no plano-alvo. |
| **Hero split** (texto + imagem lado a lado) | **Stack**: texto centralizado em cima, imagem embaixo (ou vice-versa por prioridade), CTA **full-width** | Duas colunas de 50% ficam ilegíveis abaixo de 640. |
| **Tabela de dados** | Vira **cards `label: valor`** empilhados, OU **scroll-x** com 1ª coluna `position: sticky` | Tabela larga estoura a tela; nunca deixe overflow mudo. |
| **Nav horizontal** (links na barra) | **Hambúrguer → drawer/overlay** OU **bottom tab bar** (thumb-zone) | Links não cabem; toque precisa de alvo grande. |
| **Timeline / steps horizontais** | **Vertical** (linha à esquerda, marcos empilhados) | Passos horizontais viram scroll-x confuso. |
| **Stats em fileira** (4 números) | **Grid 2×2** | 4 números numa linha ficam minúsculos; 2×2 respira. |
| **Tabs (muitas)** | **Scroll-x com `scroll-snap`** (chips deslizáveis) OU vira `<select>` | Tabs quebram em várias linhas e viram bagunça. |
| **Sidebar** (app/dashboard) | **Drawer/Sheet** off-canvas com trigger; ou bottom-bar com as 4-5 ações principais | Sidebar fixa come metade da tela. |
| **Galeria / masonry** | **Carrossel scroll-snap** OU **2 col** | 1-col de imagens grandes = scroll infinito. |
| **Mega-menu** | **Accordion** dentro do drawer | Painel flutuante não existe no mobile. |
| **Grid de depoimentos** | **1 por vez em carrossel** (aqui 1-por-tela É certo — o card é o conteúdo) | Ler depoimentos empilhados cansa; carrossel convida. |
| **Footer multi-coluna** | **Accordion** (seções colapsáveis) OU **2 col** enxutas | 5 colunas viram 5 blocos altos empilhados. |
| **Logo marquee** | **Mantém** (marquee vai bem no mobile); reduza a velocidade ~20% | É um dos poucos efeitos que melhora no mobile. |
| **Formulário 2 col** | **1 coluna** (cada campo full-width) — aqui 1-col É certo | Campo lado a lado no toque erra o alvo. |

**Regras de reflow:**
- **Reordene com `order`/`grid-template-areas`**, não só empilhe na ordem do DOM. O que
  importa primeiro (herói, preço-alvo, CTA) sobe.
- **Carrossel mobile é `overflow-x: auto` + `scroll-snap-type: x mandatory`** (CSS puro,
  sem lib), com "peek" (`padding-inline`/largura < 100%) mostrando que há mais ao lado.
  **Nunca `pin` do GSAP no mobile** (a barra de endereço faz o pin pular) — ver §9.
- **Densidade:** no mobile o card encolhe de conteúdo também — corte descrição longa,
  deixe ícone + título + 1 linha; o detalhe abre no toque se precisar.

---

## 4. Efeitos: o que MATAR ou degradar no mobile

Efeito que depende de mouse ou de GPU forte estraga a experiência de toque. Desligue por
media query / `matchMedia` (nunca deixe rodando "de graça").

| Efeito | No mobile | Como |
|---|---|---|
| **`:hover`** (qualquer) | **Não existe no toque** — o hover "gruda" no primeiro tap | Envolva TODO hover em `@media (hover: hover) and (pointer: fine)`. Dê estado `:active` tátil (`transform: scale(.98)`) no lugar. |
| **Parallax / scroll-scrub** | Desliga → vira reveal simples ou estático | `gsap.matchMedia()` só ativa em `(min-width: 861px)`. |
| **Pin / scroll horizontal fixado** | **Nunca** no mobile | Vira `overflow-x:auto` + `scroll-snap`. |
| **Cursor custom** | **Off** | Só monta se `(pointer: fine)`. |
| **Botão magnético / tilt 3D / spotlight que segue o mouse** | **Off** (dependem de mouse) | Gate `(hover: hover) and (pointer: fine)`; no toque, botão comum com `:active`. |
| **`backdrop-blur` pesado / muitas sombras / filtros** | Reduzir | Blur menor ou sólido; sombra difusa única. Blur só em `fixed`/`sticky`. |
| **Scroll-vídeo em canvas** | Frames menores (9:16, 60-80) OU **poster estático** em aparelho fraco | `navigator.connection` / `matchMedia`; ver `scroll-cinematic`. |
| **Autoplay de vídeo pesado** | Poster estático; só toca se visível e não `save-data` | `IntersectionObserver` + `prefers-reduced-data`. |
| **Text-reveal char-a-char massivo** | Reduzir stagger ou trocar por fade simples | Menos elementos animando = menos jank. |
| **Rotações/overlaps/margens negativas** (Z-axis) | **Remover** no mobile | `md:rotate-0`, sem `margin-top: -2rem`; tudo alinhado. |
| **Qualquer motion acima do sutil** | Respeitar `prefers-reduced-motion` e reduzir | Loops/parallax colapsam para estático. |

**Sempre**: só anime `transform`/`opacity`; teste com o dedo, não com o mouse.

---

## 5. Toque e ergonomia

- **Alvo de toque ≥ 44×44px** (48px ideal), com **≥ 8px de espaço** entre alvos. Ícones-botão
  pequenos precisam de área de toque expandida (`padding` ou `::before` invisível).
- **Thumb-zone:** ações principais no terço inferior da tela. CTA primário pode virar
  **sticky-bottom full-width** no mobile (com `safe-area-inset-bottom`) — ótimo para conversão.
- **Inputs:** `font-size: 16px` mínimo (abaixo disso o iOS dá zoom automático e quebra o
  layout); use `type`/`inputmode` corretos (`email`, `tel`, `numeric`, `decimal`), `autocomplete`.
- **Nada de conteúdo só-no-hover** (tooltip, menu que abre no hover) sem alternativa por tap.
- **Zero overflow horizontal** — o "scroll fantasma" lateral. Envolva a página em
  `overflow-x: clip` e cace o culpado (elemento mais largo que a viewport, `100vw` dentro de
  container com padding, imagem sem `max-width`, grid que não colapsou).

---

## 6. Imagens e mídia

- **`srcset` + `sizes`** para servir a resolução certa (não baixe 2000px pra tela de 390px);
  `<picture>` para **art direction** (recorte diferente no mobile — ex.: retrato no celular,
  paisagem no desktop).
- **`aspect-ratio`** + `object-fit: cover` para reservar espaço e **evitar CLS** (o pulo de
  layout quando a imagem carrega). Sempre `width`/`height` ou `aspect-ratio`.
- **Forma da imagem tem que reflowar.** O tratamento de forma da imagem de conteúdo
  (clip-path/máscara/blob/sangria — regra "fuja da caixa", `CLAUDE.md` §4) precisa continuar
  bonito no mobile: simplifique recortes agressivos em telas estreitas (um arco/diagonal
  suave sobrevive; um hexágono apertado vira fatia ilegível). A imagem nunca pode perder o
  assunto por causa da forma.
- **`loading="lazy"`** abaixo da dobra; herói é `eager`/`fetchpriority=high`.
- Vídeo de fundo: `poster` sempre; no mobile prefira o poster e só carregue o vídeo se
  fizer sentido (dado/bateria).

---

## 7. Tipografia responsiva

- **`clamp()`** no display (ex.: `clamp(2.2rem, 7vw, 5rem)`) — nunca um `text-6xl` fixo que
  estoura a tela pequena.
- **Herói no mobile: máximo 2-3 linhas.** Reduza o tamanho até caber; headline de 5 linhas
  no celular é erro de escala. `text-wrap: balance` no título, `overflow-wrap: anywhere` /
  `hyphens: auto` para palavras longas não furarem a tela.
- **Medida de leitura:** corpo em `max-width: 65ch` no desktop vira **full-width com
  padding** no mobile. `line-height` ~1.5-1.6 no corpo.
- **Reduza tracking negativo** em telas pequenas (o `-0.04em` do display aperta demais em 360px).

---

## 8. Performance mobile (é parte de responsividade)

- Menos JS e menos motion no celular (rede/CPU/bateria menores). Carregue efeitos pesados
  condicionalmente (`matchMedia`, `navigator.connection.saveData`, `prefers-reduced-data`).
- **`content-visibility: auto`** em seções longas abaixo da dobra (pula render do que não
  está na tela).
- Evite reflow por scroll listener; use `IntersectionObserver` / `ScrollTrigger`.
- Alvo Core Web Vitals no 4G: **LCP < 2.5s**, **INP < 200ms**, **CLS < 0.1**.

---

## 9. Coordenação com motion (nunca brigar)

Responsividade **decide o que o motion faz por faixa de tela**; ela não reescreve a
animação. Divisão:
- **Scroll cinematográfico** (pin, scroll-vídeo, parallax) → o `scroll-director` /
  `scroll-cinematic` já usa `gsap.matchMedia()`; a regra de responsividade é: **no mobile
  não há pin nem parallax** — vira reveal simples ou estático.
- **Micro-interações por código** (`anime-motion`) → hovers/tilt/magnético só em
  `(hover: hover) and (pointer: fine)`.
- **Nunca dois motores no mesmo elemento** (regra do kit) continua valendo. Você ajusta as
  **media queries / matchMedia**, não mete um segundo motor.

---

## 10. QA mobile (passar antes de entregar)

- [ ] Testado em **360px** de largura (o menor comum) e 390/414; e em **landscape**.
- [ ] **Zero overflow horizontal** (sem scroll lateral fantasma) em nenhuma seção.
- [ ] **Nenhum "trem de card"**: seções de cards viram carrossel/2-col/lista/accordion, não
      1-col de blocos gigantes (exceto quando o card É o conteúdo).
- [ ] Alturas com `100dvh`/`svh`, nunca `100vh`; barras fixas respeitam `safe-area-inset`.
- [ ] Alvos de toque ≥ 44px, espaçados; CTA alcançável com o polegar.
- [ ] Inputs `≥16px`, com `type`/`inputmode` corretos; sem zoom automático no foco.
- [ ] Todo `:hover` está atrás de `(hover: hover) and (pointer: fine)`; há estado `:active`.
- [ ] Parallax/pin/cursor/tilt/magnético **desligados** no mobile; motion respeita `prefers-reduced-motion`.
- [ ] Imagens com `srcset`/`aspect-ratio` (sem CLS); herói legível, 2-3 linhas.
- [ ] Nav vira drawer/bottom-bar e funciona; menu fecha ao navegar.
- [ ] Teclado aberto não quebra o layout (campos e botão continuam acessíveis).
- [ ] Só `transform`/`opacity` animam; `backdrop-blur` só em fixed/sticky.

---

## 11. Regras duras (bans)

- **Trem de card** (grid vira 1-col de blocos full-width empilhados) — banido por padrão.
- **`100vh`** em seção de altura cheia — use `dvh`/`svh`.
- **`:hover` sem `@media (hover: hover)`** — gruda no toque.
- **Overflow horizontal** — nunca. Página em `overflow-x: clip`.
- **Pin/parallax/scroll-scrub no mobile.**
- **Input com `font-size < 16px`** (zoom iOS).
- **Largura fixa em px** em container de layout.
- **Alvo de toque < 44px.**
- Esconder conteúdo essencial só porque é mobile (**responsivo reorganiza, não amputa** o
  que importa).

> Código copiável de cada transformação e cada remoção de efeito: `reference/recipes.md`.
> O agente **responsive-engineer** aplica tudo isto sobre uma página construída.
