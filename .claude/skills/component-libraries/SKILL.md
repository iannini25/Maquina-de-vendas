---
name: component-libraries
description: Catálogo de bancos de componentes open-source de alto nível (React Bits, Cult UI, Lightswind, ShaderGradient, shadcn/ui, Watermelon) indexado por CASO DE USO. Use SEMPRE que precisar de um componente/efeito pronto de qualidade — fundo de herói animado/WebGL, efeito de texto, card premium, navbar/dock, botão com efeito, efeito de scroll, elemento 3D, cursor customizado, galeria/carrossel, loader, bento, bloco de seção (hero/pricing/cta/faq/testimonials). Diz QUAL biblioteca tem o componente, o NOME real do componente, o COMANDO real de instalação (CLI copy-paste, não import de lib) e as pegadinhas de cada uma. Censo verificado (contado no filesystem em 02/07/2026) em reference/censo-verificado-2026-07.md. Regra dura: PUXAR o componente e ADAPTAR ao design system do projeto (cor, conteúdo, tipografia, motion) — nunca colar cru. Complementa scroll-cinematic (scroll/GSAP), ui-ux-pro-max (paletas/fontes) e as skills de taste (direção). Dispare em: "componente", "banco de componentes", "react bits", "cult ui", "lightswind", "shadergradient", "shadcn", "watermelon", "bloco de seção", "fundo de herói", "background animado", "efeito de texto", "card 3d", "efeito de scroll", "cursor", "gradiente webgl".
---

# component-libraries — Bancos de componentes (catálogo real)

Índice curado das melhores bibliotecas **open-source** de componentes, mapeado por
**caso de uso**. Todos os nomes aqui são **reais** (verificados nos repositórios). São
bibliotecas **copy-paste / CLI** (estilo shadcn): você instala o componente **no seu
projeto** e o edita — não importa de um pacote fechado.

> **Regra de ouro:** puxe o componente e **adapte ao design system do projeto** — cor,
> conteúdo, tipografia, densidade e motion. Nunca cole cru. O componente é um ponto de
> partida de alta qualidade, não o produto final. A direção estética manda (ver as skills
> de taste + `SISTEMA.md`); o componente se dobra ao projeto, não o contrário.

Para clonar os repos e estudar o código-fonte localmente: `prompts/03-catalogar-componentes-externos.md`.

---

## 1. As bibliotecas (o que são + como instalar — comandos reais)

| Lib | Natureza (censo 02/07/2026) | Instalação (real) | Melhor para |
|---|---|---|---|
| **shadcn/ui** | **61** primitivos + **30** blocks + charts + 16 estilos (a base) | `npx shadcn@latest add <componente>` | Fundação: button, dialog, form, table, tabs, sidebar, sonner, command… |
| **Watermelon** | **514** variantes de UI base (30 categorias) + **131** animated + **22** categorias de blocks + 2 dashboards | `npx shadcn@latest add https://registry.watermelon.sh/r/<nome>.json` · clone `_ref/watermelon/src/data/contents/` | **A maior em variantes de UI base e micro-interações.** Blocks de seção (hero/cta/pricing/faq/testimonials…), inputs/tabs/select em dezenas de variantes, animated components de produto/fintech. |
| **React Bits** | **134** (45 Backgrounds, 36 Components, 30 Animations, 23 TextAnimations) | shadcn **ou** jsrepo (copy-paste). Doc: `reactbits.dev/get-started/installation` | Fundos, efeitos de texto, cards, cursores, galerias. O mais rico em "efeito". ⚠️ licença Commons Clause (ver pegadinhas). |
| **Cult UI** | **82** componentes com caráter (registro shadcn) | `npx shadcn@latest add https://cult-ui.com/r/<nome>.json` (ex.: `texture-card.json`) | Cards texturizados, botões premium, heros WebGL, family drawer/button, floating panel. |
| **Lightswind** | **204** componentes, forte em **3D/WebGL/scroll** | `npx lightswind@latest init` → `npx lightswind@latest add <nome>` | 3D, backgrounds shader, efeitos de scroll, cursores, loaders. Preenche o buraco de 3D. |
| **ShaderGradient** | pacote + **10 presets** (WebGL, R3F) | `npm i shadergradient @react-three/fiber three` | Fundo de herói com gradiente 3D animado, específico e lindo. |

> **Censo completo (todos os nomes, por categoria) + comandos de re-verificação:**
> `reference/censo-verificado-2026-07.md` — cada repo clonado e **contado no filesystem** em
> 02/07/2026. Caminhos locais dos clones: `_ref/react-bits` · `_ref/cult-ui` · `_ref/shadcn-ui`
> · `_ref/lightswind` · `_ref/shadergradient` · `_ref/watermelon` (+ `_ref/galaxy` do Uiverse,
> se clonado). Os totais mudam com o tempo; recontar leva segundos com os comandos do censo.

