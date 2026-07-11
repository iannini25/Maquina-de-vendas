# createAnimatable() — high-frequency property animation without re-creating animations

`createAnimatable()` turns targets into an object with one **getter/setter function per property**.
Calling `obj.x(100)` does NOT allocate a new animation — it rewrites the from/to numbers of a single
pre-built, reusable `JSAnimation` and resumes it. This is the v4 tool for things driven by rapid,
unpredictable input: cursor followers, gauges, audio meters, scroll-linked values, game loops.
Use `animate()` for one-shot/scheduled animations; use `createAnimatable()` when the same property
will be re-targeted dozens of times per second.

Source: `vendor/anime/src/animatable/animatable.js` · Types: `vendor/anime/dist/modules/animatable/animatable.d.ts`

## Import

```js
import { createAnimatable, utils } from 'animejs';
// class is also exported (createAnimatable is just `new Animatable(...)`):
import { Animatable } from 'animejs';
```

## API

```ts
createAnimatable(targets: TargetsParam, parameters: AnimatableParams): AnimatableObject
// AnimatableObject = Animatable & Record<string, AnimatableProperty>
// AnimatableProperty = setter & getter:
//   (to: number | number[], duration?: number, ease?: EasingParam) => AnimatableObject  // setter, chainable
//   () => number | number[]                                                             // getter
```

### `parameters` — three kinds of keys

Every key in `parameters` is routed by name (source `animatable.js` constructor):

| Key kind | Rule (source) | Becomes |
|---|---|---|
| Animatable property | `isKey(name)` → name is NOT in `globals.defaults` | A registered property + one dedicated `JSAnimation` |
| Callback | name starts with `'on'` | Callback on an internal proxy animation (see Callbacks) |
| Global param | name IS in `globals.defaults` (`duration`, `ease`, `modifier`, `delay`, `composition`, …) | Default applied to every property animation |

### Per-property value

| Value form | Meaning | Example |
|---|---|---|
| `Number` | **duration in ms** for this property (NOT a target value!) | `x: 500` |
| `Object` | `AnimatablePropertyParamsOptions` (below) | `rotate: { unit: 'rad', duration: 0 }` |

### `AnimatablePropertyParamsOptions`

| Param | Type | Default | Description |
|---|---|---|---|
| `unit` | `string` | unit read from target | Output unit, fixed at creation (`'px'`, `'deg'`, `'rad'`, `'em'`…). Appended to the initial `'+=0'` keyframe. |
| `duration` | `number \| FunctionValue` | `1000` (`globals.defaults.duration = K = 1e3`) | Transition time per call. `0` = instant set. Accepts `stagger()` for multi-target. |
| `ease` | `EasingParam` | `'out(2)'` (`globals.defaults.ease`) | Easing used when animating to a new value. |
| `modifier` | `(v: number) => number` | `v => v` | Applied on every rendered value AND in the getter (`utils.round(2)`, `utils.snap(10)`…). |
| `composition` | `'replace' \| 'blend' \| 'none'` | `'replace'` | Honored only here (tween level). Top-level `composition` is ignored — see Gotchas. |

Top-level (global) `duration`, `ease`, `modifier`, `delay` apply to all properties unless the
property's options object overrides them.

## Property setter / getter

```js
const box = createAnimatable('#box', { x: 500, y: 500, rotate: 250 });

box.x(150)                 // animate x to 150 over 500ms (registered duration)
box.x(150, 80)             // override duration for this call → animation.stretch(80)
box.x(150, 80, 'out(4)')   // also override ease (parseEase) — persists on the tween
box.x(150).y(40).rotate(2) // setters return the animatable → chainable

box.x()                    // getter → current value as Number, with modifier applied
box.backgroundColor()      // complex values → Array<number> (e.g. [r, g, b, a])
```

Setter mechanics (source lines 110-139): for each tween, `from = modifier(currentNumber)`,
`to = newValue`, `tween._currentTime = 0`, then `animation.reset(true).resume()`. With an array
`to`, only indices already present in `tween._numbers` are updated. Because `from` is sampled
from the live current value, calls mid-flight retarget smoothly (no jump).

## Instance properties & methods

| Member | Type | Description |
|---|---|---|
| `targets` | `Array<HTMLElement \| SVGElement \| JSTarget>` | Resolved targets. |
| `animations` | `Record<string, JSAnimation>` | One animation per registered property (`anim.animations.x.duration`…). |
| `callbacks` | `JSAnimation \| null` | Internal proxy animation carrying the `on*` callbacks. |
| `revert()` | `() => this` | Reverts every property animation, replaces each property fn with `noop`, empties `targets`/`animations`, reverts `callbacks`. |

## Callbacks

User `on*` params attach to a proxy `JSAnimation({v:0}, {v:1, autoplay:false})`, not to the
property animations directly (source lines 48-73):

| Callback | Fires |
|---|---|
| `onBegin` | When any property starts animating after the animatable was fully idle (idle → active edge). |
| `onComplete` / `onPause` | When ALL property animations are paused/finished (active → idle edge). Fires once per "burst", not per property. |
| `onUpdate` | Per frame while the proxy animation plays. |

## Examples

### 1. Cursor follower (the canonical pattern — `vendor/anime/examples/animatable-follow-cursor/`)

