# anime.js v4 — Easings

All easing functions map a progress value `t` in `[0,1]` to an output value (type `EasingFunction = (time: number) => number`). They are passed via the `ease` parameter of `animate()`, `createTimer()`, timeline tweens, keyframes, etc. The factory functions (`cubicBezier`, `linear`, `steps`, `irregular`, `spring`) are **imported and called** — the v3-style string forms `"cubicBezier(...)"`, `"steps(...)"`, `"linear(...)"`, `"irregular(...)"` were **removed** from the JS core (they `console.warn` and fall back to linear; see `vendor/anime/src/easings/eases/parser.js` `deprecated` list).

## Import

```js
// Named eases catalog + factories (all re-exported from the package root)
import { animate, eases, spring, cubicBezier, linear, irregular, steps, Spring } from 'animejs';

// Also available as a namespace
import { easings } from 'animejs'; // easings.eases, easings.spring, easings.cubicBezier, ...

// WAAPI-powered variant (different ease handling, see "WAAPI vs JS" below)
import { animate } from 'animejs/waapi';
```

`createSpring()` still exists but is **deprecated** — it warns and forwards to `spring()`.

## Global default

The default ease for every animation is **`'out(2)'`** (power-out, exponent 2) — `vendor/anime/src/core/globals.js`. Change it with `engine.defaults.ease = ...` / per-scope defaults.

## Built-in ease catalog (string names or `eases.*`)

Names are built as `type + Name` from 4 types × 10 bases (`vendor/anime/src/easings/eases/parser.js`):

| Type | Transform applied to the `in` curve |
|---|---|
| `in` | as-is (accelerate) |
| `out` | mirrored: `1 - easeIn(1 - t)` (decelerate) |
| `inOut` | in for first half, out for second half |
| `outIn` | out for first half, in for second half |

| Base | Parametric? | Notes |
|---|---|---|
| *(none)* → `in`, `out`, `inOut`, `outIn` | `(power = 1.68)` | Generic power ease `t^power` |
| `Quad` | no | `t^2` |
| `Cubic` | no | `t^3` |
| `Quart` | no | `t^4` |
| `Quint` | no | `t^5` |
| `Sine` | no | `1 - cos(t·π/2)` |
| `Circ` | no | `1 - sqrt(1 - t²)` |
| `Expo` | no | `2^(10t-10)`, exact 0 at t=0 |
| `Bounce` | no | classic Penner bounce |
| `Back` | `(overshoot = 1.7)` | overshoots past the target |
| `Elastic` | `(amplitude = 1, period = .3)` | amplitude clamped to `[1,10]`, period to `(0, 2]` |

Plus identity: `'linear'` and `'none'` (both `t => t`).

Full list: `linear none in out inOut outIn` + `{in,out,inOut,outIn}{Quad,Cubic,Quart,Quint,Sine,Circ,Expo,Bounce,Back,Elastic}` (46 names total).

### String parameter syntax

Parametric eases accept args inside parentheses inside the string. Args are split on `,` and coerced with unary `+`:

```js
ease: 'out(3)'              // power-out, exponent 3
ease: 'inBack(2.5)'         // overshoot 2.5
ease: 'outElastic(1, .5)'   // amplitude 1, period .5
ease: 'inOutElastic(2, .4)'
```

Without parentheses, parametric names use their defaults: `'outElastic'` ≡ `'outElastic(1, .3)'`. Unknown strings **silently fall back to linear** (`none`) — no error is thrown.

### `eases` object (function form)

```js
import { eases } from 'animejs';

eases.outQuad            // plain EasingFunction — pass directly
eases.outElastic(1, .5)  // parametric — MUST be called to get an EasingFunction
eases.out(3)             // power eases must be called too
```

In the `eases` object, the power (`in/out/inOut/outIn`), `*Back`, and `*Elastic` entries are factories `(a, b) => EasingFunction`; everything else (`inQuad` … `outInBounce`) is already an `EasingFunction`.

## Factory functions

### `spring(parameters?: SpringParams): Spring`