**Pegadinhas reais (documentadas pelas próprias libs):**
- **React Bits: licença MIT + Commons Clause.** Pode usar os componentes DENTRO de projetos
  entregues a clientes (uso pretendido pela comunidade), mas **não** revenda como "seu pack/
  biblioteca" de componentes e mantenha a atribuição. Cult UI, Lightswind, shadcn, Watermelon,
  ShaderGradient são MIT puro. (Resumo do texto da licença, não aconselhamento jurídico.)
- **Lightswind** e **React Bits** são **copy-paste**: NÃO envolva num Provider nem importe
  como pacote — use a CLI para instalar o arquivo no projeto e edite direto.
- **ShaderGradient** exige `three` + `@react-three/fiber` (é R3F). Pesado — use só no herói,
  com fallback estático no mobile (ver `scroll-cinematic` §6).
- Muitos backgrounds WebGL (React Bits `Aurora/Plasma/LiquidEther`, Lightswind `aurora-shader`,
  ShaderGradient) custam GPU. **Um por página**, `pointer-events:none`, e degrade no mobile.
- **shadcn** é a base; React Bits e Cult UI assumem que você já tem o setup shadcn/Tailwind.

---

## 2. Índice por CASO DE USO (nomes reais)

Escolha pelo efeito que quer. `[RB]`=React Bits · `[Cult]`=Cult UI · `[LSW]`=Lightswind ·
`[SG]`=ShaderGradient · `[WM]`=Watermelon · `[shadcn]`=shadcn/ui. Watermelon e shadcn têm
listas grandes por categoria — nomes completos no censo (`reference/censo-verificado-2026-07.md`).

### Fundo de herói — animado / WebGL (o "momento" visual)
- **[RB]** Aurora · DarkVeil · Silk · Threads · Waves · Plasma · PlasmaWave · Iridescence ·
  LiquidChrome · LiquidEther · GradientBlinds · Galaxy · Hyperspeed · Balatro · Prism ·
  PrismaticBurst · Orb · Ballpit · Dither · Particles · Beams · Lightning · LightRays · Grainient
- **[Cult]** hero-liquid-metal · hero-dithering · hero-color-panel · hero-heatmap ·
  hero-static-radial-gradient · bg-animated-gradient · bg-animated-fractal-dot-grid ·
  canvas-fractal-grid · bg-media · bg-image-texture
- **[LSW]** aurora-shader · aurora-background · nebula-flow · cosmic-dust · plasma-globe ·
  shader-background · smokey-background · gradient-background · ether-waves-background ·
  liquid-fluid · satin-flow · rays-background · reflect-background · quantum-field
- **[SG]** o gradiente shader (`@shadergradient/react`) — configurável, cinematográfico

### Fundo sutil — grid / dots / textura (institucional, sem exagero)
- **[RB]** DotGrid · DotField · GridMotion · GridDistortion · RippleGrid · ShapeGrid · LineWaves · SoftAurora
- **[Cult]** stripe-bg-guides · grid-beam · texture-overlay
- **[LSW]** dot-grid-background · dot-pattern · grid-dot-backgrounds · interactive-grid-background · stripes-background · meteors · border-beam

### Efeitos de texto (hero e destaques)
- **[RB]** SplitText · BlurText · ScrambledText · DecryptedText · GradientText · ShinyText ·
  TextPressure · VariableProximity · RotatingText · TextType · ScrollReveal · ScrollVelocity ·
  ScrollFloat · TrueFocus · CircularText · CurvedLoop · CountUp · GlitchText · FuzzyText · Shuffle · FallingText
- **[Cult]** gradient-heading · text-animate · typewriter · type-animate · pixel-heading-word · pixel-heading-character
- **[LSW]** aurora-text-effect · shiny-text · typing-text · video-text · looping-words · rolling-text-3d · text-scroll-marquee

> Nota: para text-reveal **amarrado ao scroll**, prefira a skill `scroll-cinematic` (SplitText
> do GSAP, agora grátis) quando quiser controle fino; use os componentes acima para efeitos "prontos".

### Cards (feature, produto, portfólio)
- **[RB]** SpotlightCard · TiltedCard · PixelCard · ProfileCard · DecayCard · ReflectiveCard ·
  ChromaGrid · MagicBento · BounceCards · CardSwap · ScrollStack
