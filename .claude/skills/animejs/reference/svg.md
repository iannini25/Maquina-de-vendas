# anime.js v4 — `svg` module (morphTo, createMotionPath, createDrawable)

Verified against anime.js **v4.4.1** source: `vendor/anime/src/svg/*.js` and `vendor/anime/dist/modules/svg/*.d.ts`.

## Import

```js
// Namespace (most common in official examples)
import { svg } from 'animejs';
svg.morphTo(...); svg.createMotionPath(...); svg.createDrawable(...);

// Flat named imports (also re-exported from the root)
import { morphTo, createMotionPath, createDrawable } from 'animejs';

// Subpath import (tree-shaking friendly, see package.json "./svg" export)
import { morphTo, createMotionPath, createDrawable } from 'animejs/svg';
```

All three helpers are **value/property factories** — they don't animate anything by themselves. You pass their results into `animate()` / `createTimeline().add()` / `utils.set()`.

---

## API

### `svg.morphTo(path2, precision?)`

```ts
function morphTo(path2: TargetsParam, precision?: number): FunctionValue;
```

Returns a `FunctionValue` to use as the value of the **`d`** property (for `<path>`) or **`points`** property (for `<polygon>`/`<polyline>`). The function resolves to a `[from, to]` tuple, so the morph always animates from the target's current shape to `path2`'s shape.

| Param | Type | Default | Description |
|---|---|---|---|
| `path2` | `TargetsParam` (selector / element) | required | Destination shape. Must resolve to an existing `<path>`, `<polygon>` or `<polyline>` — otherwise **throws** `Error`. |
| `precision` | `Number` | `0.33` | Points sampled **per SVG length unit** (`maxPoints = max(ceil(len1*p), ceil(len2*p))`). `0` disables resampling and interpolates the raw `d`/`points` attribute strings directly. |

Element support (both the animated target AND `path2`): only `path`, `polygon`, `polyline` — anything else (`rect`, `circle`, `line`, ...) **throws** (`vendor/anime/src/svg/morphto.js:23-33`).

Behavior details from source:
- With `precision > 0`, both shapes are uniformly resampled via `getPointAtLength()` into the same number of points, so **mismatched point counts and even mixed tag types** (e.g. `<polygon>` → shape of a `<path>`) morph cleanly. Output format follows the *animated* element: `M x,y L x,y ...` for `<path>`, `x,y x,y ...` for polygon/polyline.
- With `precision = 0`, both attribute strings are read as-is. The attribute read (`d` vs `points`) is chosen from the **animated** element's tag, so both elements must be the **same tag type** and have the **same number of commands/points** or interpolation breaks.
- Chained morphs in a timeline work: on re-run, `morphTo` re-applies the previous tween's final value (`prevTween._value`) before sampling, so A→B→C→A timelines compose correctly.

### `svg.createMotionPath(path, offset?)`

```ts
function createMotionPath(path: TargetsParam, offset?: number): {
  translateX: FunctionValue;
  translateY: FunctionValue;
  rotate: FunctionValue;   // degrees, follows path tangent
};
```

| Param | Type | Default | Description |
|---|---|---|---|
| `path` | `TargetsParam` | required | Must resolve to an `SVGGeometryElement` (anything with `getTotalLength()`); if invalid, **returns `undefined`** and `console.warn`s. |
| `offset` | `Number` | `0` | Start offset as a **fraction of total path length** (e.g. `0.5` starts halfway). When `offset === 0` progress is clamped to the path ends; when `offset !== 0` progress **wraps around** (modulo), enabling seamless loops. |

Spread the returned object into the animation props: `animate(el, { ...svg.createMotionPath('#p'), ... })`. Each prop is a function value resolving to `{ from: 0, to: totalLength, modifier }` — the modifier converts the animated length into x/y/angle each frame (`vendor/anime/src/svg/motionpath.js`).

Coordinate spaces:
- Target **inside the same SVG**: raw path coordinates are used.
- Target is a **regular DOM element**: each point is multiplied by the path's `getCTM()`, so the element follows the path's **on-screen** position (viewBox scaling/transform accounted for). Position the DOM element with `position: absolute; top: 0; left: 0` relative to the SVG's container.

### `svg.createDrawable(selector, start?, end?)`

```ts
function createDrawable(selector: TargetsParam, start?: number, end?: number): Array<DrawableSVGGeometry>;
```

| Param | Type | Default | Description |
|---|---|---|---|
| `selector` | `TargetsParam` | required | Any `SVGGeometryElement`(s): `path`, `line`, `circle`, `ellipse`, `rect`, `polyline`, `polygon`. |
| `start` | `Number` | `0` | Initial visible-segment start (0–1). |
| `end` | `Number` | `0` | Initial visible-segment end (0–1). **Defaults to 0 → stroke becomes invisible the moment you call `createDrawable`.** |

Returns an **array of Proxy objects** wrapping the elements. Animate the **`draw`** property on these proxies with a `"start end"` string of two numbers (`'0 1'` = full stroke from the start, `'1 0'`... see gotchas). The proxy intercepts `setAttribute('draw', v)` and converts it to `stroke-dashoffset` + `stroke-dasharray` (`vendor/anime/src/svg/drawable.js`).