Spring physics solver (adapted from WebKit's spring.js). **Pass the returned `Spring` instance itself as `ease`** — the animation detects it and uses the spring's computed `settlingDuration` as the tween duration, **ignoring any `duration` you set** (`vendor/anime/src/animation/animation.js` lines 259-261).

| Param | Type | Default | Clamp | Description |
|---|---|---|---|---|
| `mass` | Number | `1` | `[1, 10000]` | Mass |
| `stiffness` | Number | `100` | `(0, 10000]` | Spring stiffness |
| `damping` | Number | `10` | `(0, 10000]` | Damping |
| `velocity` | Number | `0` | `[-10000, 10000]` | Initial velocity |
| `bounce` | Number | `.5`* | `[-1, 1]` | Perceptual bounce (Apple SwiftUI model). Negative = overdamped |
| `duration` | Number | `628`* | `[10, 10000]` ms | **Perceived** duration in ms (not the settling duration) |
| `onComplete` | `Callback<JSAnimation>` | `noop` | — | Fires when current time crosses the perceived duration |

\* `bounce`/`duration` defaults only apply **if at least one of the two is provided**. Providing either switches the spring to "perceptual mode": `mass` is forced to 1, `velocity` to 0, and `stiffness`/`damping` are derived from duration+bounce (`calculateSDFromBD`, damping capped at 300). With neither, the spring is purely physics-driven by mass/stiffness/damping/velocity.

#### Spring instance properties / methods

| Member | Kind | Description |
|---|---|---|
| `.ease` | `EasingFunction` | The actual easing function (used internally; this is how anime detects a Spring) |
| `.settlingDuration` | Number (ms) | Computed real duration until rest (threshold `.0005`, rest window 200ms, hard cap **60000ms**) |
| `.duration` | get/set | Perceived duration; setting recomputes stiffness+damping |
| `.bounce` | get/set | Setting recomputes stiffness+damping |
| `.stiffness` / `.damping` | get/set | Setting recomputes bounce+perceived duration |
| `.mass` / `.velocity` | get/set | Setting recomputes the solver |
| `.onComplete` | Callback | Called with the parent `JSAnimation` |

Setters are live, but an already-created animation keeps the duration captured at creation time.

### `cubicBezier(x1 = 0.5, y1 = 0, x2 = 0.5, y2 = 1): EasingFunction`

CSS-style cubic bezier (binary-subdivision solver, precision 1e-7, max 100 iterations). Returns the identity `none` when `x1 === y1 && x2 === y2` (the curve is linear).

### `linear(...stops): EasingFunction`

Piecewise-linear ease, like CSS `linear()`. With **no args returns identity**. Each stop is a Number (output value) or a String `'value position%'` to place the stop on the time axis. First and last stops are pinned to t=0 and t=1; unpositioned stops are spaced evenly.

```js
linear(0, 0.25, 1)          // stops at t=0, .5, 1 → ease through y=0.25 midway
linear(0, '0.25 75%', 1)    // y=0.25 at 75% of the time
```

### `irregular(length = 10, randomness = 1): EasingFunction`

Random monotonic curve: `length` points with values randomized by `randomness` (0 = perfectly even = identity, 1 = fully random), fed through `linear(...)`. **Randomness is sampled once at creation** (`Math.random`) — every call to `irregular()` yields a different curve; reuse the returned function for consistency across targets.

### `steps(steps = 10, fromStart?: boolean): EasingFunction`

CSS-like step easing. Default = jump at **end** of each step (`floor`); `fromStart: true` = jump at **start** (`ceil`). Only the `start`/`end` jump terms are implemented. Input `t` is clamped to `[0,1]`.

### Custom function eases

Any `(t: number) => number` works: `ease: t => t * t`, or `ease: t => 1 - Math.cos(t * Math.PI * 8) * (1 - t)`. Values may exceed `[0,1]` to overshoot.

## WAAPI vs JS (`animejs` vs `animejs/waapi`)

`animate()` from `'animejs/waapi'` converts everything to a native CSS timing function (`vendor/anime/src/waapi/waapi.js` `parseWAAPIEasing`):

| `ease` value | WAAPI behavior |
|---|---|
| Strings starting `linear`, `cubic-`, `steps`, `ease` | Passed through verbatim as native CSS (`'ease-in-out'`, `'steps(6, start)'`, `'step-start'`, `'cubic-bezier(.4,0,.2,1)'`, `'linear(0, 0.25, 1)'`) |
| String starting `cubicB` (e.g. `'cubicBezier(.4,0,.2,1)'`) | Lowercased into `cubic-bezier(...)` — string form works here, unlike JS mode |
| Other anime ease names (`'outElastic(1,.5)'`, …) | Parsed, then **sampled into a CSS `linear()` string with 100 samples** rounded to 4 decimals |
| Custom function | Sampled into `linear()` (100 samples) |
| `Spring` instance | `spring.ease` sampled into `linear()`; `spring.settlingDuration` also overrides `duration` |

In JS mode (`'animejs'`), every form works natively at full precision; in WAAPI mode anything non-native is a 100-sample approximation. WAAPI caches parsed **string** eases only (function args would be lost in cache keys).

## Examples

```js
// 1. String eases with parameters (JS mode)
import { animate } from 'animejs';

animate('.card', { x: 240, ease: 'outElastic(1, .5)', duration: 800 });
animate('.dot',  { scale: [0, 1], ease: 'out(4)' });     // power-out, exponent 4
animate('.menu', { y: '-2rem', ease: 'inOutBack(2.2)' });
```

```js
// 2. eases object — remember to CALL the parametric ones
import { animate, eases } from 'animejs';

animate('.a', { x: 100, ease: eases.outQuad });          // plain fn, pass as-is
animate('.b', { x: 100, ease: eases.outElastic(1.2, .4) }); // factory, must call
animate('.c', { x: 100, ease: eases.inOut(3) });            // power factory, must call
```

```js
// 3. Spring — instance IS the ease; it owns the duration
import { animate, spring } from 'animejs';

// Perceptual mode: duration = perceived ms, bounce in [-1, 1]
animate('.modal', {
  scale: [0.8, 1],
  ease: spring({ duration: 450, bounce: 0.3, onComplete: self => console.log('settled-ish') }),
  // NOTE: a `duration: 450` param here would be IGNORED — spring.settlingDuration wins
});

// Physics mode: mass/stiffness/damping/velocity
const s = spring({ mass: 1, stiffness: 180, damping: 12, velocity: 0 });
console.log(s.settlingDuration); // actual ms the animation will run
animate('.chip', { x: 320, ease: s });
```

```js
// 4. Factory eases — imported functions, NOT strings (strings warn + fall back to linear)
import { animate, cubicBezier, steps, linear, irregular } from 'animejs';

animate('.p1', { x: 200, ease: cubicBezier(0.34, 1.56, 0.64, 1) }); // back-like overshoot
animate('.p2', { x: 200, ease: steps(8) });                          // jump-end staircase
animate('.p3', { x: 200, ease: steps(8, true) });                    // jump-start
animate('.p4', { x: 200, ease: linear(0, '0.6 20%', 1) });           // fast start, slow finish
animate('.p5', { x: 200, ease: irregular(12, 0.8) });                // jittery, random per call
```

```js
// 5. WAAPI mode — native CSS strings allowed, everything else is sampled
import { animate } from 'animejs/waapi';
import { spring } from 'animejs';

animate('.w1', { x: '20rem', ease: 'ease-in-out' });            // native CSS
animate('.w2', { x: '20rem', ease: 'steps(6, start)' });        // native CSS
animate('.w3', { x: '20rem', ease: 'cubicBezier(.4, 0, .2, 1)' }); // lowercased → cubic-bezier()
animate('.w4', { x: '20rem', ease: 'outElastic(1, .4)' });      // → sampled linear() string
animate('.w5', { x: '20rem', ease: spring({ bounce: .4 }) });   // sampled + duration override
```

## Gotchas

- **Default ease is `'out(2)'`, not linear.** Set `ease: 'linear'` (or `'none'`) explicitly for constant-rate motion.
- **v3/early-v4 string factories are dead in JS mode**: `ease: 'steps(4)'`, `'linear(0,.5,1)'`, `'irregular(...)'`, `'cubicBezier(...)'` log a deprecation warning and run as **linear**. Import and call the functions instead. Exception: in WAAPI mode `'steps(...)'`/`'linear(...)'`/`'cubic-bezier(...)'` are native CSS and `'cubicBezier(...)'` is auto-lowercased.
- **Typos fail silently**: an unrecognized ease string resolves to `none` (linear) with no warning (`parseEaseString` returns `none` on lookup miss).
- **`eases.outElastic` / `eases.outBack` / `eases.out` are factories** — passing them uncalled as `ease` breaks (anime treats any function as `t => number`; a factory returns a function, producing NaN progress). Always call: `eases.outElastic()`.
- **Spring hijacks duration**: when `ease` is a `Spring`, the tween duration becomes `spring.settlingDuration` (capped at 60s); the `duration` animation param is ignored. `spring().duration` is the *perceived* duration, a different number from `settlingDuration`.
- **Spring perceptual vs physics mode**: passing `bounce` or `duration` resets `mass→1`, `velocity→0` and overwrites `stiffness`/`damping`. Don't mix `{ stiffness, bounce }` expecting both to apply.
- **Spring `onComplete` fires at perceived duration**, before visual rest, and can re-arm if the animation is scrubbed back (`completed` flag resets when time < perceived duration).
- **String ease parsing is cached** (`easesLookups`): `'outElastic(1,.5)'` is parsed once per unique string — cheap to reuse, but the cache never evicts.
- **`irregular()` is non-deterministic** at creation — create once and share the function if multiple targets must move identically.
- **Elastic params are clamped**: amplitude to `[1, 10]`, period to `(0, 2]` — `'outElastic(0.5, 5)'` actually runs as `(1, 2)`.
- **WAAPI sampling**: non-native eases become 100-sample CSS `linear()` strings (4-decimal precision) — very sharp elastic/bounce curves lose fidelity vs JS mode.
- `parseEase`, `parseEaseString`, `easeTypes`, `easeInPower` exist in `src/easings/eases/parser.js` but only `eases` is re-exported publicly; don't rely on the parser internals.
