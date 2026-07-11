# Draggable (anime.js v4)

Make any DOM element (or plain JS object) draggable with momentum, container bounds,
rubber-band friction, snapping, auto-scroll, and spring/ease release physics.

## Import

```js
import { createDraggable } from 'animejs';
// The class is also exported if you need instanceof checks:
import { Draggable } from 'animejs';
```

## API

```ts
createDraggable(target: TargetsParam, parameters?: DraggableParams): Draggable
```

- `target` — CSS selector, DOM element, or a **plain JS object** (wrapped in a `DOMProxy`
  that reads/writes its `x`, `y`, `width`, `height` properties — lets you drive non-DOM values).
- Position is driven by an internal `Animatable` on `translateX` / `translateY`
  (changeable via `mapTo`). All positions are **unitless px numbers**.
- If created inside `createScope()`, the draggable auto-registers for `scope.revert()`.

### Parameters (`DraggableParams`)

Every parameter marked **fn** also accepts `(draggable) => value` — the function is
(re-)evaluated at construction and on every `refresh()` (incl. after resize).
Defaults below taken from `vendor/anime/src/draggable/draggable.js` (`refresh()` + constructor).

| Param | Type | Default | Description |
|---|---|---|---|
| `trigger` | `DOMTargetSelector` | the target itself | Element that listens for pointer events (drag handle). |
| `container` | selector \| element \| `[t,r,b,l]` array \| **fn** | `undefined` (→ `document.body`, unbounded) | Constrains movement. Only when defined is the draggable "contained" (bounds enforced). Array form = explicit px bounds `[top, right, bottom, left]` relative to the target's start position. |
| `x` | `boolean \| DraggableAxisParam` | `true` | `false` disables horizontal dragging. Object form: `{ mapTo, modifier, composition, snap }`. |
| `y` | `boolean \| DraggableAxisParam` | `true` | Same for vertical axis. |
| `x.mapTo` / `y.mapTo` | `string` | `'translateX'` / `'translateY'` | Map the axis to any animatable property (e.g. `'rotate'`, an object key). |
| `modifier` | `TweenModifier` | — | Function applied to both axes' values (e.g. `utils.wrap(...)`, `utils.snap(...)`). Per-axis `x.modifier`/`y.modifier` override it. |
| `snap` | `number \| number[] \|` **fn** | `0` (off) | Number = snap increment; array = snap to closest value. Per-axis `x.snap`/`y.snap` override. Applied live during drag (`snapped` values) and on release destination. |
| `containerPadding` | `number \| [t,r,b,l] \|` **fn** | `0` | Inner padding of the container bounds (px). Single number applies to all 4 sides. |
| `containerFriction` | `number (0–1) \|` **fn** | `0.8` | Rubber-band resistance when dragging past bounds. `1` = hard clamp, `0` = no resistance. Out-of-bounds delta is multiplied by `(1 - friction) * dragSpeed`. |
| `releaseContainerFriction` | `number (0–1) \|` **fn** | = `containerFriction` | Same friction but applied to the momentum overshoot after release. |
| `dragSpeed` | `number \|` **fn** | `1` | Multiplier on pointer movement (e.g. `0.5` = half speed, `2` = double). |
| `dragThreshold` | `number \| {mouse, touch} \|` **fn** | `{ mouse: 3, touch: 7 }` | Min px of pointer movement before the drag actually starts. Resolved per device via `matchMedia('(pointer:fine)')`. |
| `scrollSpeed` | `number \|` **fn** | `1.5` | Auto-scroll speed when dragging near the container's scroll edges (internally ×10 px/frame). |
| `scrollThreshold` | `number \|` **fn** | `20` | Distance (px) from the scroll edge at which auto-scroll kicks in. |
| `minVelocity` | `number \|` **fn** | `0` | Lower clamp for computed velocity. |
| `maxVelocity` | `number \|` **fn** | `50` | Upper clamp for computed velocity. |
| `velocityMultiplier` | `number \|` **fn** | `1` | Scales computed velocity (and thus release momentum distance). |
| `releaseMass` | `number` | `1` | Mass of the built-in release spring. |
| `releaseStiffness` | `number` | `80` | Stiffness of the built-in release spring. |
| `releaseDamping` | `number` | `20` | Damping of the built-in release spring. |
| `releaseEase` | `EasingParam \| Spring` | spring(mass/stiffness/damping above); fallback ease `outQuint` | If you pass a `spring(...)` it becomes the release physics for both axes (with velocity transfer). If you pass a normal ease, release uses that ease and the spring's settling duration; out-of-bounds overshoot is then handled by two `composition: 'blend'` animations. |
| `cursor` | `boolean \| {onHover, onGrab} \|` **fn** | `{ onHover: 'grab', onGrab: 'grabbing' }` | `false` disables cursor styling. Only applied on fine pointers (mouse). |