How it works internally:
- Sets `pathLength="1000"` on each element (constant `K = 1e3`), then applies the initial `draw="start end"`.
- `draw` values may go **outside [0,1]** (e.g. `'-1 -1'` → `'1.5 1.5'`) — useful for wrap-around effects on closed shapes (official `svg-line-drawing` example uses this on circles).
- Respects `vector-effect: non-scaling-stroke` by scaling dash values with the element's CTM scale factor.
- When `start === end` (zero-length segment) it temporarily forces `stroke-linecap: butt` so `round`/`square` caps don't leave a visible dot.

---

## Examples

### 1. Line drawing (logo stroke reveal)

```js
import { animate, svg, stagger } from 'animejs';

// IMPORTANT: animate the proxies returned by createDrawable, not the raw selector
animate(svg.createDrawable('.logo path'), {
  draw: ['0 0', '0 1'],          // from nothing → fully drawn from the start point
  ease: 'inOutQuad',
  duration: 2000,
  delay: stagger(100),
});
```

### 2. Draw in, then draw out (keyframes)

```js
import { animate, svg } from 'animejs';

const [drawable] = svg.createDrawable('#signature'); // start=0, end=0 → hidden now
animate(drawable, {
  draw: ['0 0', '0 1', '1 1'],   // grow from start, then shrink toward the end
  duration: 4000,
  ease: 'linear',
  loop: true,
});
```

### 3. Shape morphing

```js
import { animate, createTimeline, svg } from 'animejs';

// Single morph: animated element must be <path>, <polygon> or <polyline>
animate('#blob-1', {
  d: svg.morphTo('#blob-2'),       // default precision .33 resamples both shapes
  ease: 'inOutQuad',
  duration: 800,
});

// Chained morphs on a timeline (A → B → C → back to A)
const tl = createTimeline({ loop: true, defaults: { duration: 600, ease: 'inOutQuad' } });
tl.add('#morph', { d: svg.morphTo('#shape-b') })
  .add('#morph', { d: svg.morphTo('#shape-c') })
  .add('#morph', { d: svg.morphTo('#shape-a') });

// For a <polygon>/<polyline>, animate `points` instead of `d`:
animate('#poly', { points: svg.morphTo('#poly-2', 0) }); // precision 0 = raw points (counts must match)
```

### 4. Motion path with auto-rotation

```js
import { animate, svg } from 'animejs';

// Moves AND rotates the target along #track (rotate = path tangent angle in degrees)
animate('.car', {
  ...svg.createMotionPath('#track'),   // spreads { translateX, translateY, rotate }
  duration: 3000,
  ease: 'linear',
  loop: true,
});

// Staggered trail using offset (non-zero offset wraps around the path)
['.p1', '.p2', '.p3'].forEach((sel, i) => {
  animate(sel, {
    ...svg.createMotionPath('#track', i * 0.05),
    duration: 3000, ease: 'linear', loop: true,
  });
});
```

### 5. Set a drawable state without animating

```js
import { utils, svg } from 'animejs';
utils.set(svg.createDrawable('.line'), { draw: '0 0.5' }); // show first half instantly
```

---

## Gotchas

- **v4 prop names**: `createMotionPath` returns `{ translateX, translateY, rotate }` in v4.4.1. Early v4 builds/docs returned `{ x, y, angle }` — do NOT use those names; spread the object instead of hardcoding keys.
- **`createMotionPath` returns `undefined`** (with only a `console.warn`) when the selector doesn't resolve to an SVG element — spreading it then throws `TypeError: ... is not an object`. Verify the path exists first.
- **CTM is captured once** at tween creation (`getCTM()` in the closure, `motionpath.js:51`). If the SVG is responsive and the window resizes, a DOM-element motion path goes stale — recreate the animation on resize (e.g. inside `createScope(...).add()` with media/resize refresh).
- **`morphTo` throws** for any element other than `path`/`polygon`/`polyline` (both sides). Convert `rect`/`circle` to paths first.
- **`precision: 0` requires same tag type + same point/command count** on both shapes (it reads the attribute chosen by the *animated* element's tag from both elements). Any `precision > 0` removes both constraints by resampling.
- **`precision` cost**: `maxPoints ≈ pathLength × precision`. A 1000-unit path at default `0.33` produces ~330 `L` commands per frame string. Lower it for long paths; raise it for sharp corners.
- **`createDrawable` hides the stroke immediately** (default `start=0, end=0` writes `draw="0 0"` on creation). Pass `(selector, 0, 1)` if you need it visible before the animation starts.
- **`createDrawable` clobbers stroke styling**: it sets `pathLength="1000"` and rewrites `stroke-dasharray`/`stroke-dashoffset` on every frame — don't combine with hand-written dash CSS or your own `pathLength`.
- **Animate the returned proxies**, not the original selector — the `draw` attribute only does something through the Proxy's `setAttribute` trap. `animate('.line', { draw: '0 1' })` without `createDrawable` does nothing useful.
- **`draw` syntax** is `"v1 v2"` (space-separated). `v1` is where the visible segment starts, `v2` where it ends, both as fractions of total length; values outside `[0,1]` are legal and wrap visually on closed shapes. `'1 0'` is treated as a full stroke (same as `'0 1'` — the source special-cases both orderings).
- **`rotate` from a motion path is in degrees** (atan2 × 180/π) and composes with anime's default transform handling; if the element already has a rotation you want to keep, don't spread `rotate` (destructure only `translateX`/`translateY`).
- Minor string quirk in `morphTo` output: x coordinates are rounded to 3 decimals, y coordinates are **not** rounded (`morphto.js:53-54`) — harmless, but explains long attribute strings in DevTools.
