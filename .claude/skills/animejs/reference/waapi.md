# waapi — Hardware-Accelerated Web Animations API Module

`waapi.animate()` is the WAAPI-backed sibling of the JS `animate()`. It creates **one native
`Element.animate()` Animation per target × per property**, so transforms/opacity run on the
compositor (off main thread) and keep playing even when the main thread is busy. The API surface
is a deliberately smaller subset of the JS engine — see the support matrix below.

Source: `vendor/anime/src/waapi/waapi.js`, `vendor/anime/src/waapi/composition.js`.

## Import

```js
import { waapi, stagger, onScroll } from 'animejs';
// or subpath:
import { waapi, WAAPIAnimation } from 'animejs/waapi';

const anim = waapi.animate('.el', { x: 100, opacity: 0.5 });
```

Exports: `waapi` (namespace: `animate`, `convertEase`), `WAAPIAnimation` (class).

## API

```ts
waapi.animate(targets: DOMTargetsParam, params: WAAPIAnimationParams): WAAPIAnimation
waapi.convertEase(fn: EasingFunction, samples = 100): string   // → CSS "linear(0, …, 1)" string
```

Targets must be **DOM elements / CSS selectors only** (no JS-object targets — there is no fallback;
values are written via `$el.animate()` keyframes).

### Animation parameters (`WAAPIAnimationParams`)

Any key **not** present in `globals.defaults` is treated as an animated property
(`isKey = a => !globals.defaults.hasOwnProperty(a)`, src/core/helpers.js). Reserved options:

