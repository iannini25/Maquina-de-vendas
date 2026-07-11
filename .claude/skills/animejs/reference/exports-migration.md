# anime.js v4 — Exports, Install Patterns & v3→v4 Migration

> Derived from anime.js **v4.4.1** source (`vendor/anime/src/index.js`, `package.json`, `dist/bundles/anime.umd.min.js`).
> v4 has **no default export**. v3's `anime(...)` callable no longer exists — everything is a named export.

## Import

```js
// npm ESM (the normal way) — package.json "module": "./dist/modules/index.js"
import { animate, createTimeline, stagger, utils, svg, text, eases, onScroll, engine } from 'animejs';

// CommonJS (Node require) — resolves to ./dist/modules/index.cjs
const { animate, utils } = require('animejs');

// CDN ESM bundle (browser <script type="module">)
import { animate, stagger } from 'https://cdn.jsdelivr.net/npm/animejs@4.4.1/+esm';
// or the raw ESM bundle file:
import { animate } from 'https://cdn.jsdelivr.net/npm/animejs@4.4.1/dist/bundles/anime.esm.min.js';

// CDN UMD (classic <script>) — exposes ONE global object named `anime`
// (jsdelivr/unpkg fields point to dist/bundles/anime.umd.min.js)
// <script src="https://cdn.jsdelivr.net/npm/animejs@4.4.1/dist/bundles/anime.umd.min.js"></script>
// then: anime.animate('.el', {...}); anime.createTimeline(); anime.utils.set(...); anime.stagger(100)
```

**UMD global naming** (from the bundle header `(t.anime={})`): the global is `anime`, and every named ESM export hangs off it: `anime.animate`, `anime.createTimeline`, `anime.stagger`, `anime.utils.*`, `anime.svg.*`, `anime.text.*`, `anime.eases`, `anime.engine`, `anime.onScroll`, `anime.waapi.animate`, etc. `anime` itself is **not callable** (v3 habit; will throw).

### Tree-shaking subpath imports

`package.json` `"sideEffects": false` + per-module `exports` map. Each subpath ships its own `.js`/`.cjs`/`.d.ts`:

| Subpath | Main exports |
|---|---|
| `animejs/animation` | `animate`, `JSAnimation` |
| `animejs/timer` | `createTimer`, `Timer` |
| `animejs/timeline` | `createTimeline`, `Timeline` |
| `animejs/animatable` | `createAnimatable`, `Animatable` |
| `animejs/draggable` | `createDraggable`, `Draggable` |
| `animejs/scope` | `createScope`, `Scope` |
| `animejs/events` | `onScroll`, `ScrollObserver`, `scrollContainers` |
| `animejs/engine` | `engine` |
| `animejs/layout` | `createLayout`, `AutoLayout` |
| `animejs/utils` | all utils (flat) |
| `animejs/svg` | `createMotionPath`, `createDrawable`, `morphTo` |
| `animejs/text` | `splitText`, `split`, `TextSplitter`, `scrambleText` |
| `animejs/waapi` | `waapi`, `WAAPIAnimation` |
| `animejs/easings` | all easing factories + `eases` + `Spring`/`spring`/`createSpring` |
| `animejs/easings/eases` | `eases` only |
| `animejs/easings/spring` | `Spring`, `spring`, `createSpring` |
| `animejs/easings/linear` \| `/steps` \| `/irregular` \| `/cubic-bezier` | `linear` / `steps` / `irregular` / `cubicBezier` |

```js
import { animate } from 'animejs/animation';   // smallest possible bundle
import { cubicBezier } from 'animejs/easings/cubic-bezier';
```

## API — Complete export inventory (v4.4.1)

Verified against the UMD bundle export tail and `src/index.js`. Everything below is importable flat from `'animejs'`.

### Factory functions (the core API)