There is **no `minDuration` parameter** in v4.4.1 — release duration is derived from the
spring's `settlingDuration`.

### Callbacks

All callbacks have signature `(self: Draggable) => void`.

| Callback | Fires |
|---|---|
| `onGrab` | Pointer down on the trigger (before any movement). |
| `onDrag` | Every pointer move while dragging (after `dragThreshold` is passed). |
| `onRelease` | Pointer up / touch end — fired *after* the release animations start, so you can cancel them inside it (`self.stop()`). |
| `onUpdate` | Every frame the position actually changed (`dx || dy`), incl. release momentum and `setX/setY`. |
| `onSettle` | When all motion fully completes (release spring at rest). Resets `velocity`/`deltaX/Y` to 0 first. |
| `onSnap` | When the snapped value changes during drag, or when the release destination snaps. |
| `onResize` | Container/target resized (debounced 150 ms via `ResizeObserver`), **before** the internal `refresh()`. |
| `onAfterResize` | After the post-resize `refresh()` — good place to re-snap (`self.setX(utils.snap(self.x, self.snapX))`). |

### Methods

| Method | Returns | Description |
|---|---|---|
| `setX(x, muteUpdateCallback = false)` | `this` | Set x instantly (no animation). `true` suppresses `onUpdate`. No-op if x-axis disabled. |
| `setY(y, muteUpdateCallback = false)` | `this` | Same for y. |
| `stop()` | `this` | Pause all running animations on the draggable (release springs, overshoot, container-scroll animations). |
| `reset()` | `this` | `stop()` + set position to `(0,0)` and zero velocity/pointer state (mutes callbacks). |
| `enable()` | `this` | Attach listeners, set `touch-action` (`none`, or `pan-x`/`pan-y` if one axis disabled), remove `.is-disabled` class. Called automatically by the constructor. |
| `disable()` | `this` | Detach all listeners, revert all injected styles (cursor, z-index, touch-action), add `.is-disabled` class on target. |
| `revert()` | `this` | `reset()` + `disable()` + revert transforms/tickers, disconnect `ResizeObserver`. Full cleanup — call on unmount. |
| `refresh()` | `void` | Re-evaluate all function-based parameters and bounds; clamps current position into the new bounds. |
| `scrollInView(duration?, gap = 0, ease = 'inOutQuad')` | `this` | Animate the **container scroll** so the target is visible. `duration` defaults to `350 * globals.timeScale`. |
| `animateInView(duration?, gap = 0, ease = 'inOutQuad')` | `this` | Animate the **target position** back inside the container bounds (with snap). Same default duration. |
| `updateBoundingValues()` | `void` | Recompute container/target bounds (temporarily strips ancestor transforms). |
| `isOutOfBounds(bounds, x, y)` | `0\|1\|2\|3` | `0` in-bounds, `1` x out, `2` y out, `3` both. Always `0` when not contained. |
| `computeVelocity(dx, dy)` | `number` | Internal velocity sampler (used by the wheel-emulation pattern below). |
| `handleUp()` | `void` | Programmatically simulate pointer release (used for mouse-wheel carousels). |

### Properties

| Property | Type | Description |
|---|---|---|
| `x`, `y` | `number` get/set | Current position (px, rounded to `globals.precision`). Setting calls `setX/setY` (fires `onUpdate`). |
| `progressX`, `progressY` | `number` get/set | Position mapped to container bounds as `0–1`. Settable. |
| `velocity` | `number` | **Unsigned magnitude** — px/ms × `velocityMultiplier`, clamped `[minVelocity, maxVelocity]`; max of last 3 samples (≥17 ms apart). Direction comes from `angle` or the sign of `deltaX`/`deltaY`. Note `angle`/`velocity` are computed from raw POINTER deltas — vertical movement counts even with `y: false`; for "horizontal flick" strength use `Math.cos(self.angle) * self.velocity`. |
| `angle` | `number` | Drag/release direction in **radians** (`Math.atan2`). |
| `deltaX`, `deltaY` | `number` | Per-frame position delta (reset to 0 on settle). |
| `destX`, `destY` | `number` | Computed release destination (after momentum + snap + clamp). |
| `grabbed`, `dragged`, `released`, `enabled`, `contained`, `canScroll`, `isFinePointer` | `boolean` | State flags. Note: there is no `isDragging` property — use `dragged` (or `grabbed`). |
| `snapX`, `snapY` | `number \| number[]` | Resolved snap config per axis. |
| `snapped` | `[number, number]` | Current snapped x/y values. |
| `containerBounds` | `[t, r, b, l]` | Resolved movement bounds in px. |
| `scroll` | `{x, y}` | Current container scroll position. |
| `$target`, `$trigger`, `$container` | `HTMLElement` | Resolved elements (`$container` is `document.body` when no container given). |
| `animate` | `AnimatableObject` | The underlying Animatable — `draggable.animate.translateX(100, 500, 'out(2)')` animates the position manually. |

