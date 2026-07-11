# anime.js v4 — `stagger()` & `utils` Reference

Verified against anime.js **v4.4.1** source (`vendor/anime/src/utils/*`, `vendor/anime/dist/modules/utils/*.d.ts`).

## Import

```js
import { stagger, utils } from 'animejs';

// Every util is ALSO a top-level named export (src/index.js does
// `export * from './utils/index.js'` AND `export * as utils`):
import { clamp, random, shuffle, keepTime } from 'animejs'; // equivalent to utils.*
```

---

## `stagger(value, params?)`

```ts
function stagger(val: number,            params?: StaggerParams): StaggerFunction<number>;
function stagger(val: string,            params?: StaggerParams): StaggerFunction<string>;  // '1rem' → outputs keep the unit
function stagger(val: [number, number],  params?: StaggerParams): StaggerFunction<number>;  // ranged: distribute a→b
function stagger(val: [string, string],  params?: StaggerParams): StaggerFunction<string>;

type StaggerFunction<T> = (target?, index?, targets?, prevTween?, tl?) => T;
```

The returned function is a standard **function-based value**: use it for any tween property, `delay`,
`duration`, keyframe values, or as the **position parameter** of `timeline.add()`.

### StaggerParams (from `dist/modules/types/index.d.ts` + defaults from `src/utils/stagger.js`)

| Param      | Type                                                              | Default                          | Description |
|------------|-------------------------------------------------------------------|----------------------------------|-------------|
| `start`    | `number \| string`                                                | `0`; ranged value → `val[0]`; as timeline position → `tl.iterationDuration` (current end of tl) | Base offset added to every produced value. As a timeline position it accepts position strings (`'<'`, `'<<'`, `'+=100'`, labels) parsed via `parseTimelinePosition`. |
| `from`     | `number \| 'first' \| 'center' \| 'last' \| 'random' \| [number, number]` | `0` (= `'first'`)          | Distribution origin. Number = target index. `[x, y]` = **0–1 ratios** across the grid (`fromX = from[0] * (cols - 1)`), only meaningful with `grid`. `'random'` shuffles the computed values (Fisher–Yates). |
| `reversed` | `boolean`                                                          | `undefined`                      | Inverts the distribution (`abs(max - v)`; with `axis`: flips the sign). |
| `grid`     | `[cols, rows] \| true`                                             | `undefined`                      | 2D distance staggering. `true` = **auto-grid**: measures real positions (`getBoundingClientRect()` centers for DOM, or numeric `.x`/`.y` props for JS objects), normalizes by the smallest non-zero distance; falls back to linear index distance if positions are unavailable. |
| `axis`     | `'x' \| 'y'`                                                       | `undefined`                      | Use only one (signed) axis of the grid distance instead of the Euclidean distance. |
| `ease`     | `EasingParam \| Spring`                                            | `undefined`                      | Eases the distribution curve: `v = ease(v / max) * max`. Spring instances supported (uses `spring.ease`). |
| `modifier` | `(v: number) => number \| string`                                  | `undefined`                      | Post-processes the numeric output. Runs **before** the unit is re-appended. |
| `use`      | `string \| (target, i, total) => number`                           | `undefined`                      | Derive the stagger index from a target property/attribute (read via `getOriginalAnimatableValue`, e.g. `'data-index'`) or a function. Non-numeric results fall back to the array index. |
| `total`    | `number`                                                           | `targets.length`                 | Override the total count used for distribution. |

### How the output is computed (`src/utils/stagger.js`)

```
distance[i] = |fromIndex - i|                  (linear)
            = √(dx² + dy²) or signed -dx/-dy   (grid / axis)
spacing     = val                              (single value)
            = (val2 - val1) / max(distance)    (ranged [val1, val2])
output      = start + spacing * round(distance[i], 2)   // distances rounded to 2 decimals
output      = modifier(output)                  // if provided
output      = `${output}${unit}`                // if val (or val[1] for ranges) had a unit, e.g. '1rem'
```

- **Ranged `[a, b]`**: values distribute linearly from `a` (origin) to `b` (farthest target). `start` defaults to `a`; an explicit `start` **replaces** `a` as the base (`start = params.start || (isRange ? val1 : 0)`).
- **Units** are parsed with `unitsExecRgx` from the value string (the *second* item for ranges) and appended to every output → the function returns strings like `'2.5rem'`.

### Timeline position staggering

When passed as the 3rd argument of `tl.add()`, the stagger function receives the timeline (`tl`) and
offsets **each target's insertion position**:

```js
tl.add('.item', { opacity: [0, 1] }, stagger(100));               // appended at tl end, each item +100ms apart
tl.add('.item', { y: 0 },           stagger(100, { start: 0 }));   // absolute: 0, 100, 200, ...
tl.add('.item', { y: 0 },           stagger(50, { start: '<<' })); // relative to previous animation's start
```

Default base position is `tl.iterationDuration` (the current end of the timeline) when `start` is omitted.

---

## `utils` catalog