| Export | Signature | Returns |
|---|---|---|
| `animate` | `animate(targets, params)` | `JSAnimation` (autoplays by default) |
| `createTimer` | `createTimer(params?)` | `Timer` |
| `createTimeline` | `createTimeline(params?)` | `Timeline` |
| `createAnimatable` | `createAnimatable(targets, params)` | `AnimatableObject` (prop getter/setters) |
| `createDraggable` | `createDraggable(target, params?)` | `Draggable` |
| `createScope` | `createScope(params?)` | `Scope` (root / defaults / mediaQueries) |
| `createLayout` | `createLayout(root, params?)` | `AutoLayout` (FLIP-style layout anims) |
| `onScroll` | `onScroll(params = {})` | `ScrollObserver` (use as `autoplay:` value) |
| `stagger` | `stagger(val, params = {})` | stagger function for `delay`, values, tl positions |
| `waapi` | object: `waapi.animate(targets, params)`, `waapi.convertEase(ease)` | `WAAPIAnimation` |

### Classes (also exported, for `instanceof` / subclassing)

`Timer`, `JSAnimation`, `Timeline`, `Animatable`, `Draggable`, `Scope`, `ScrollObserver`, `AutoLayout`, `TextSplitter`, `WAAPIAnimation`, `Spring`.

### Easings (flat exports; also under the `easings` namespace export)

| Export | Signature (defaults from source) | Notes |
|---|---|---|
| `eases` | object of every named ease fn: `eases.outQuad`, `eases.inOutBack(1.7)`, … | string `ease: 'outQuad'` works without importing |
| `cubicBezier` | `cubicBezier(mX1 = 0.5, mY1 = 0.0, mX2 = 0.5, mY2 = 1.0)` | returns `EasingFunction` |
| `steps` | `steps(steps = 10, fromStart?)` | |
| `linear` | `linear(...args)` | CSS `linear()`-style points |
| `irregular` | `irregular(length = 10, randomness = 1)` | |
| `spring` / `createSpring` | `createSpring({ mass=1, stiffness=100, damping=10, velocity=0, bounce=0, duration=0, onComplete })` | returns `Spring`; pass instance to `ease:` |

### `utils` namespace (every member is ALSO a flat top-level export)

| Group | Members |
|---|---|
| DOM/targets | `$` (registerTargets), `get(target, prop, unit?)`, `set(targets, params)`, `remove(targets, renderable?, propName?)`, `cleanInlineStyles(renderable)` |
| Random | `random(min=0, max=1, decimalLength=0)`, `createSeededRandom(seed, min=0, max=1, decimalLength=0)`, `randomPick(items)`, `shuffle(items)` |
| Chainable math | `clamp`, `round`, `roundPad`, `padStart`, `padEnd`, `wrap`, `mapRange`, `lerp`, `damp`, `snap`, `degToRad`, `radToDeg` — each is callable directly **or** partially applied: `utils.round(2)` returns a modifier fn (`src/utils/chainable.js`) |
| Time | `sync(callback)` (run on next engine tick), `keepTime(constructor)` |
| Internal linked-list | `forEachChildren`, `addChild`, `removeChild` (rarely needed) |

### `svg` namespace (members also flat)

| Member | Signature | Use |
|---|---|---|
| `createDrawable` | `svg.createDrawable(selector)` | returns proxied geometry els with a `draw` property: `animate(drawable, { draw: '0 1' })` |
| `createMotionPath` | `svg.createMotionPath(pathSelector)` | returns `{ translateX, translateY, rotate }` function values |
| `morphTo` | `svg.morphTo(shapeTarget, precision?)` | use as value: `animate(poly, { points: svg.morphTo(poly2) })` |

### `text` namespace (members also flat)

`splitText(target, params)` → `TextSplitter` (`lines`/`words`/`chars` options), `split` (alias factory), `TextSplitter`, `scrambleText(params = {})` (scramble reveal effect; chars/cursor/revealRate options — see `src/text/scramble.js`).

### Engine & globals

| Export | Key members (from `src/engine/engine.js`, `src/core/globals.js`) |
|---|---|
| `engine` | `engine.speed` (get/set, like v3 `anime.speed`), `engine.timeUnit` (`'ms'`\|`'s'`), `engine.precision`, `engine.fps`, `engine.pauseOnDocumentHidden = true`, `engine.pause()/resume()/update()` |
| `globals` | `globals.defaults` (mutable global defaults object), `globals.precision = 4`, `globals.timeScale`, `globals.tickThreshold = 200` |
| `scrollContainers` | `Map` of active scroll containers (advanced) |

### Built-in global defaults (`src/core/globals.js`)