## Examples

### 1. Basic bounded draggable with snap-to-grid

```js
import { createDraggable } from 'animejs';

const draggable = createDraggable('.card', {
  container: '.board',          // bounds = .board's box
  containerPadding: 8,          // 8px inset on all sides
  snap: 16,                     // snap x and y to a 16px grid
  onSnap: (self) => console.log('snapped to', self.snapped),
  onSettle: (self) => console.log('rested at', self.x, self.y),
});
```

### 2. Horizontal slider mapped to a CSS property (no transform)

```js
import { createDraggable, utils } from 'animejs';

createDraggable('.knob', {
  container: '.slider-track',
  y: false,                                  // horizontal only
  x: { mapTo: 'left', snap: [0, 50, 100] },  // drive `left`, snap to 3 stops
  containerFriction: 1,                      // hard clamp, no rubber-band
  onUpdate: (self) => {
    document.querySelector('.value').textContent = utils.round(self.progressX, 2);
  },
});
```

### 3. Spring release physics + custom cursor

```js
import { createDraggable, spring } from 'animejs';

createDraggable('.ball', {
  container: window.innerWidth > 768 ? '.arena' : 'body',
  releaseEase: spring({ stiffness: 120, damping: 8 }),  // bouncy release
  velocityMultiplier: 2,                                // exaggerate throws
  cursor: { onHover: 'grab', onGrab: 'move' },
  onRelease: (self) => console.log('thrown at', self.velocity, 'angle', self.angle),
});
```

### 4. Snap carousel with function-based container (from `vendor/anime/examples/draggable-mouse-scroll-snap-carousel`)

```js
import { createDraggable, utils } from 'animejs';

const $carousel = document.querySelector('.carousel');
let itemWidth = 0, totalWidth = 0;
const measure = () => {
  const items = utils.$('.carousel-item');
  itemWidth = items[0].offsetWidth;
  totalWidth = items.reduce((t, $el) => t + $el.offsetWidth, 0);
};
measure();

createDraggable($carousel, {
  trigger: document.body,
  // [top, right, bottom, left] px bounds, re-evaluated on refresh/resize:
  container: () => [0, 0, 0, -totalWidth + $carousel.offsetWidth],
  x: { snap: () => itemWidth },
  y: false,
  releaseStiffness: 100,
  velocityMultiplier: 1.5,
  containerFriction: 0.5,
  onResize: () => measure(),
  onAfterResize: (self) => self.setX(utils.snap(self.x, self.snapX)),
});
```

### 5. Dragging a plain JS object (non-DOM) for an infinite carousel

```js
import { createDraggable, createAnimatable, createTimer, utils } from 'animejs';

const state = { width: 2000, speedX: 2 };           // plain object target!
const carousel = createAnimatable('.carousel', {
  x: 0, modifier: (v) => utils.wrap(v, -state.width / 2, 0),
});

const draggable = createDraggable(state, {           // DOMProxy wraps the object
  trigger: '#infinite-carousel',
  y: false,
  releaseStiffness: 20,
  onGrab: () => (state.speedX = 0),
  onRelease: () => (state.speedX = 2),
});

createTimer({
  onUpdate: () => carousel.x(/** @type {number} */ (carousel.x()) - state.speedX + draggable.deltaX),
});
```

### 6. Swipe card (Tinder-style flick)

