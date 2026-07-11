# Censo verificado das bibliotecas de componentes (02/07/2026)

> Auditoria real: cada repositório clonado (`--depth 1`), estrutura inspecionada e
> componentes **contados no filesystem** (não de memória). Índice de consulta completo com
> todos os nomes reais. Os totais mudam com o tempo — cada parte traz o comando de
> re-verificação para recontar em segundos.

## Tabela-resumo

| Fonte | Inventário real | Licença | Último commit | Como puxar |
|---|---|---|---|---|
| React Bits | **134** (30 Animations, 45 Backgrounds, 36 Components, 23 TextAnimations) | **MIT + Commons Clause** (ver Parte 1) | jun/2026 | clone + copiar `src/content/` (ou site/jsrepo) |
| Cult UI | **82** ui + 1 block | MIT | mai/2026 | registry shadcn (`apps/www/registry/default/ui`) |
| Lightswind | **204** + 2 templates | MIT | jun/2026 | clone (`Components/*.tsx`) ou CLI própria |
| ShaderGradient | pacote + **10 presets** | MIT | jun/2026 | `npm i shadergradient @react-three/fiber three` |
| Watermelon | **514 variantes** em 30 categorias + 131 animated + 22 categorias de blocks + 2 dashboards | MIT | jul/2026 | clone (`src/data/contents/`) + CLI shadcn por variante |
| shadcn/ui v4 | **61** ui + **30** blocks + charts + **16** estilos | MIT | jul/2026 | `npx shadcn@latest add <c>` |
| Uiverse (galaxy) | **3.802** elementos | MIT | set/2024 (congelado) | clone `uiverse-io/galaxy` |

Clone consolidado (uma vez por máquina):
```bash
mkdir -p _ref && cd _ref
for r in DavidHDev/react-bits nolly-studio/cult-ui codewithMUHILAN/Lightswind-UI-Library \
         ruucm/shadergradient WatermelonCorp/watermelon-platform shadcn-ui/ui uiverse-io/galaxy; do
  git clone --depth 1 "https://github.com/$r"
done
```

---

## PARTE 1 · React Bits (134) — github.com/DavidHDev/react-bits

**Estrutura:** `src/content/<Categoria>/<Componente>/` com `<Componente>.jsx` + `.css`
(fonte canônica JS+CSS; o site serve variantes TS/Tailwind). Muitos usam three/ogl (WebGL)
— cheque as dependências no topo de cada arquivo. Caminho local: `_ref/react-bits/`.

**⚠️ Licença: MIT + Commons Clause.** A Commons Clause proíbe **vender o software em si**
(revender os componentes como biblioteca, template pack ou produto derivado cujo valor seja
substancialmente os próprios componentes). Usar componentes DENTRO de projetos entregues a
clientes é o uso pretendido pela comunidade, mas: mantenha a atribuição, não redistribua
como "seu pack de componentes", e leia o `LICENSE.md` do repo na dúvida. (Não é
aconselhamento jurídico; é o resumo do texto da licença.)

- **Backgrounds (45):** Aurora, Balatro, Ballpit, Beams, ColorBends, DarkVeil, Dither, DotField, DotGrid, EvilEye, FaultyTerminal, Ferrofluid, FloatingLines, Galaxy, GradientBlinds, Grainient, GridDistortion, GridMotion, GridScan, Hyperspeed, Iridescence, LetterGlitch, LightPillar, LightRays, Lightfall, Lightning, LineWaves, LiquidChrome, LiquidEther, Orb, Particles, PixelBlast, PixelSnow, Plasma, PlasmaWave, Prism, PrismaticBurst, Radar, RippleGrid, ShapeGrid, SideRays, Silk, SoftAurora, Threads, Waves
- **Animations (30):** AnimatedContent, Antigravity, BlobCursor, ClickSpark, Crosshair, Cubes, ElectricBorder, FadeContent, GhostCursor, GlareHover, GradualBlur, ImageTrail, LaserFlow, LogoLoop, MagicRings, Magnet, MagnetLines, MetaBalls, MetallicPaint, Noise, OrbitImages, PixelTrail, PixelTransition, Ribbons, ShapeBlur, SplashCursor, StarBorder, StickerPeel, Strands, TargetCursor
- **Components (36):** AnimatedList, BorderGlow, BounceCards, BubbleMenu, CardNav, CardSwap, Carousel, ChromaGrid, CircularGallery, Counter, DecayCard, Dock, DomeGallery, ElasticSlider, FlowingMenu, FluidGlass, FlyingPosters, Folder, GlassIcons, GlassSurface, GooeyNav, InfiniteMenu, Lanyard, MagicBento, Masonry, ModelViewer, PillNav, PixelCard, ProfileCard, ReflectiveCard, ScrollStack, SpotlightCard, Stack, StaggeredMenu, Stepper, TiltedCard
- **TextAnimations (23):** ASCIIText, BlurText, CircularText, CountUp, CurvedLoop, DecryptedText, FallingText, FuzzyText, GlitchText, GradientText, RotatingText, ScrambledText, ScrollFloat, ScrollReveal, ScrollVelocity, ShinyText, Shuffle, SplitText, TextCursor, TextPressure, TextType, TrueFocus, VariableProximity

