---
name: animejs
description: Referência oficial de anime.js v4 do projeto. Use SEMPRE que for animar via código — animate(), timeline, stagger, scroll-linked/scrub, draggable, FLIP layout, split/scramble de texto, SVG (drawable/morph/motion path), WAAPI, springs/easings — ou ao migrar código v3, ou quando uma animação se comporta errado (easing ignorado, nada se move, pulos, vazamento no unmount). Dispare em qualquer menção a "anime.js", "animejs", ou animação JS/DOM orquestrada por código. NÃO cobre ícones animados Lottie (skill iconsax-icons) nem SVGs exportados do SVGator (skill svgator-animations). A API v4 mudou muito vs v3 — nunca escreva anime.js de memória; consulte os arquivos de referência desta skill.
---

# anime.js v4 — Referência do projeto

Documentação verificada contra o código-fonte **v4.4.1** vendorado em `vendor/anime/`
(ground truth: em dúvida, leia o source em `vendor/anime/src/`; bundles prontos para
script tag em `vendor/anime/dist/bundles/` — os references citam os arquivos exatos).

Regra dura: **não escreva anime.js de memória.** A memória do modelo está contaminada
pela v3 (`anime({targets})`) e por APIs de pre-release da v4 (`createSpring`, motion path
`{x,y,angle}`) que foram removidas ou deprecadas. E na v4 os erros são SILENCIOSOS:
uma opção com typo vira propriedade animada, um ease string com typo vira linear,
nada lança exceção — o código apenas anima errado. Antes de usar qualquer módulo,
leia o reference correspondente.

## Onde está cada coisa

| Preciso de... | Arquivo |
|---|---|
| `animate()` core, parâmetros, keyframes, composição | `reference/animate.md` |
| Sequenciar animações (timeline, sync, labels, posições) | `reference/timeline.md` |
| `utils.*` e `stagger()` | `reference/utils-stagger.md` |
| Easings, springs, `cubicBezier`/`steps`/`irregular` | `reference/easings.md` |
| Scroll-linked / scrub (`onScroll`, ScrollObserver) | `reference/scroll.md` |
| Animação por layout FLIP (add/remove/reparent, shared elements) | `reference/layout.md` |
| Drag com momentum, bounds, snap | `reference/draggable.md` |
| Texto: split em chars/words/lines, scramble | `reference/text.md` |
| SVG: drawable (line drawing), morph, motion path | `reference/svg.md` |
| WAAPI nativo (`waapi.animate`, compositor thread) | `reference/waapi.md` |
| `createAnimatable` (valores contínuos, ex.: seguir cursor) | `reference/animatable.md` |
| Escopos, defaults, media queries (`createScope`, React) | `reference/scope.md` |
| Timer/engine (scheduling, fps, defaults globais, game loop) | `reference/timer-engine.md` |
| Exports do pacote + migração v3→v4 completa | `reference/exports-migration.md` |
| **Receitas prontas** (padrões dos 25 examples oficiais) | `reference/recipes.md` |

## Como carregar

```js
// Projeto npm (preferido): npm i animejs
import { animate, createTimeline, stagger, onScroll, utils, svg } from 'animejs';

// HTML single-file: UMD define UM objeto global `anime` (namespace)
// <script src="vendor/anime/dist/bundles/anime.umd.min.js"></script>
// anime.animate('.el', {...}); anime.stagger(100); anime.utils.set(...)

// Ou ESM direto no browser, sem build:
// <script type="module">
//   import { animate } from './vendor/anime/dist/bundles/anime.esm.min.js';
// </script>
```

**Não existe default export** e `anime` **não é chamável** na v4. Subpaths tree-shakable:
`animejs/animation`, `animejs/waapi`, `animejs/svg`, `animejs/text`, etc.

## Fatos inegociáveis da v4

1. **Targets primeiro**: `animate(targets, params)`. Targets: seletor, Element, NodeList,
   objeto JS puro, arrays aninhados. `anime({ targets })` da v3 está morto.
2. **Defaults globais** (`src/core/globals.js`): `duration: 1000`, `delay: 0`,
   `ease: 'out(2)'` (**NÃO é linear**), `loop: 0`, `alternate: false`, `autoplay: true`,
   `composition: 'replace'`, `frameRate: 240`. `createTimer()` tem duration default
   `Infinity`, não 1000. Override global em `engine.defaults`, por timeline em
   `createTimeline({ defaults })`, por componente em `createScope({ defaults })`.