```js
import { createAnimatable, utils, stagger } from 'animejs';

const rows = 13;
const duration = stagger(50, { ease: 'in(1)', from: 'center', grid: [rows, rows] });

const particles = createAnimatable('.particles div', {
  x: { duration },                       // animated, staggered per element
  y: { duration },
  rotate: { unit: 'rad', duration: 0 },  // duration 0 → set instantly, no tween
  ease: 'outElastic(.3, 1.4)',           // global ease for x/y
});

let w = innerWidth, h = innerHeight;
window.onpointermove = ({ clientX, clientY }) => {
  particles.x(utils.mapRange(clientX, 0, w, -w / 2, w / 2));
  particles.y(utils.mapRange(clientY, 0, h, -h / 2, h / 2));
  particles.rotate(-Math.atan2(w / 2 - clientX, h / 2 - clientY));
};
window.onresize = () => { w = innerWidth; h = innerHeight; };
```

### 2. Gauge needle with unit + modifier + cleanup

```js
import { createAnimatable, utils } from 'animejs';

const needle = createAnimatable('.gauge-needle', {
  rotate: { unit: 'deg', duration: 350, modifier: utils.round(1) },
  ease: 'out(3)',
});

function setGauge(pct /* 0..100 */) {
  needle.rotate(utils.mapRange(pct, 0, 100, -90, 90)); // renders e.g. "37.5deg"
}
needle.rotate(); // → current angle as a plain Number (deg)
needle.revert(); // teardown: property fns become noop, styles reverted
```

### 3. Per-call duration/ease override + animated color (array values)

```js
import { createAnimatable } from 'animejs';

const el = createAnimatable('#el', { backgroundColor: 250, scale: 200 });

el.backgroundColor([255, 64, 0, 1], 600, 'inOut(3)'); // rgba array, 600ms this call
el.scale(1.2);
el.backgroundColor(); // → [255, 64, 0, 1] once complete
```

### 4. Smooth-follow loop (lerp toward a raw target every frame)

```js
import { createAnimatable, createTimer, utils } from 'animejs';

const dot = createAnimatable('.dot', { x: 0, y: 0 }); // duration 0 0? No: 0ms = instant
// Better: small duration, let the animatable do the smoothing:
const orb = createAnimatable('.orb', { x: 400, y: 400, ease: 'out(2)' });
document.addEventListener('pointermove', e => orb.x(e.clientX).y(e.clientY));
```

### 5. Inside a scope (auto-revert)

```js
import { createScope, createAnimatable } from 'animejs';

const scope = createScope({ root: '#app' }).add(() => {
  const a = createAnimatable('.cursor', { x: 200, y: 200 });
  window.onpointermove = e => a.x(e.clientX).y(e.clientY);
});
// later: scope.revert() also reverts the animatable (constructor calls scope.current.register(this))
```

## Gotchas

- **A `Number` property value is the DURATION, not a target value.** `createAnimatable(el, { x: 20 })`
  means "x animates over 20ms", verified by tests (`animatable.animations.x.duration === 20`,
  `vendor/anime/tests/suites/animatables.test.js`). Coming from `animate()` this is the #1 trap.
- **Defaults**: duration `1000`ms (`K` in `src/core/consts.js`), ease `'out(2)'`
  (`globals.defaults` in `src/core/globals.js`).
- **Top-level `composition` is silently ignored.** The source unconditionally sets
  `animParams.composition = compositionTypes.replace` after merging (`src/animatable/animatable.js:105`).
  Only `composition` inside a property's options object survives (tween-level param).
- **Reserved names can't be animatable properties.** Any key present in `globals.defaults`
  (`duration`, `ease`, `delay`, `loop`, `modifier`, `id`, …) is treated as a global param, never a
  property (`isKey()` check, `src/core/helpers.js:66`).
- **Global `duration` beats number-shorthand durations.** `mergeObjects(o1, o2)` keeps `o1`'s keys,
  so with `{ x: 20, duration: 40 }` x gets 40ms. To mix a global duration with per-prop ones, use
  the object form: `x: { duration: 20 }` (tween-level wins).
- **Per-call `duration` and `ease` persist.** `anim.x(v, 80)` calls `animation.stretch(80)` — the
  property's duration is now 80ms for all later calls too. Same for `ease`: once passed it stays on
  the tweens until overridden. Pass them explicitly each call if you alternate.
- **Getter reads the FIRST target only** (`animation._head`). With multi-element targets,
  `particles.x()` returns element 0's value. For complex values it returns the live `tween._numbers`
  array reference — read, don't mutate.
- **Units are fixed at creation.** `unit` is baked into the initial `'+=0'` keyframe; setter `to`
  values are always unitless numbers. You cannot switch `px` → `%` per call.
- **Initial value = current computed value.** Each property is created as a paused `'+=0'` relative
  animation, so the first getter returns the element's existing value (e.g. `0` for fresh `x`, the
  computed rgba array for `backgroundColor`).
- **`duration: 0` = instant setter.** Renders the value immediately with no tween — exactly how the
  follow-cursor example sets `rotate` while x/y animate.
- **Cleanup**: call `revert()` (or revert the owning `createScope`). After `revert()`, the property
  functions are replaced with `noop`, so stale event handlers calling `a.x(...)` won't throw — but
  they won't do anything either.
- **`onComplete` semantics differ from `animate()`**: it fires when ALL property animations have
  settled (one "burst" of activity ended), not per property and not per call.