- **[Cult]** minimal-card · texture-card · cutout-card · shift-card · expandable-card ·
  feature-carousel · morph-surface
- **[LSW]** magic-card · glowing-cards · interactive-card · interactive-gradient-card ·
  orbit-card · 3D-Perspective-Card · glass-folder · seasonal-hover-cards · cool-bento-effect

### Bento grids
- **[RB]** MagicBento · Masonry
- **[LSW]** bento-grid · cool-bento-effect
- (para layout bento denso sem buraco, ver skill `gpt-taste` §4)

### Navegação (navbar, dock, tabs, menus)
- **[RB]** Dock · GooeyNav · PillNav · CardNav · StaggeredMenu · FlowingMenu · BubbleMenu
- **[Cult]** dock · floating-panel · direction-aware-tabs · toolbar-expandable · side-panel · dynamic-island
- **[LSW]** dynamic-navigation · morphing-navigation · marquee-menu · sparkle-navbar ·
  hamburger-menu-overlay · dock · dynamic-island · top-sticky-bar

### Botões (com efeito)
- **[Cult]** cosmic-button · glow-button · metal-button · texture-button · neumorph-button ·
  gradient-button-group · border-beam-button · bg-animate-button · family-button
- **[LSW]** fluid-button · glitch-button · holo-button · magnetic-button · ripple-button ·
  shine-button · stardust-button · gradient-button · electro-border · slide-to-confirm ·
  animated-copy-button · confetti-button
- **[RB]** StarBorder (borda animada) · ClickSpark (feedback de clique)

### Efeitos de scroll (complementa a skill scroll-cinematic)
- **[RB]** ScrollStack · ScrollFloat · ScrollReveal · ScrollVelocity · AnimatedContent
- **[LSW]** CinematicScroll · scroll-stack · scroll-timeline · scroll-trigger-carousel ·
  3d-scroll-trigger · infinite-webgl-scroll · scroll-cards · scroll-carousel · scroll-para-3d ·
  ScrollSnapCarouselPin · ScrollVelocityContainer
- Para scroll-vídeo (frames em canvas), pin e parallax do zero → skill **scroll-cinematic**.

### 3D / WebGL (preenche o buraco de 3D do kit)
- **[LSW]** 3d-carousel · 3d-hover-gallery · 3d-image-carousel · 3d-image-gallery · 3d-image-ring ·
  3d-image-slider · 3d-marquee · 3d-model-viewer · 3d-perspective-cards · 3d-slider ·
  globe · plasma-globe · ThreeDImageCarousel
- **[RB]** ModelViewer (GLB/GLTF) · FluidGlass · Lanyard · Ballpit · Orb · MetaBalls · Cubes
- **[SG]** gradiente shader 3D
- Base R3F (three.js + @react-three/fiber): esses componentes assumem esse stack.

### Cursores customizados
- **[RB]** SplashCursor · BlobCursor · GhostCursor · TargetCursor · Crosshair · PixelTrail ·
  ImageTrail · Magnet · MagnetLines
- **[LSW]** smokey-cursor · sparkle-cursor · smooth-cursor · canvas-confetti-cursor
- Cuidado: cursor custom **só desktop** (não existe hover no touch — ver `scroll-cinematic` §6).

### Galerias / carrosséis
- **[RB]** Carousel · CircularGallery · DomeGallery · FlyingPosters · Masonry · Stack · InfiniteMenu · OrbitImages
- **[Cult]** feature-carousel · three-d-carousel · loading-carousel · logo-carousel
- **[LSW]** 3d-carousel · chain-carousel · team-carousel · stylish-carousel · scroll-carousel ·
  interactive-card-gallery · image-sliding-marquee · sliding-cards

### Marquees / logos rolando (prova social)
- **[RB]** LogoLoop
- **[LSW]** sliding-logo-marquee · image-sliding-marquee · marquee-menu · 3d-marquee

### Loaders / progresso
- **[LSW]** spectrum-loader · magic-loader · ripple-loader · top-loader · password-strength-indicator
- **[RB]** Counter · CountUp (contadores animados)

### Formulários / inputs premium
- **[Cult]** popover-form · color-picker · choice-poll · feature-poll · vote-tally
- **[LSW]** expandable-search-bar · animated-range-input · typewriter-input · slide-to-confirm
- Base (validação/acessibilidade): **shadcn** form/input/select/command

### Delight / decor (partículas, confete, orbes)
- **[RB]** MetaBalls · Ribbons · ShapeBlur · Noise · Antigravity · MagicRings · Strands
- **[LSW]** canvas-confetti-cursor · sparkle-particles · particles-background · particle-orbit-effect ·
  animated-bubble-particles · meteors · globe