### Targets / DOM

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `utils.$` | `$(targets)` | `TargetsArray` | Alias of internal `registerTargets`: resolves selector / Element / NodeList / array (deep-flattened) into a plain array and registers targets for animation. |
| `utils.get` | `get(targets, propName, unit?)` | `string \| number` | Reads the **current/original** animatable value of the *first* matched target (CSS prop, transform, attribute, object prop). No `unit` arg → raw value with its unit (string for DOM). `unit: false` → bare `number`. `unit: 'rem'` → converted string (only for number/unit value types). Returns `undefined` if no target. |
| `utils.set` | `set(targets, parameters)` | `JSAnimation` | Instantly sets values (internally an animation with `duration = 1e-11`, `composition: 'none'` by default so it does **not** override running tweens). Keep the return value and call `.revert()` to undo. |
| `utils.remove` | `remove(targets, renderable?, propertyName?)` | `TargetsArray` | Removes targets (optionally a single property) from running animations/timelines and cancels matching WAAPI animations. |
| `utils.cleanInlineStyles` | `cleanInlineStyles(renderable)` | same renderable | Removes the inline styles a finished animation/timeline left on its DOM targets (pass the animation, not the elements). |

### Random

| Function | Signature | Notes |
|----------|-----------|-------|
| `utils.random` | `random(min = 0, max = 1, decimalLength = 0)` | **Inclusive** of both bounds. `decimalLength` = decimal precision. |
| `utils.createSeededRandom` | `createSeededRandom(seed?, min = 0, max = 1, decimalLength = 0)` | Returns a deterministic `RandomNumberGenerator` (Mulberry32). Omitted seed = auto-incrementing internal seed. |
| `utils.randomPick` | `randomPick(arrayOrString)` | Random element (or character of a string). |
| `utils.shuffle` | `shuffle(array)` | Fisher–Yates, **mutates in place** and returns the same array reference. |

### Numbers (all chainable — see below)

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `utils.clamp` | `clamp(v, min, max)` | number | |
| `utils.round` | `round(v, decimalLength)` | number | `decimalLength < 0` returns `v` unchanged; `0` = `Math.round`. |
| `utils.roundPad` | `roundPad(v, decimalLength)` | **string** | `(+v).toFixed(n)` — keeps trailing zeros. |
| `utils.snap` | `snap(v, increment \| number[])` | number | Array → nearest array value; `0`/falsy increment returns `v`. |
| `utils.wrap` | `wrap(v, min, max)` | number | Modular wrap into `[min, max)`. |
| `utils.mapRange` | `mapRange(v, inLow, inHigh, outLow, outHigh)` | number | **No clamping** — combine with `.clamp()`. |
| `utils.lerp` | `lerp(start, end, factor)` | number | Linear interpolation, `factor` ∈ [0, 1]. |
| `utils.damp` | `damp(start, end, deltaTime, factor)` | number | Frame-rate-independent damped lerp (`deltaTime` in ms). |
| `utils.degToRad` / `utils.radToDeg` | `degToRad(deg)` / `radToDeg(rad)` | number | |
| `utils.padStart` / `utils.padEnd` | `padStart(v, totalLength, padString)` | **string** | `String.prototype.pad*` on `${v}`. |

### Time

| Function | Signature | Notes |
|----------|-----------|-------|
| `utils.sync` | `sync(callback?) => Timer` | Runs `callback` on the **next engine tick** (a 1ms Timer with `onComplete`). Use to defer work until after the current render pass. |
| `utils.keepTime` | `keepTime(constructorFn) => wrappedFn` | Wrap a function that *creates and returns* a Timer/Animation/Timeline. Each re-invocation `revert()`s the previous instance and transfers `currentIteration`, `iterationProgress` and `_startTime` to the new one — playback continues seamlessly. Ideal for responsive re-creation (Scope media queries) and React/Vue HMR. |

Also re-exported (internal linked-list helpers, rarely needed): `forEachChildren`, `addChild`, `removeChild`.

### Chainable composition (`src/utils/chainable.js`)

Calling a chainable util with **fewer arguments than its arity** returns a partially-applied function;
those functions expose every other chainable as a property, composing left-to-right:

```js
const normalize = utils.mapRange(0, 100, 0, 1).clamp(0, 1).round(2);
normalize(64.6789); // → 0.65   (mapRange first, then clamp, then round)
```

- For most utils the piped value fills the **first** parameter: `utils.clamp(0, 100)` ⇒ `v => clamp(v, 0, 100)`.
- For `lerp` and `damp` (registered with `right = 1`) it fills the **last** parameter:
  `utils.lerp(0, 360)` ⇒ `factor => lerp(0, 360, factor)`.
- Chainables registry: `clamp, round, snap, wrap, lerp, damp, mapRange, roundPad, padStart, padEnd, degToRad, radToDeg`.
  Non-chainable utils (`random`, `shuffle`, `get`, …) cannot appear in a chain.
- Composed chains are plain `(v) => number|string` functions — perfect as tween `modifier`s.

---

## Examples

### 1. Stagger delay from the center (README pattern)