`duration: 1000` · `delay: 0` · `loopDelay: 0` · `ease: 'out(2)'` · `loop: 0` · `alternate: false` · `reversed: false` · `autoplay: true` · `composition: 'replace'` · `playbackRate: 1` · `frameRate: 240` · `modifier: v => v` · all callbacks `noop`. Override per-call, per-timeline (`defaults: {}`), per-scope, or globally via `globals.defaults`.

## v3 → v4 Migration

| v3 | v4 |
|---|---|
| `import anime from 'animejs'` | `import { animate, ... } from 'animejs'` (no default export) |
| `anime({ targets: '.el', translateX: 250 })` | `animate('.el', { translateX: 250 })` — targets is the 1st arg |
| `translateX/translateY/translateZ` | still work; shorthands `x`, `y`, `z` added |
| `easing: 'easeOutQuad'` | `ease: 'outQuad'` (param renamed, `ease` prefix dropped) |
| `easing: 'spring(1, 80, 10, 0)'` | `ease: spring({ mass: 1, stiffness: 80, damping: 10, velocity: 0 })` — `createSpring` is a deprecated alias; the spring instance overrides the tween's `duration` with its `settlingDuration` |
| `easing: 'steps(5)'` / `'cubicBezier(...)'` strings | import the fn: `ease: steps(5)`, `ease: cubicBezier(.4,0,.2,1)` — string forms warn + fall back to `none` (`src/easings/eases/parser.js`) |
| `translateX: [0, 100]` (from→to array) | still works: a 2-value array of non-objects is `{to: [from, to]}` (`src/animation/animation.js:311`); 3+ values become keyframes. `{ from: 0, to: 100 }` is the explicit form |
| `direction: 'reverse'` | `reversed: true` |
| `direction: 'alternate'` | `alternate: true` (combine with `loop`) |
| `loop: true` / `loop: 3` | same, but a "loop" no longer counts the first play: v3 `loop: 3` ≈ v4 `loop: 2` |
| `begin:`, `update:`, `complete:`, `loopBegin/loopComplete:`, `change*:` | `onBegin:`, `onUpdate:`, `onComplete:`, `onLoop:`, `onPause:`, `onBeforeUpdate:`, `onRender:` |
| `animation.finished.then(...)` | `animation.then(callback)` — the instance is thenable; `await animate(...)` works; check `animation.completed` |
| `anime.timeline({ duration: 500 })` | `createTimeline({ defaults: { duration: 500 } })` — child defaults go under `defaults` |
| `tl.add({ targets: '.el', x: 100 }, 200)` | `tl.add('.el', { x: 100 }, 200)` — positions: number, `'+=100'`, `'-=100'`, `'*=.5'`, `'<'`, `'<<'`, `'<<+=250'`, `'label'` |
| `anime.stagger(100, { from: 'center' })` | `stagger(100, { from: 'center' })` (named import; same options + `ease`, `grid`, `axis`, `use`, `total`) |
| `anime.set('.el', { x: 50 })` | `utils.set('.el', { x: 50 })` |
| `anime.get(el, 'width')` | `utils.get(el, 'width')` |
| `anime.remove('.el')` | `utils.remove('.el')` |
| `anime.random(0, 100)` | `utils.random(0, 100)` |
| `round: 100` param | `modifier: utils.round(2)` (chainable utils as modifiers) |
| `anime.path('svg path')` + `translateX: path('x')` | `const { translateX, translateY, rotate } = svg.createMotionPath('svg path')` then spread into `animate()` |
| `strokeDashoffset: [anime.setDashoffset, 0]` | `animate(svg.createDrawable('path'), { draw: '0 1' })` |
| `points: '...'` polygon morph | `points: svg.morphTo(targetPoly)` |
| `anime.speed = .5` | `engine.speed = .5` |
| `anime.suspendWhenDocumentHidden = false` | `engine.pauseOnDocumentHidden = false` |
| `anime.running` | `engine` children (no direct equivalent; use Scope to track) |
| `animation.restart()/play()/pause()/reverse()/seek(t)` | same names, still there |

## Examples

```js
// 1. Basic animation with stagger (README usage example)
import { animate, stagger } from 'animejs';

animate('.square', {
  x: 320,
  rotate: { from: -180 },          // from-to object replaces v3 value arrays
  duration: 1250,
  delay: stagger(65, { from: 'center' }),
  ease: 'inOutQuint',
  loop: true,
  alternate: true,
});
```