Re-verificar: `for d in _ref/react-bits/src/content/*/; do echo "$d: $(ls $d | wc -l)"; done`

---

## PARTE 2 · Cult UI (82) — github.com/nolly-studio/cult-ui

**Estrutura:** monorepo com registry estilo shadcn em `apps/www/registry/default/ui`
(+ `example/` com demos e `block/`). Copie o componente + confira dependências (muitos usam
framer-motion). MIT puro. Caminho local: `_ref/cult-ui/`.

**Componentes (82):** ai-instructions, animated-number, bg-animate-button, bg-animated-fractal-dot-grid, bg-animated-gradient, bg-image-texture, bg-media, border-beam-button, canvas-fractal-grid, choice-poll, code-block, color-picker, cosmic-button, cutout-card, direction-aware-tabs, distorted-glass, dither-image, dock, dynamic-island, edge-blur, expandable-card, expandable-screen, expandable, family-button, family-drawer, feature-carousel, feature-poll, feature-voting, floating-panel, glow-button, gradient-button-group, gradient-heading, grid-beam, hero-color-panel, hero-dithering, hero-heatmap, hero-liquid-metal, hero-static-radial-gradient, hover-video-player, intro-disclosure, lightboard, loading-carousel, logo-carousel, metal-button, minimal-card, mock-browser-window, morph-surface, neumorph-button, neumorph-eyebrow, onboarding, pixel-heading-character, pixel-heading-word, pixel-paragraph-words-inverse, pixel-paragraph-words, poll-widget, popover-form, popover, prompt-library, shader-lens-blur, shader-shape-lens-blur copy, shift-card, side-panel, sortable-list, squiggle-arrow, stripe-bg-guides, svg-bands, svg-shapes-animated, svg-shapes, terminal-animation, text-animate, text-gif, texture-button, texture-card, texture-overlay, three-d-carousel, timer, toolbar-expandable, tweet-grid, type-animate, typewriter, vote-tally, youtube-video-player

Re-verificar: `ls _ref/cult-ui/apps/www/registry/default/ui | wc -l`

---

## PARTE 3 · Lightswind (204 + 2 templates) — github.com/codewithMUHILAN/Lightswind-UI-Library

**Estrutura:** flat: `Components/<nome>.tsx` (React+TS+Tailwind; os 3D usam three.js). Tem
`cli.js` próprio (`npx lightswind@latest add <componente>`), `Styles/`, `hooks/`,
`Templates/` (portfolio01Source, portfolio02Source). MIT. Forte em 3D/efeito chamativo:
avalie peso (three.js ≈ +150KB) antes de usar em página leve. Caminho local: `_ref/lightswind/`.