```js
import { createDraggable, animate } from 'animejs';

const FLICK = 1.2; // horizontal velocity threshold (px/ms)

const d = createDraggable('.card', {
  container: () => [0, 0, 0, 0], // zero-size bounds at origin → always snaps back
  releaseStiffness: 120,
  onRelease: (self) => {
    // velocity is unsigned; project onto x to measure the horizontal flick
    const vx = Math.cos(self.angle) * self.velocity;
    if (Math.abs(vx) < FLICK) return;           // soft release → spring-back runs
    self.stop();                                 // cancel the snap-back animations
    self.disable();
    const dir = vx > 0 ? 1 : -1;
    // position transforms are OWNED by the draggable — exit via its Animatable:
    d.animate.translateX(dir * window.innerWidth, 400, 'out(3)');
    animate(self.$target, {                      // non-owned props in a parallel animate()
      rotate: dir * 18,
      opacity: 0,
      duration: 400,
      onComplete: () => onSwiped(dir > 0 ? 'right' : 'left'),
    });
  },
});
```

Key facts this pattern depends on: `onRelease` fires AFTER the release animations start
(so `self.stop()` can cancel them); the snap-back to origin comes from the zero-size array
container; `translateX/translateY` belong to the draggable's internal Animatable (never
run a separate `animate()` on them — other transforms like `rotate` are fine).

### Cleanup (React/Next.js)

```js
useEffect(() => {
  const d = createDraggable('.box', { container: '.zone' });
  return () => d.revert();   // removes listeners, styles, ResizeObserver
}, []);
```

## Gotchas

- **`x: false` / `y: false` to lock an axis** — locking sets `touch-action: pan-x`/`pan-y`
  on the trigger so native page scroll keeps working on the locked axis; both axes enabled
  sets `touch-action: none`.
- **Bounds only exist when `container` is set.** Without it, `$container` is `document.body`
  but `contained` is `false` — movement is unbounded and `progressX/Y` are meaningless.
- **Array container = `[top, right, bottom, left]`** px offsets relative to the target's
  starting position (e.g. `[0, 0, 0, -500]` allows dragging 500px to the left only).
  Array containers **disable auto-scroll** (`canScroll` is forced false).
- **`containerFriction` is inverted from intuition**: it's resistance, not slipperiness.
  `1` = hard clamp at bounds; default `0.8` = gentle rubber-band (out-of-bounds movement ×0.2).
- **Velocity model**: release momentum travel distance = `velocity * 150` px along `angle`
  (radians). Velocity = `px/ms × velocityMultiplier`, clamped to `[0, 50]` by default,
  computed as the max of the last 3 samples taken ≥17 ms apart (`computeVelocity`).
- **`releaseEase` does double duty**: pass `spring(...)` for true spring physics with
  velocity injection; pass a normal ease and out-of-bounds release instead runs two blended
  overshoot animations (`composition: 'blend'`) toward `bx/by` then `dx/dy` (source:
  `vendor/anime/src/draggable/draggable.js` `handleUp()`). `releaseMass/Stiffness/Damping`
  are **ignored** when `releaseEase` is a spring.
- **No `minDuration` / `isDragging`** in v4.4.1 — use the spring params for release timing
  and the `dragged`/`grabbed` flags for state.
- **The target's transform is owned by the draggable** (`translateX/translateY` via an
  internal Animatable). Don't run a separate `animate()` on the same transforms — either
  use `draggable.animate.translateX(...)`, `setX/setY`, or `mapTo` to other properties.
- **z-index is hijacked on grab**: a module-level counter bumps the target's `zIndex` above
  the highest grabbed-so-far; reverted on `disable()`/`revert()`.
- **`onRelease` fires after release animations start** — call `self.stop()` inside it to
  cancel momentum. `onSettle` only fires when everything is at rest, and `onUpdate` is
  skipped on frames where the position didn't actually change.
- **Function params are live**: `container`, `snap`, `containerPadding`, friction, speeds,
  velocities, `cursor`, `dragThreshold` all re-evaluate on `refresh()` (auto-run after
  resize, debounced 150 ms). Static numbers are frozen until `refresh()`.
- **`<input type="range">` inside the trigger is ignored** by `handleDown` so sliders keep
  working; native scrollable children also keep touch-scrolling (the drag yields to them
  unless they're at their scroll edge).
- **Always `revert()` on teardown** — the draggable holds document-level listeners, a
  `ResizeObserver`, three internal `Timer`s, and injected styles.
- **`refresh()` clamps the current position into the new bounds** but does not preserve
  `progressX/Y` ratios (that logic is commented out in source); re-position manually in
  `onAfterResize` if needed.