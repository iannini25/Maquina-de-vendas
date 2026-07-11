# animate() — anime.js v4 core animation

Source: `vendor/anime/src/animation/animation.js` (class `JSAnimation extends Timer`), `src/core/values.js`, `src/core/targets.js`, `src/animation/composition.js`, `src/animation/additive.js`.

## Import

```js
import { animate, JSAnimation } from 'animejs';
// commonly paired with:
import { animate, stagger, utils, createSpring } from 'animejs';
```

## API

```ts
animate(targets: TargetsParam, parameters: AnimationParams): JSAnimation
```

`animate()` instantiates `new JSAnimation(targets, parameters).init()` and (by default) autoplays on the global engine. The returned instance is thenable (`await animate(...)` resolves on complete).

### Targets (`TargetsParam`)

Parsed by `registerTargets()` (vendor/anime/src/core/targets.js): flattened `Infinity`-deep and **deduplicated**.

| Form | Example | Notes |
|---|---|---|
| CSS selector string | `'.square'`, `'#id li'` | `querySelectorAll` on `document` (or scope root inside `createScope`) |
| DOM / SVG element | `document.querySelector('.el')` | |
| NodeList / HTMLCollection | `el.children` | expanded |
| Plain JS object | `{ value: 0 }` | any own property is animatable (OBJECT tween type) |
| Array mix of the above | `['.a', el, nodeList, obj]` | flattened + deduped |

Zero matched targets → `console.warn('No target found...')`; animation is still created (duration `1e-11`, `iterationCount = 0`), it does not throw.

### Which param keys are animated?

A key is an **animatable property** iff it is *not* a key of `globals.defaults` (`isKey = a => !globals.defaults.hasOwnProperty(a)`, src/core/helpers.js). Reserved (non-animated) names are exactly:

```
id keyframes playbackEase playbackRate frameRate loop reversed alternate autoplay
persist duration delay loopDelay ease composition modifier
onBegin onBeforeUpdate onUpdate onLoop onPause onComplete onRender
```

Everything else becomes a tween. Property type resolution (`getTweenType`, src/core/values.js), in order:

| Check | Tween type | Applied via |
|---|---|---|
| target is not DOM | OBJECT | `target[prop] = value` |
| SVG element + valid SVG attribute | ATTRIBUTE | `setAttribute` |
| `perspective translateX/Y/Z rotate rotateX/Y/Z scale scaleX/Y/Z skew skewX/Y` or shorthands `x→translateX y→translateY z→translateZ` | TRANSFORM | individual props cached, full `transform` string rebuilt per frame |
| starts with `--` | CSS_VAR | `style.setProperty` |
| `prop in target.style` | CSS | `style[prop] = value` (camelCase auto-dashed) |
| `prop in target` | OBJECT | DOM property (`scrollTop`, `value`, …) |
| fallback | ATTRIBUTE | `setAttribute` |

### Tween value forms (per property)