3. **`loop: N` toca N+1 vezes**; `loop: true` = infinito (nunca dispara `onComplete`).
4. **Easing é `ease`**, nomes sem prefixo `ease`: `'outQuad'`, `'inOutExpo'`, strings
   paramétricas `'out(3)'`, `'outBack(1.7)'`, `'outElastic(1, .5)'`. As formas string
   `steps()/linear()/cubicBezier()/irregular()` **foram removidas** — importe e CHAME as
   funções. `eases.out`, `eases.outElastic`, `eases.inOut` são **factories: chame-as**
   (`eases.inOut(3)`); passar sem chamar produz NaN.
5. **Springs**: `spring({ mass, stiffness, damping, velocity })` ou perceptual
   `spring({ bounce, duration })`. A instância É o ease e **sobrescreve o `duration` do
   tween com `spring.settlingDuration`**. `createSpring` é alias deprecado.
6. **Formas de valor**: `320` | `'50vw'` | `'+=100'`/`'-=50'`/`'*=2'` | `[from, to]`
   (exatamente 2 valores não-objeto) | array com 3+ = keyframes | `{ from, to, duration,
   delay, ease, composition, modifier }` | `(el, i, targets) => valor` | `keyframes`
   array ou objeto percentual `{'0%': {...}}`. **`fromTo` é código morto — nunca use.**
7. **Transforms**: shorthands `x/y/z` → `translateX/Y/Z`; unidades inferidas (`x: 100` →
   `'100px'`, `rotate: 90` → `'90deg'`, `scale` sem unidade). From-values são lidos
   **apenas de inline styles** — transform definido em classe CSS é invisível; semeie com
   `utils.set()` ou passe `from` explícito.
8. **Instâncias são thenable**: `await animate(...)` / `await tl` substitui `.finished` da v3.
9. **Cleanup**: `.revert()` (não só `.pause()`) cancela + restaura inline styles + reverte
   ScrollObservers linkados. Em componentes, envolva tudo em `createScope({ root })` e
   chame `scope.revert()` no unmount — uma chamada limpa animações, observers, draggables
   e splitters criados sincronamente dentro do scope.
10. **Callbacks**: `onBegin/onUpdate/onLoop/onComplete/onPause/onRender/onBeforeUpdate`
    (os `begin/update/complete` da v3 sumiram — e seriam tweened como propriedades!).
11. **Composition**: `'replace'` (default, cancela tweens conflitantes), `'none'` (rápido,
    auto-selecionado com ≥1000 targets; passe explícito em cenas grandes), `'blend'`
    (aditivo — use para hover in/out sobreposto e movimento orgânico).
12. **Scroll**: `autoplay: onScroll({...})`. Threshold strings são na ordem **'container
    target'** (`enter: 'bottom top'` = bottom do container encontra top do target).
    O default `sync: 'play pause'` é **modo gatilho, não scrub** — use `sync: true`
    (scrub 1:1), número 0..1 (lerp suave) ou nome de ease (scrub com easing).
    `debug: true` desenha o visualizador de thresholds.
13. **`createAnimatable`**: um Number como param é a **duração em ms, não valor-alvo** —
    `createAnimatable(el, { x: 500 })` significa "x retarget em 500ms".
14. **`splitText`** divide só o PRIMEIRO elemento que casa; `words: true` é default mesmo
    pedindo só chars. Use `.addEffect(({ chars }) => animate(...))` para o efeito
    sobreviver a re-splits no resize.
15. **Posições de timeline**: `'+=N'` é relativo ao FIM da timeline, não ao filho
    anterior — use `'<'` (fim do anterior), `'<<'` (início do anterior), `'<<+=N'`,
    labels, ou `stagger(N)` como posição (um filho por target).

## Gotchas que queimam (sintoma → causa → correção)