**Componentes (204):** 3D-Perspective-Card, 3d-MarqueewithCustomComponents, 3d-carousel, 3d-hover-gallery, 3d-image-carousel, 3d-image-gallery, 3d-image-ring, 3d-image-slider, 3d-marquee, 3d-model-viewer, 3d-perspective-cards, 3d-scroll-trigger, 3d-slider, CinematicScroll, Dock, HangingIdCard, ScrollSnapCarouselPin, ScrollVelocityContainer, SparkleCursor, SpectrumLoader, ThreeDImageCarousel, accordion, ai-prompt, alert-dialog, alert, angled-slider, animated-blob-background, animated-bubble-particles, animated-copy-button, animated-notification, animated-number-stepper, animated-ocean-waves, animated-range-input, animated-wave, ascii-wave, aspect-ratio, aurora-background, aurora-shader, aurora-text-effect, avatar, badge, beam-circle, beam-grid-background, bento-grid, border-beam, breadcrumb, button, calendar, canvas-confetti-cursor, card, carousel, chain-carousel, chart, checkbox, code-hover-cards, collapsible, command, confetti-button, connection-graph, context-menu, cool-bento-effect, cool-theme-toggle, cosmic-dust, cosmic-singularity-background, count-up, cyber-hive-background, dialog, dot-grid-background, dot-pattern, drag-order-list, draggable-reorder-list, drawer, dropdown-menu, dynamic-island, dynamic-navigation, electro-border, ether-waves-background, expandable-search-bar, expandable-speed-dial, fall-beam-background, fluid-button, fluid-chrome-background, form, glass-folder, glitch-button, globe, glowing-background, glowing-cards, glowing-lights, gradient-background, gradient-btn-home, gradient-button, grid-dot-backgrounds, hamburger-menu-overlay, hell-background, holo-button, holographic-wave, hover-card, image-reveal, image-sliding-marquee, image-trail-effect, infinite-drift, infinite-webgl-scroll, innovation-background, input-otp, input, interactive-card-gallery, interactive-card, interactive-gradient-card, interactive-grid-background, iphone16-pro, label, lens, liquid-fluid, liquid-surface, looping-words, magic-card, magic-loader, magnetic-button, magnetic-field-background, marquee-menu, menubar, meteors, morphing-navigation, nav-effect, navigation-menu, nebula-flow, neural-link-background, orbit-card, pagination, particle-orbit-effect, particles-background, password-strength-indicator, plasma-globe, popover, progress, quantum-field, radio-group, rays-background, reflect-background, resizable, ripple-button, ripple-loader, rolling-text-3d, satin-flow, scroll-area, scroll-cards, scroll-carousel, scroll-list, scroll-para-3d, scroll-para, scroll-reveal, scroll-stack, scroll-timeline, scroll-trigger-carousel, seasonal-hover-cards, select, separator, shader-background, sheet, shine-button, shiny-text, sidebar, skeleton, slide-to-confirm, slider, sliding-cards, sliding-logo-marquee, smokey-background, smokey-cursor-hero, smokey-cursor, smooth-cursor, sparkle-navbar, sparkle-particles, stack-list, stardust-button, stepper, stripes-background, stylish-carousel, switch, table, tabs, team-carousel, terminal-card, test, text-scroll-marquee, textarea, toast, toaster, toggle-group, toggle-theme, toggle, tooltip, top-loader, top-sticky-bar, trial-button, trusted-users, typewriter-input, typing-text, vector-flow, video-modal, video-text, wave-background, woofy-hover-image

Re-verificar: `ls _ref/lightswind/Components/*.tsx | wc -l`  (nome do clone pode ser `Lightswind-UI-Library`)

---

## PARTE 4 · ShaderGradient — github.com/ruucm/shadergradient

Não é coleção; é um **pacote** (React/Three) de gradientes 3D animados via URL de
configuração, ideal para fundo de herói premium. MIT. Caminho local: `_ref/shadergradient/`.

**Presets nomeados (10):** Halo, Pensive, Mint, Interstella, Nighty night, Viola, Universe, Sunset, Mandarin, Cotton Candy

```bash
npm i shadergradient @react-three/fiber three
```
```jsx
import { ShaderGradientCanvas, ShaderGradient } from 'shadergradient'
<ShaderGradientCanvas style={{ position:'absolute', inset:0 }}>
  <ShaderGradient control='query' urlString='https://www.shadergradient.co/customize?...' />
</ShaderGradientCanvas>
```
Monte o gradiente no editor de shadergradient.co e cole a URL. Peso: WebGL; use 1 por
página, com `prefers-reduced-motion` desligando a animação.

---

## PARTE 5 · Watermelon (514 variantes) — github.com/WatermelonCorp/watermelon-platform

**Estrutura:** plataforma inteira open-source; o acervo está em `src/data/contents/`:
`components/` (30 categorias, variantes numeradas com comando CLI shadcn por variante),
`animated-components/` (131), `blocks/` (22 categorias), `dashboards/` (2), `templates/`.
MIT. Repo vivo. Caminho local: `_ref/watermelon/`.

**Variantes por categoria (514 no total):** accordion (16); alerts (30); avatar (21); badge (24); breadcrumb (8); button (38); button-group (12); calendar (25); card (15); checkbox (16); collapsible (9); combobox (12); data-table (13); date-picker (13); dialog (23); dropdown-menu (14); form (10); input-mask (6); input-otp (10); pagination (15); popover (12); radiogroup (13); select (36); sheet (7); sonner (20); switch (18); table (16); tabs (26); textarea (21); tooltip (15)