```js
import { animate, stagger } from 'animejs';

animate('.square', {
  x: 320,
  rotate: { from: -180 },
  duration: 1250,
  delay: stagger(65, { from: 'center' }),
  ease: 'inOutQuint',
  loop: true,
  alternate: true,
});
```

### 2. Grid stagger with units + axis (from `examples/advanced-grid-staggering`)

```js
import { animate, stagger, utils } from 'animejs';

const grid = [14, 14];
const origin = utils.random(0, 14 * 14);

animate('.dot', {
  x: stagger('-.175rem', { grid, from: origin, axis: 'x' }),  // signed, unit kept
  y: stagger('-.175rem', { grid, from: origin, axis: 'y' }),
  scale: [{ to: 2 }, { to: 1 }],
  delay: stagger(50, { grid, from: origin }),                 // radial distance delay
  ease: 'inOutQuad',
});
```

### 3. Ranged value `[a, b]` — distribute values, not just delays

```js
import { animate, stagger } from 'animejs';

animate('.bar', {
  height: stagger(['1rem', '6rem']),          // first bar 1rem … last bar 6rem
  rotate: stagger([-15, 15], { ease: 'inOutSine' }),
  duration: stagger(200, { start: 500 }),     // 500, 700, 900, ...
});
```

### 4. Timeline position staggering

```js
import { createTimeline, stagger } from 'animejs';

const tl = createTimeline()
  .add('.title',  { opacity: [0, 1] })
  // each card's animation INSERTED 80ms apart, starting at the previous animation's start
  .add('.card',   { y: [40, 0], opacity: [0, 1] }, stagger(80, { start: '<' }))
  // absolute staggered positions from t=0, last element first
  .add('.dot',    { scale: [0, 1] }, stagger(100, { start: 0, from: 'last' }));
```

### 5. Chainables as modifiers + set/get + keepTime

```js
import { animate, utils } from 'animejs';

utils.set('.cursor', { x: '12rem', scale: 0.5 });          // instant set, composition 'none'
const w = utils.get('.box', 'width', false);                // → number (px)

animate('.knob', {
  rotate: 270,
  modifier: utils.snap(45).clamp(0, 270),                   // snap to 45°, clamp range
});

// Recreate on resize without losing playback time
const build = utils.keepTime(() => animate('.hero', { x: window.innerWidth / 2, loop: true }));
build();
window.addEventListener('resize', () => build());
```

---

## Gotchas

- **v3 → v4**: `anime.stagger(...)` is now a named import: `import { stagger } from 'animejs'`. There is no default `anime()` export.
- **Stagger functions cache state in their closure** (`values` distance array + `cachedOffset` are computed once on first call). Create a **fresh `stagger()` per animation** — reusing one returned function across animations with different target counts, origins, or timelines silently reuses stale values (`src/utils/stagger.js` lines 120, 230).
- **No `utils.interpolate` in v4.4.1.** Use `utils.lerp(start, end, factor)` (or `utils.damp` for frame-rate-independent smoothing). `interpolate` appears only in older docs.
- **Units come from the input string** (`'1rem'`, or `val[1]` for ranges) and are appended **after** `modifier` runs — the modifier always receives a plain `Number`.
- **Ranged + `start`**: for `stagger([a, b], { start })`, `start` *replaces* `a` as the base offset; it does not add to it.
- **`grid: true` (auto-grid)** needs measurable targets: DOM elements (uses `getBoundingClientRect()` centers — layout must be done; hidden/`display:none` elements break it) or JS objects with numeric `x`/`y`. Otherwise it silently falls back to linear index distance. Distances are normalized by the smallest non-zero gap.
- Distances are rounded to **2 decimals** before being multiplied by the spacing — tiny grid-position differences are quantized.
- `reversed` without `axis` computes `abs(max - v)`; with `axis` it just flips the sign — different semantics.
- `from: 'random'` uses `utils.shuffle`, which **mutates arrays in place** (relevant if you call `utils.shuffle` yourself on data you keep).
- `utils.random(min, max)` is **inclusive of `max`** (unlike `Math.random` idioms).
- `utils.set` returns a real `JSAnimation` — `.revert()` it (or use `utils.cleanInlineStyles(anim)`) to remove the inline styles it wrote. Default `composition: 'none'` means it won't stomp currently-running tweens; pass `composition: 'replace'` to force.
- `utils.get` reads only the **first** matched target and returns `undefined` when the selector matches nothing; unit conversion (`get(t, p, 'rem')`) only works for number/unit value types (not colors/complex values).
- `utils.mapRange` does **not clamp** — chain `.clamp(outLow, outHigh)` when input may exceed the range.
- Chainable partial application triggers only when you pass *fewer* args than the function's arity; `lerp`/`damp` chain on the **last** param (the piped value becomes `factor`), everything else on the **first**.
- `utils.keepTime` only tracks the constructor's return value if it is a revertible Tickable (Timer/Animation/Timeline); returning nothing (or a plain cleanup function) disables time-keeping.