```js
// 2. Timeline with labels and relative positions
import { createTimeline } from 'animejs';

const tl = createTimeline({ defaults: { duration: 600, ease: 'outExpo' } });
tl.label('start')
  .add('.hero-title', { opacity: { from: 0 }, y: { from: 40 } }, 'start')
  .add('.hero-sub',   { opacity: { from: 0 } }, '-=300')   // 300ms before previous end
  .add('.hero-cta',   { scale: { from: .8 } }, '<');        // at previous end
```

```js
// 3. Utils as setters and modifiers + await completion
import { animate, utils } from 'animejs';

utils.set('.dot', { scale: 0, opacity: 0 });               // v3 anime.set
await animate('.dot', {
  scale: 1, opacity: 1,
  delay: (el, i) => utils.random(0, 400),                  // function values get (target, i, targets)
  modifier: utils.round(2),                                // chainable util partially applied
});                                                        // thenable — replaces v3 .finished
console.log('done');
```

```js
// 4. Scroll-driven + SVG line drawing
import { animate, onScroll, svg } from 'animejs';

animate(svg.createDrawable('.logo path'), {
  draw: ['0 0', '0 1'],
  ease: 'inOutQuad',
  autoplay: onScroll({ target: '.logo', enter: 'bottom top', sync: true }),
});
```

```js
// 5. UMD global usage (no bundler)
// <script src="https://cdn.jsdelivr.net/npm/animejs@4.4.1/dist/bundles/anime.umd.min.js"></script>
anime.animate('#box', { rotate: 360, ease: anime.eases.outBack(1.7) });
anime.utils.set('#box', { transformOrigin: '50% 50%' });
```

## Gotchas

- **No default export, not callable.** `import anime from 'animejs'` then `anime({...})` is the #1 v3 habit that breaks. UMD keeps the `anime` global name but only as a namespace object.
- **Value arrays: 2-value arrays still mean from→to** (`x: [0, 100]` works in v4 exactly like v3); arrays with 3+ values are keyframes. Never use `fromTo` — it exists in the TS types but `JSAnimation` never reads it (dead code).
- **`ease`, not `easing`**, and names drop the `ease` prefix: `'outQuad'`, `'inOutExpo'`, parametric strings `'out(2)'`, `'outBack(1.7)'`, `'outElastic(1, .3)'` allowed. Strings `'steps(...)'`, `'linear(...)'`, `'irregular(...)'`, `'cubicBezier(...)'` were **removed from string parsing** — they log a console.warn and resolve to `none`; import the functions instead (`src/easings/eases/parser.js` `deprecated` list).
- **Default ease is `'out(2)'` and default duration 1000ms** (`src/core/globals.js`) — not v3's `'easeOutElastic'`/1000. Timer/animation `frameRate` cap defaults to 240 fps.
- **Loop semantics:** `loop: 1` means 1 extra repetition (2 plays total); v3 counted total iterations differently.
- **`.finished` is gone.** Instances implement `.then()` directly (already-completed instances resolve immediately; `then` is nulled during resolution to avoid recursion — `src/timer/timer.js:507`). `await` any Timer/Animation/Timeline.
- **Timeline child defaults must live in `defaults: {}`** — top-level params on `createTimeline()` configure the timeline itself (loop, autoplay...), not its children.
- **Flat + namespaced duplicates:** `utils.*`, `svg.*`, `text.*`, `easings.*` members are ALSO exported flat (`export * from` + `export * as` in `src/index.js`). `import { random } from 'animejs'` and `utils.random` are the same function. Beware naming collisions when wildcard-importing.
- **`engine.pauseOnDocumentHidden` defaults to `true`** — animations pause in hidden tabs (v3's `suspendWhenDocumentHidden`). Set to `false` for clock-synced work.
- **Tree-shaking:** package is `"sideEffects": false`; for hard size budgets import from subpaths (`animejs/animation`, `animejs/easings/spring`) rather than the root.
- **React/SSR:** the lib touches `window`/`document` only behind `isBrowser` guards, but `createScope({ root: ref })` + its cleanup return is the intended React integration; call `scope.revert()` on unmount.