**Animated components (131):** aave-swap-component, activities-card, adaptive-slider, add-cash-disclosure, budget-card, calendar-widget, card-cue, card-split-accordian, card-swipe, carousel-navigator, carousel-slider, changeable-pricing-section, collection-grid-disclosure, command-search, compose-email-card, contextual-ai-bar, continuous-pagination, continuous-tabs, copy-confirm, create-community, create-new-disclosure, credit-usage-card, deployment-card, dialog-stack, discrete-tabs, dock, draw-signature, dropdown-disclosure, edit-badge, edit-profile, editable-chip, emoji-spree-choice-chips, event-reminders, expand-details, expandable-event-card, expandable-profile-card, extended-toolbar, family-receive-button, family-wallet, feature-tour, feedback, feedback-action, filter-disclosure, floating-disclosure, floating-input, fluid-tabs, fractional-picker, frequency-selector, fund-widget, gooey-menu, inline-action, inline-disclosure-menu, inline-edit, inline-overflow, inline-table-control, inline-toast, integration-card, invite-disclosure, journal-navigation, knob-slider, labeled-progress-indicator, layered-progressive-disclosure, licence-key, list-stack, macos-sidebar, meeting-card, minimal-carousel, morphing-button, morphing-discovery-bar, morphing-sidebar-controls, onboarding-checklist, onboarding-screen, onboarding-setup, pagination, pin-item, pop-stepper, predictive-text, pricing-widget, profile-card, progressive-input-stack, quick-feedback, quick-option-picker, quick-paste, quick-switcher, radial-carousel, range-selection-slider, returns-calculator-snippet, reveal-copy, revealing-cards, run-action-button, run-widget, save-toggle, schedule-button, schedule-date, scroll-island, scrub-slider, select-ai-agent, send-money, share-sheet, shimmer-button, show-qr, shuffle-pinned-item, slot-picker, split-actions, split-button, split-to-edit, status-picker, step-indicator, step-pager, stepper, subscription-calendar, swap-currency-card, swap-form, switch-disclosure, switch-mode, tags, task-widget-disclosure, time-undo-action, tooltip-navbar, trade-summary, transaction-list, tree-menu, uniswap-dialog, vertical-tooltip-navbar, view-on-map, voice-chat-disclosure, voice-note, voice-transcribe, waveform-scrub, weight-widget, wiggling-cards

**Categorias de blocks (22):** announcement, auth, bento, blog, career, contact, cta, error, faq, feature, file-upload, footer, hero, integrations, navigation, newsletter, notification, pricing, stats, team, testimonials, widget

Re-verificar: `cat _ref/watermelon/src/data/contents/components/*/index.ts | grep -cE "id: ['\"]"`

---

## PARTE 6 · shadcn/ui v4 (61 ui + 30 blocks) — github.com/shadcn-ui/ui

**A fundação.** Registry canônico em `apps/v4/registry/new-york-v4/ui` + `__blocks__.json` +
charts + **16 estilos** (base-luma, base-lyra, base-maia, base-mira, base-nova, base-rhea,
base-sera, base-vega, radix-luma, radix-lyra, radix-maia, radix-mira, radix-nova, radix-rhea,
radix-sera, radix-vega). Instale por CLI (não copie do clone): `npx shadcn@latest add <c>`.
Caminho local: `_ref/shadcn-ui/`.

**Componentes ui (61):** accordion, alert-dialog, alert, aspect-ratio, attachment, avatar, badge, breadcrumb, bubble, button-group, button, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, dialog, direction, drawer, dropdown-menu, empty, field, form, hover-card, input-group, input-otp, input, item, kbd, label, marker, menubar, message-scroller, message, native-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle-group, toggle, tooltip

**Blocks (30):** dashboard-01, login-01…05, preview, preview-02, preview-03, sidebar-01…16, signup-01…05

---

## PARTE 7 · Uiverse galaxy (3.802) — github.com/uiverse-io/galaxy

Snapshot **clonável** da comunidade Uiverse (MIT), congelado em set/2024. 3.802 elementos
CSS/Tailwind (buttons, cards, loaders, inputs, checkboxes, switches, forms, tooltips…). É
por-elemento (CSS puro), não uma lib de componentes React — copie o snippet e adapte.
Diferente do site vivo `uiverse.io` (galeria, §4.2 do CATALOGO), aqui é um repo de censo.

---

## Fronteira honesta

Números contados no filesystem em 02/07/2026. Todos os repos (exceto o galaxy do Uiverse,
congelado em set/2024) estão vivos: os totais mudam; os comandos de re-verificação recontam
em segundos. Galerias sem repositório (Aceternity, 21st, Skiper, Magic Pattern, Lukacho,
Sprint, animmasterlib, Refero): captura por componente, registradas no `CATALOGO.md` §4.2.