| Form | Example | Meaning |
|---|---|---|
| single value | `x: 320` | to-tween, `from` = current computed/inline value |
| string + unit | `width: '50vw'` | UNIT value type |
| relative | `x: '+=100'`, `'-=50'`, `'*=2'` | operator applied against current value (or previous keyframe's to-value) |
| color | `'#FFF' '#FFFC' 'rgb()' 'rgba()' 'hsl()' 'hsla()'` | always rendered as `rgba(r,g,b,a)` |
| complex string | `filter: 'blur(10px)'`, `d: 'M0 0 L100 50'` | every number interpolated, strings kept |
| CSS variable ref | `x: 'var(--offset, 10px)'` | resolved via `getComputedStyle`, fallback supported |
| `[from, to]` (2 non-object items) | `scale: [0, 1]` | fromTo tween |
| `[a, b, c, ...]` (>2 plain values) | `x: [0, 100, 50]` | keyframes: `[a,b]` then `c`… |
| object | `rotate: { from: -180 }`, `{ to: 100, from: 0, duration, delay, ease, modifier, composition }` | per-property params |
| array of objects | `x: [{to: 100, ease: 'out'}, {to: 0, delay: 100}]` | keyframe array |
| function | `(target, index, targets, prevTween) => value` | evaluated per target; may return object syntax `{to: v}` |

Function-based values: return of `undefined/null/false/NaN` falls back to `0`; numeric strings are coerced to numbers (`'100'` → `100`, `'100px'` stays a string) — src/core/values.js `getFunctionValue`.

### Per-property tween parameters (`TweenParamsOptions & TweenValues`)

Usable at top level (applies to all properties) **or** inside a per-property object / keyframe:

| Param | Type | Default | Description |
|---|---|---|---|
| `to` | `TweenParamValue \| [v, v]` | — | end value |
| `from` | `TweenParamValue` | current value | start value |
| `duration` | `number \| fn` | animation `duration` (1000); per keyframe: `duration / keyframeCount` | tween duration ms |
| `delay` | `number \| fn` | animation `delay` (0) — **only on the first keyframe**, later keyframes default to 0 | |
| `ease` | string \| fn \| Spring | animation `ease` (`'out(2)'`) | Spring overrides duration with `settlingDuration` |
| `modifier` | `(v: number) => number\|string` | `v => v` | post-ease value transform; **does not accept function-based (per-target) values** |
| `composition` | `'replace' \| 'none' \| 'blend'` | `'replace'` | see Composition below |

`fromTo` appears in the TS types but **is never read by `JSAnimation`** (only the WAAPI module uses it) — use `prop: [from, to]` or `{from, to}`.

### Playback settings (`TimerOptions & AnimationOptions`)

Defaults from `globals.defaults` (vendor/anime/src/core/globals.js):

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `number\|string` | auto-increment | |
| `duration` | `number \| fn` | `1000` | per-iteration duration (ms) |
| `delay` | `number \| fn` | `0` | initial delay |
| `loop` | `number\|boolean` | `0` | **extra** iterations: `loop: 2` plays 3×; `true`/`Infinity`/negative → infinite |
| `loopDelay` | `number` | `0` | pause between iterations |
| `alternate` | `boolean` | `false` | ping-pong direction each iteration |
| `reversed` | `boolean` | `false` | start backwards |
| `autoplay` | `boolean \| ScrollObserver` | `true` | `onScroll()` instance allowed |
| `frameRate` | `number` | `240` (maxFps) | per-animation fps cap |
| `playbackRate` | `number` | `1` | speed multiplier |
| `ease` | `EasingParam` | `'out(2)'` | default per-tween ease |
| `playbackEase` | `EasingParam` | `null` | ease mapped over whole animation progress; when set, per-tween ease defaults to `'linear'` |
| `composition` | `'replace'\|'none'\|'blend'` | `'replace'`; auto-`'none'` when ≥1000 targets and not specified | |
| `modifier` | `(v) => v` | identity | |
| `keyframes` | array or `%` object | `null` | see Keyframes |

### Callbacks

All receive the animation instance as first arg (`Callback<JSAnimation>`):

| Callback | Fires |
|---|---|
| `onBegin` | first time currentTime > 0 |
| `onBeforeUpdate` | every tick, before rendering |
| `onUpdate` | every tick |
| `onRender` | every tick where a visual value was actually written |
| `onLoop` | each iteration end (when looping) |
| `onPause` | on pause/interruption (incl. being replaced) |
| `onComplete` | end of playback |
| `then(cb)` / `await` | Promise resolved on complete |

### Instance methods & properties (`JSAnimation extends Timer`)

| Member | Signature / Type | Notes |
|---|---|---|
| `play()` / `pause()` / `resume()` / `restart()` | `(): this` | |
| `reverse()` / `alternate()` | `(): this` | flip direction |
| `seek(time, muteCallbacks?, internalRender?)` | `(ms): this` | |
| `complete(muteCallbacks?)` | `(): this` | jump to end + onComplete |
| `cancel()` | `(): this` | remove from engine, release composition lookups |
| `revert()` | `(): this` | cancel **and restore original inline styles/attributes** (removes props that had no inline value) |
| `refresh()` | `(): this` | re-evaluate function-based `from`/`to` values in place (pair with `.restart()`). **Two traps, both verified against source:** (1) **CRASH** — a function returning an OBJECT (`() => ({ from: a, to: b })`) only works at parse time; `refresh()` feeds the raw return into `decomposeRawValue` (`src/core/values.js:184`) → `TypeError: str.includes is not a function`. (2) **SILENT DRIFT** — `{ from: fn, to: fn }` object syntax never registers the from-function (`src/animation/animation.js:373` passes a `null` store; only the tuple branch at `:419` captures both), so `refresh()` falls back to the *current* value as from and the property tweens old→new across the next iteration instead of pinning. **To re-pin a constant-per-cycle random value, use TUPLE syntax `prop: [fn, fn]`** (both functions returning plain Number/String), or store randoms in `onLoop` before `refresh()` and read them from plain-returning functions (recipes.md "re-randomize per cycle" idiom) |
| `stretch(newDuration)` | `(ms): this` | rescale all tween timings |
| `targets` | `TargetsArray` | parsed targets |
| `duration` / `iterationDuration` | `number` | total (incl. loops) / single iteration |
| `progress` / `iterationProgress` | `number` 0–1 get/set | |
| `currentTime` / `iterationCurrentTime` | `number` get/set | |
| `currentIteration` | `number` get/set | |
| `reversed`, `paused`, `began`, `completed`, `cancelled` | `boolean` | |

## Keyframes

**Array syntax** (`DurationKeyframes`) — each entry can hold several properties plus per-keyframe `duration/delay/ease`; default keyframe duration = `duration / keyframes.length`:

```js
animate('.box', {
  keyframes: [
    { y: -40, duration: 400, ease: 'out(3)' },
    { x: 250 },                 // unspecified duration = total/count = 3000/3 = 1000
    { y: 0, x: 0, delay: 100 },
  ],
  duration: 3000,
});
```

**Percentage syntax** (`PercentageKeyframes`) — offsets sorted numerically, durations derived from offsets × total `duration`. A keyframe's `ease` applies to the segment **after** it (WAAPI semantics, see "Emulate WAPPI easing parameter position" in `generateKeyframes`):

```js
animate('.dot', {
  keyframes: {
    '0%'  : { x: 0,   y: 0 },
    '50%' : { x: 100, y: 50, ease: 'inOut(3)' }, // ease used for 50% → 100%
    '100%': { x: 200, y: 0 },
  },
  duration: 2000,
});
```

## Composition modes

`compositionTypes = { replace: 0, none: 1, blend: 2 }` (src/core/consts.js). Conflict tracking is per `target + property` (WeakMap of sibling linked lists, src/animation/composition.js).

| Mode | Behavior |
|---|---|
| `'replace'` (default) | New tween truncates the running tween on the same target+property at its own start time; fully-overlapped tweens are overridden and an animation whose tweens are *all* overlapped is **`.cancel()`-ed automatically** |
| `'none'` | No bookkeeping — fastest (auto-selected for ≥1000 targets). Concurrent animations on the same property fight each other every frame |
| `'blend'` | Additive: to/from converted to deltas summed into a single global additive animation rendered each frame (src/animation/additive.js). Use for overlapping, compounding animations (hover in/out, fireflies example) |

## Examples

```js
import { animate, stagger } from 'animejs';

// 1 — README hero: transforms shorthand, from, stagger, infinite alternate loop
animate('.square', {
  x: 320,                       // → translateX: '320px' (unit inferred from default '0px')
  rotate: { from: -180 },       // animates -180deg → current value
  duration: 1250,
  delay: stagger(65, { from: 'center' }),
  ease: 'inOutQuint',
  loop: true,
  alternate: true,
});
```

```js
// 2 — function-based values, fromTo array, relative value, per-property params
animate('.particle', {
  x: (el, i, targets) => 50 + i * 25,   // number → px on transforms
  y: '-=40',                            // relative to current translateY
  scale: [0.5, 1],                      // [from, to]
  opacity: { from: 0, ease: 'linear', duration: 200 },
  delay: (_, i) => i * 50,
  duration: 800,
});
```

```js
// 3 — animate a plain JS object, await completion, then revert
import { animate, utils } from 'animejs';
const counter = { value: 0 };
const anim = animate(counter, {
  value: 1000,
  modifier: utils.round(0),             // or: v => Math.round(v)
  duration: 2000,
  ease: 'outExpo',
  onUpdate: () => { label.textContent = counter.value; },
});
await anim;                              // JSAnimation is thenable
anim.revert();                           // restore counter.value + any inline styles
```

```js
// 4 — per-property keyframes + color + CSS variable
animate('.card', {
  x: [
    { to: 120, duration: 400, ease: 'out(4)' },
    { to: 0,   duration: 600, delay: 100 },
  ],
  backgroundColor: '#4B0082',            // rendered as rgba(75,0,130,1)
  '--glow-opacity': [0, 1],              // CSS variable tween
  duration: 1000,
});
```

```js
// 5 — additive 'blend' composition for non-destructive hover
const enter = () => animate(btn, { scale: 1.6, composition: 'blend', duration: 250 });
const leave = () => animate(btn, { scale: 1.0, composition: 'blend', duration: 600 });
btn.addEventListener('mouseenter', enter);
btn.addEventListener('mouseleave', leave);
```

## Gotchas

- **v3 → v4**: no `anime({targets})`. Targets are the first argument: `animate(targets, params)`. `translateX` shorthand is `x`, easing is `ease` (not `easing`), `direction: 'alternate'` is `alternate: true`, `loop: 1` means 2 plays.
- **Any unknown key is animated.** Option typos (`Loop`, `easing`, `autoPlay`) silently become tween properties. Note `priority` is in `TimerOptions` but *not* in `globals.defaults`, so passing it to `animate()` also creates a bogus `priority` tween.
- **Default ease is `'out(2)'`**, not linear. Set `ease: 'linear'` explicitly for linear motion.
- **Transform start values come from *inline* styles only** (`parseInlineTransforms` reads `el.style.transform`; falls back to `0px`/`0deg`/`1`). Transforms declared in CSS classes are ignored as from-values — set them inline, via a previous `animate`/`utils.set`, or pass explicit `from`.
- **Transform unit inference**: plain numbers adopt the unit of the original value — `x: 100` → `'100px'`, `rotate: 90` → `'90deg'`, `scale: 2` stays unitless. Pass strings (`'5rem'`, `'0.5turn'`) for other units.
- **Unit conversion** (from/to unit mismatch) clones the element, measures `offsetWidth`, and caches by `number+fromUnit+toUnit` *globally* — results can be stale if context changes (font-size for `em`, viewport for `vw`). Angle units (`deg/rad/turn`) convert mathematically.
- **`composition: 'replace'` (default) can cancel other animations**: starting a second animation on the same target+property truncates the first; if every tween of the first becomes overlapped, it is `.cancel()`-ed. Use `'none'` to opt out or `'blend'` to combine.
- ≥1000 targets with no explicit `composition` silently switches to `'none'` (perf, src/animation/animation.js, `targetsLength >= K`).
- **`fromTo` is type-only for `animate()`** — `JSAnimation` reads only `to`/`from`. Use `prop: [from, to]`.
- **`modifier` cannot be function-based per target** (source comment: "Modifiers are treated differently and don't accept function based value").
- **`delay` only applies to a property's first keyframe**; subsequent keyframes default to delay 0. The smallest tween start time is hoisted into the animation's `_delay` (delay trimming at end of constructor).
- Percentage-keyframe `ease` applies to the **following** segment, not the preceding one.
- `duration: 0` becomes `1e-11` (`minValue`) — an instant "setter" animation; `refresh()` calls `restart()` on such setters to re-render them.
- **Colors always render as `rgba()`** strings (hex incl. `#rgba`/`#rrggbbaa`, `rgb/hsl(a)` parsed); animating `backgroundColor` to a CSS keyword like `'red'` is not parsed as a color (treated as COMPLEX with no numbers).
- Computed CSS value `'auto'` is read as `'0'` (`getCSSValue`).
- `autoplay: false` + any `from`/`[from,to]` value triggers one immediate render so targets jump to the from-state without playing (`shouldTriggerRender`).
- **Cleanup**: `pause()` keeps tweens in composition lookups; call `cancel()` to detach or `revert()` to also restore original inline styles/attributes (removes the `style` attribute if it ends up empty). In React/Vue components, `revert()` in the unmount/cleanup phase.
- Function-based value returning `undefined/null/false/NaN` silently becomes `0`; numeric strings coerce to numbers.
- Strings are interpolated number-by-number with rounding to `globals.precision` (4 decimals) on in-between frames only; pure-number OBJECT tweens are never rounded.