| Param | Type | Default | Description |
|---|---|---|---|
| `duration` | `Number \| (el,i,targets)=>Number` | `1000` (globals) | ms. **Overridden by `spring.settlingDuration` when ease is a spring.** |
| `delay` | `Number \| (el,i,targets)=>Number` | `0` | ms. `stagger(...)` works (it's a function value). |
| `ease` | `String \| Function \| Spring \| (el,i,targets)=>ease` | `'out(2)'` (globals) | Converted to a CSS easing string — see "Easing conversion". |
| `loop` | `Number \| Boolean` | `0` | `iterations = loop + 1`; `true`/`Infinity` → `Infinity`. **No `loopDelay`.** |
| `alternate` | `Boolean` | `false` | Maps to WAAPI `direction: 'alternate'` / `'alternate-reverse'`. |
| `reversed` | `Boolean` | `false` | Maps to `direction: 'reverse'`. |
| `autoplay` | `Boolean \| ScrollObserver` | `true` | Pass `onScroll(...)` to scroll-link (`.link(this)` is called). |
| `playbackRate` | `Number` | `1` | Initial `Animation.playbackRate` for all child animations. |
| `composition` | `'replace' \| 'add' \| 'accumulate'` | `'replace'` | Native WAAPI `composite` operation — **not** the JS engine's `'none'/'blend'`. |
| `persist` | `Boolean` | `false` | If `true`, `onfinish` cleanup is NOT bound: animations never auto-commit/cancel — and **`onComplete`/`then()` never fire**. |
| `onComplete` | `(self: WAAPIAnimation) => void` | `noop` | **The ONLY callback.** `onUpdate/onBegin/onLoop/onRender/...` are silently ignored (they're in defaults, so skipped as keys, but never wired). |

All durations/delays are multiplied by 1000 when the global clock is in seconds mode
(`globals.timeScale !== 1`); WAAPI always runs in ms.

### Per-property tween options (`WAAPITweenOptions`)

A property value may be an object: `{ to, from, duration, delay, ease, composition }`
(each falls back to the animation-level value). **No `onUpdate`, no `modifier`, no keyframe
percentages** at this level.

### Animated property values (`WAAPIKeyframeValue`)

| Form | Example | Behavior |
|---|---|---|
| Number | `x: 100` | Auto-unit applied (table below). |
| String | `width: '50vw'` | Used **verbatim** — never resolved as a function value, so `'var(--size)'`, `calc()`, units all pass through (src/waapi/waapi.js `normalizeTweenValue` comment). |
| Function | `y: (el, i) => i * 50` | Resolved per target `(target, index, targets)`. |
| Array | `x: [0, 100, 50]` | WAAPI keyframe list (equal spacing). |
| `{ from, to }` | `opacity: { from: 0 }` | `from`-only reads current end via `getComputedStyle`; with `from` set, the element's inline style is immediately snapped to the `from` value. |

### Auto-units for plain numbers (`normalizeTweenValue`)

| Properties | Unit appended |
|---|---|
| `x`, `y`, `z`, `translate*`, `perspective`, `width`, `height`, `margin`, `padding`, `top`, `right`, `bottom`, `left`, `borderWidth`, `fontSize`, `borderRadius` | `px` |
| `rotate*`, `skew*` | `deg` |
| everything else (`scale*`, `opacity`, `letterSpacing`, …) | none — pass a string if a unit is needed |

### Individual transforms (`x`, `y`, `z`, `translateX`, `rotateZ`, `scale`, …)

Mechanism (constructor, src/waapi/waapi.js):

1. Once per page, every transform in `validTransforms` is registered as a **typed CSS custom
   property** via `CSS.registerProperty({ name: '--translateX', syntax: '<length-percentage>', ... })`
   (angles for rotate/skew, `<number>` for scale; initial values `0px` / `0deg` / `1`).
2. The keyframes animate `--translateX` etc., and the element's **inline `style.transform` is
   overwritten** with `translateX(var(--translateX)) scale(var(--scale)) …` (insertion order).
3. Trigger: the var-mechanism activates only if params contain a member of
   `validIndividualTransforms` = `x|y|z` + any transform ending in `X|Y|Z`
   (`translateX..Z, rotateX..Z, scaleX..Z, skewX/Y`). Once triggered, **all** transform params
   (incl. bare `rotate`, `scale`) route through CSS vars.
4. Without the trigger, bare `rotate` / `scale` animate the native CSS `rotate` / `scale`
   properties (fine), but bare `skew` would target a non-existent `skew` CSS property — pair it
   with an axis transform or use `skewX`.

Valid transforms: `perspective, translateX/Y/Z, rotate, rotateX/Y/Z, scale, scaleX/Y/Z, skew, skewX/Y`;
shorthands `x→translateX, y→translateY, z→translateZ`.

### Easing conversion (`parseWAAPIEasing`)

| Input | Result |
|---|---|
| `'linear'`, `'ease'`, `'ease-in...'`, `'cubic-bezier(...)'`, `'steps(...)'` | passed through natively |
| `'cubicBezier(.5,0,.5,1)'` (anime spelling) | lowercased → `cubic-bezier(...)` |
| any other anime ease string (`'out(2)'`, `'inOutQuad'`, `'outElastic(1,.5)'`, …) | parsed, then sampled into `linear(p0, …, p100)` — 101 points, cached per string |
| Function `t => …` | `easingToLinear(fn)` → `linear(...)` |
| Spring (`createSpring()`) | `linear(...)` **and `duration` is forced to `spring.settlingDuration`** |
| unknown / invalid | `'linear'` |

`waapi.convertEase` is `easingToLinear` — use it to feed anime eases to raw `el.animate()` calls.

## WAAPIAnimation — properties & methods

| Member | Type / Signature | Notes |
|---|---|---|
| `targets` | `Array<HTMLElement>` | parsed targets |
| `animations` | `Array<Animation>` | one native Animation per target × property |
| `controlAnimation` | `Animation` | the longest child (`delay + duration*iterations`); drives `currentTime` |
| `duration` | `Number` | max total child duration; `Infinity` when `loop: true` |
| `paused / completed / reversed / persist` | `Boolean` | state flags |
| `speed` | get/set | sets `playbackRate` on every child |
| `currentTime` | get/set (ms) | setter calls `anim.play()` first when seeking ≥ duration so `onfinish` fires |
| `progress` | get/set 0–1 | `NaN`/useless when `duration === Infinity` |
| `play()` / `reverse()` | `this` | un-reverse / reverse then `resume()` |
| `pause()` / `resume()` | `this` | resume has a TODO: it re-`play()`s, it does NOT restore the exact paused position guarantee |
| `alternate()` | `this` | toggles direction in place |
| `seek(time, muteCallbacks=false)` | `this` | |
| `restart()` / `complete()` | `this` | `seek(0,true).resume()` / `seek(duration)` |
| `commitStyles()` | `this` | calls native `commitStyles()` on every child |
| `cancel()` | `this` | mutes callbacks, commits styles, cancels all, empties `animations`, removes leftover inline `transform: none` next rAF |
| `revert()` | `this` | `cancel()` + restores inline styles captured at construction (uses kebab-cased `removeProperty`) |
| `forEach(cb \| 'methodName')` | `this` | run a fn or a named method on every native Animation |
| `then(cb?)` | `Promise` | resolves on completion (never with `persist: true`) |

## Lifecycle & composition (src/waapi/composition.js)

- Global linked-list lookup keyed by `($el, property)`. Creating a new WAAPI animation on the same
  target+property **commits the old animation's styles, cancels it**, and (if its parent is then
  fully done) fires that parent's `onComplete` — i.e. last-write-wins replacement across instances.
- Each child gets `onfinish/oncancel/onremove → commitStyles() + cancel()`. So finished values are
  written to **inline styles** and the Animation object is released. `fill` is always `'both'`.
- `persist: true` skips the `onfinish` handler: the native Animation stays alive (no inline-style
  commit, no memory release, no completion callback). Use for animations you'll keep seeking.

## Examples

```js
import { waapi, stagger } from 'animejs';

// Staggered entrance — transforms + opacity fully off main thread
waapi.animate('.card', {
  y: { from: 40 },                 // 40 → 0px (current value)
  opacity: { from: 0 },
  duration: 600,
  delay: stagger(80),
  ease: 'out(3)',                  // converted to CSS linear(...)
});
```

```js
// Spring ease: duration comes from the spring, not from `duration`
import { waapi, createSpring } from 'animejs';
waapi.animate('#logo', {
  scale: [1, 1.25, 1],             // keyframe array
  rotate: 360,                     // bare rotate alone → native CSS `rotate` property
  ease: createSpring({ stiffness: 120, damping: 9 }),
});
```

```js
// Per-property overrides + function-based values
waapi.animate('.dot', {
  x: (el, i) => i * 120,                       // number → px
  backgroundColor: { to: '#4B0082', duration: 300 }, // strings pass through verbatim
  rotate: { to: '1turn', ease: 'inOut(4)', delay: 200 },
  loop: 2,                                     // = 3 iterations
  alternate: true,
  onComplete: self => self.revert(),
});
```

```js
// Scroll-linked WAAPI animation
import { waapi, onScroll } from 'animejs';
waapi.animate('.hero-img', {
  y: -120,
  autoplay: onScroll({ target: '.hero', sync: true }),
});
```

```js
// Reuse anime eases in vanilla element.animate()
import { waapi } from 'animejs';
el.animate({ translate: '0 -100px' }, {
  duration: 500,
  easing: waapi.convertEase(t => 1 - Math.pow(1 - t, 4)),
});
```

## Gotchas

- **`onComplete` is the only callback.** `onUpdate`, `onBegin`, `onLoop`, `onRender`,
  `onPause`, `modifier` are accepted silently and ignored (filtered out by `isKey` because they
  live in `globals.defaults`, but never wired). Need them → use the JS `animate()`.
- **No timeline membership, no SVG-attribute tweens, no JS-object targets, no `keyframes` array
  param, no percentage keyframes, no `loopDelay`** — value arrays are the only multi-keyframe form.
- **Individual transforms need `CSS.registerProperty`** (typed `@property`). Where unsupported the
  flag `transformsPropertiesRegistered` stays `false` and custom-property keyframes won't
  interpolate (source comment: "fallback to no animation").
- **Inline `transform` is overwritten** when individual transforms are used; and `revert()` restores
  the *entire* transform inline style — the source itself warns that reverting one animation
  clobbers other animations sharing transforms on the same target (comment in `revert()`).
- **Same target+property across any two `waapi.animate()` calls = replace**: the older child is
  style-committed and cancelled immediately (composition.js `removeWAAPIAnimation`), which can fire
  the older parent's `onComplete` early.
- **Spring eases override `duration`** with `spring.settlingDuration` (both at animation and
  per-property level).
- **String values bypass function/`var()` resolution on purpose** — `'var(--x)'` is kept literal in
  the keyframe (good for CSS-variable-driven values); numbers get auto-units (`px`/`deg` table
  above); `scale` and unknown props get **no unit**.
- **`composition` here means the native WAAPI `composite`** (`'replace' | 'add' | 'accumulate'`),
  not anime's `'none'/'blend'`.
- **`persist: true` ⇒ `onComplete` and `then()` never resolve** (animations "never finish").
- **`loop: n` plays n+1 iterations**; `loop: true` → `duration = Infinity`, so `progress` is
  meaningless and `complete()` would seek to Infinity.
- Finished animations **commit to inline styles then cancel** (`fill: 'both'` + auto
  `commitStyles`), so end-state persists via the `style` attribute, not a live Animation. Call
  `revert()` to clean up the element.
- Prefer `waapi.animate()` for `opacity` + transforms (compositor thread, survives main-thread
  jank); prefer JS `animate()` for everything driven, sequenced, or observed per-frame.