| Sintoma | Causa → Correção |
|---|---|
| Movimento "rápido depois lento" inesperado | Ease default é `'out(2)'` → declare `ease: 'linear'` quando precisar |
| Propriedade aleatória animando / nada lança erro | Opção com typo ou nome v3 vira tween (`easing:`, `complete:` viram "propriedades"!) → confira nomes no reference |
| Ease parece ignorado | Typo no ease string → linear silencioso; factory sem chamar → NaN |
| `duration` ignorado | Ease `spring()` é dono da duração (settlingDuration) |
| Elemento pula no início da animação | From-value de transform lido só de inline style → `utils.set()` antes |
| Stroke do SVG some na hora | `svg.createDrawable()` default `start=0, end=0` (invisível) — anime `draw: ['0 0', '0 1']` logo em seguida, ou crie com `(sel, 0, 1)` |
| Progress de scroll travado em 0 | Seletor resolve no frame seguinte e caiu para `document.body`, ou ordem de threshold invertida → `debug: true` |
| Scrub parece liga/desliga | Default `sync: 'play pause'` → `sync: true` ou número |
| Hover in/out brigando | `composition: 'replace'` trunca → `composition: 'blend'` |
| Loop toca uma vez a mais | `loop: N` = N+1 iterações |
| Animação reinicia do 0 ao mudar media query | Scope re-roda constructors → envolva em `scope.keepTime(() => animate(...))` |
| Stagger errado no segundo uso | Função de stagger cacheia distâncias em closure → crie um `stagger()` novo por animação |
| Vazamento / animações fantasma em React | Faltou `scope.revert()` no cleanup; criação assíncrona escapa do scope (só criação síncrona é registrada) |
| Callback de `waapi.animate` nunca dispara | WAAPI suporta **apenas `onComplete`** — o resto é ignorado em silêncio |
| `'<'` lança erro no primeiro add | `'<'` exige filho anterior; `'<<'` retorna 0 |
| Estados iniciais de filhos staggered não aparecem | Chame `tl.init()` após montar a timeline para pintar os from-states |
| Crash `str.includes is not a function` ao re-randomizar (`onLoop` + `refresh()`) | Function value retornando OBJETO `() => ({from, to})` só funciona no parse; `refresh()` quebra com ele → retorne Number/String puro e guarde os randoms no `onLoop` (idioma do recipes.md) |
| Valor "constante por ciclo" deriva em diagonal após o 1º loop | `{ from: fn, to: fn }` NÃO registra a from-function (`animation.js:373`) — no `refresh()` o from vira o valor atual → use a forma TUPLA `prop: [fn, fn]` (única que captura as duas funções, `animation.js:419`) |

## Fazendo coisas insanas — playbook de receitas

`reference/recipes.md` destila os 25 examples oficiais. As meta-técnicas:

- **Anime qualquer coisa numérica**: objetos puros (4000 partículas de canvas renderizadas
  em um único `createTimer` no `onUpdate`), `progressY` de draggable, ou o
  `currentTime`/`progress`/`speed` de OUTRA timeline
  (`animate(tl, { progress: 1, ease: 'inOut(3)' })` = seek com easing / slow-mo — é isso
  que move o efeito de 50K estrelas).
- **Vida orgânica**: timer de `frameRate` baixo re-disparando
  `animate(..., { composition: 'blend' })` em direção a alvos móveis (creatures, fireflies).
- **Loops sem emenda**: cada filho com `loop: true`, inserts espalhados com
  `stagger([0, periodo])`, e `tl.seek(10000)` para começar no regime permanente.
- **Re-randomizar por ciclo**: `onLoop: self => self.refresh()` reavalia function values.
- **Hover-scrub**: timeline pré-montada com `autoplay: false`; pointerenter/leave →
  `animate(tl, { progress: 1 | 0 })` — reversível no meio do caminho.
- **Carrossel infinito**: duplicar filhos + `createAnimatable` com
  `modifier: utils.wrap(-w/2, 0)` + draggable de objeto puro para física + um timer.
- **Perf em escala**: `composition: 'none'`, `waapi.animate` para transforms/opacity na
  compositor thread, canvas para milhares de partículas,
  `engine.useDefaultMainLoop = false` + `engine.update()` dentro de rAF/Three.js existente.

## Convenções do projeto

- Respeite `prefers-reduced-motion: reduce`: use
  `createScope({ mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' } })` e
  cheque `scope.matches.reduceMotion` (re-roda sozinho na mudança); no modo reduzido pule
  para o estado final com `utils.set`.
- Não anime via anime.js o que já é animado por SVGator ou Lottie (conflito de transform).
- `splitText` mantém cópia acessível por default (`accessible: true`) — não desligue.
- Prefira transforms/opacity (ou `waapi.animate`) a propriedades que disparam layout.
- Toda animação com escopo de componente precisa de um caminho de `revert()`.

## Red flags — PARE e abra o reference

- Você digitou `anime({`, `targets:`, `easing:`, `direction:`, `begin:`, `complete:`,
  `.finished`, `anime.timeline`, `anime.stagger`, `anime.set` → isso é v3. Tudo.
- Você digitou `createSpring(`, `fromTo:`, motion path `{x, y, angle}` → API deprecada/morta
  de pre-release da v4.
- Você está prestes a chutar um default, nome de opção ou sintaxe de threshold → erra em
  silêncio em vez de lançar. Confira: `reference/*.md`, depois `vendor/anime/src/`.