### Blocos de seção prontos (hero, cta, pricing, faq, testimonials, footer…)
- **[WM]** 22 categorias de blocks: announcement · auth · bento · blog · career · contact ·
  cta · error · faq · feature · file-upload · footer · hero · integrations · navigation ·
  newsletter · notification · pricing · stats · team · testimonials · widget (a fonte mais
  forte para montar landing por seção; instale a variante por `registry.watermelon.sh`)
- **[shadcn]** 30 blocks: dashboard-01 · login-01…05 · signup-01…05 · sidebar-01…16
- Para a estrutura AIDA da landing, ver skill `gpt-taste`; aqui você pega os blocos prontos.

### UI base em muitas variantes (input, select, tabs, dialog, table…)
- **[WM]** o acervo mais profundo: button (38) · select (36) · alerts (30) · tabs (26) ·
  calendar (25) · badge (24) · dialog (23) · avatar (21) · textarea (21) · sonner (20) ·
  switch (18) · accordion (16) · checkbox (16) · table (16) · pagination (15) · card (15) …
  (30 categorias, 514 variantes — nomes/números no censo)
- **[shadcn]** os 61 primitivos acessíveis (a base). Use shadcn para a fundação, Watermelon
  quando quiser uma variante pronta com mais caráter.

### Micro-interações de produto / fintech (dashboards, wallet, forms vivos)
- **[WM]** 131 animated: morphing-button · dialog-stack · scroll-island · gooey-menu ·
  fluid-tabs · shimmer-button · card-swipe · revealing-cards · waveform-scrub ·
  swap-currency-card · transaction-list · onboarding-checklist · command-search · dock …
  (ótimo para SaaS/app; adapte tokens e conteúdo real)

---

## 3. Qual biblioteca para qual vibe (guia rápido)

- **Premium/Tech (SaaS, "Apple/Linear-tier"):** Cult UI (hero-liquid-metal, texture-card,
  metal-button, family-drawer) + React Bits (Aurora/DarkVeil/Silk de fundo, SpotlightCard) +
  **Watermelon** (UI base em variantes + micro-interações de produto) + shadcn (base).
  Combina com skill `high-end-visual-design`.
- **Conversão/Marketing (landing):** **Watermelon** (blocos prontos: hero/cta/pricing/faq/
  testimonials/stats) + React Bits (texto: ShinyText/GradientText/CountUp; LogoLoop de prova
  social) + Cult UI (botões, feature-carousel). Combina com `gpt-taste`.
- **Disruptivo/Awwwards:** Lightswind (shaders, 3D, CinematicScroll) + React Bits
  (Balatro/Hyperspeed/LiquidEther, cursores) + ShaderGradient. Combina com
  `industrial-brutalist-ui` ou `high-end-visual-design`.
- **Institucional/Clean:** fundos sutis (DotGrid/grid-beam/stripe-bg-guides), minimal-card,
  texto discreto. **Menos é mais** — combina com `minimalist-ui`.
- **3D no herói:** Lightswind (3d-model-viewer, globe) ou React Bits (ModelViewer, FluidGlass)
  ou ShaderGradient.

---

## 4. Fluxo de uso (com o design-director)

1. O `design-director` define a direção e identifica onde um componente pronto ajuda.
2. Consulte este catálogo pelo **caso de uso** → escolha o componente real na lib certa.
3. Instale com o **comando real** da §1 (CLI copy-paste; ShaderGradient via npm).
4. **Adapte** ao design system: troque cores por tokens do projeto, conteúdo real (sem
   "Lorem"/"Acme"), tipografia do `fonts-system`, e ajuste timings/easing ao motion do site.
5. Performance: um WebGL pesado por página, `prefers-reduced-motion`, fallback no mobile.
6. Passe pelo checklist da skill de estilo + `SISTEMA.md`.

## 5. Galerias que NÃO são clonáveis (copiar por componente do site)
Aceternity (ao vivo), 21st.dev, Magic Pattern, Lukacho, Sprint, animmasterlib, Refero — não
são repos clonáveis em massa; catalogadas em `CATALOGO.md` §4.2. Copie o componente
individual do site e adapte pelas mesmas regras acima.

**Uiverse é caso à parte:** o site `uiverse.io` é galeria (copiar por elemento), mas existe
um **snapshot clonável** `github.com/uiverse-io/galaxy` — **3.802** elementos CSS/Tailwind
(MIT, congelado em set/2024). Para consulta/censo em massa, clone o galaxy; para o mais
novo, use o site. São snippets CSS por-elemento (não componentes React) — adapte igual.
