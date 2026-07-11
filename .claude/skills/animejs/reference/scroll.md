# onScroll() — ScrollObserver (anime.js v4.4.1)

Scroll-linked triggering and scrubbing. `onScroll()` returns a `ScrollObserver` that either
drives a linked animation/timeline/timer (via `autoplay:` or `.link()`) or works standalone
through its callbacks. This is anime.js v4's replacement for "ScrollTrigger-style" behavior.

## Import

```js
import { onScroll } from 'animejs';
// also exported: ScrollObserver (class), scrollContainers (Map<HTMLElement, ScrollContainer>)
```

## API

```ts
onScroll(parameters?: ScrollObserverParams): ScrollObserver
```

All option values below come straight from `vendor/anime/src/events/scroll.js` (`refresh()`, lines 586-598, and the constructor).

| Param | Type | Default | Description |
|---|---|---|---|
| `container` | `TargetsParam` (selector/element) | `document.body` (= window scroll) | The scrollable element. One shared `ScrollContainer` is cached per element in `scrollContainers`. |
| `target` | `TargetsParam` | first DOM target of the linked animation, else `document.body` | Element whose position defines enter/leave bounds. Resolved on the **next frame** (so `.link()` can supply it). |
| `axis` | `'x' \| 'y'` or `(observer) => 'x'\|'y'` | `'y'` | Scroll axis to observe. |
| `enter` | `ScrollThresholdValue \| {container, target} \| number \| (observer) => ...` | `'end start'` | Where progress = 0. String format is `'<container> <target>'` (container threshold FIRST). Default = target start meets container end (element top enters viewport bottom). |
| `leave` | same as `enter` | `'start end'` | Where progress = 1. Default = target end meets container start (element bottom exits viewport top). |
| `sync` | `boolean \| number \| string (ease or method names) \| EasingFunction` | `'play pause'` | How scroll drives the linked object. See "Sync modes" below. |
| `repeat` | `boolean \| (observer) => boolean` | `true` | If `false`, the observer auto-`revert()`s itself once completed (one-shot). With a linked object, only after `linked.completed`. |
| `debug` | `boolean` | `false` | Renders a color-coded threshold/trigger visualizer inside the container. |
| `id` | `number \| string` | auto-incrementing index | Label shown in the debug overlay. |
| `onEnter` ... `onSyncComplete` | `Callback<ScrollObserver>` | `noop` | See Callbacks table. |

`enter`, `leave`, `axis`, and `repeat` may be functions of the observer — they are re-evaluated on every `refresh()` (responsive values).

### Threshold value syntax (per side of `'<container> <target>'`)

Parsed by `convertValueToPx()` / `parseBoundValue()` (src/events/scroll.js:331-387):

| Value | Meaning |
|---|---|
| `'start'` / `'top'` / `'left'` | `0` (start edge of target or container, in scroll direction) |
| `'end'` / `'bottom'` / `'right'` | `'100%'` (end edge) |
| `'center'` | `'50%'` |
| `'min'` | `'start'` clamped to a reachable scroll position (use for targets near document start) |
| `'max'` | `'end'` clamped to max scroll (use for targets near document end) |
| number (e.g. `100` or `'100'`) | pixels |
| `'85%'` | percent of target size (target side) or container size (container side) |
| `'10rem'`, `'50vh'`, ... | any CSS unit, converted to px against the target element |
| `'start+=100'`, `'center-=2rem'`, `'end*=0.5'` | relative operators `+=` `-=` `*=` on any keyword/value |
| `'min+=100'`, `'max-=200'` | relative + clamped to reachable scroll range |

Other accepted shapes:
- Object: `enter: { container: 'end', target: 'start' }` (either key optional).
- Single string without space: container threshold only (`enter: 'top'` → container `top`, target keeps its default `start`; for `leave` the target default is `end`).
- Bare number: container threshold in px (`enter: 0` → target start meets container start).

### Sync modes (constructor, src/events/scroll.js:416-428)

`sync` is disambiguated in this order — an unknown string falls through to "method names":

| Value | Mode | Behavior |
|---|---|---|
| `'play pause'` *(default)* | playback methods | Calls `linked.play()` on enter, `linked.pause()` on leave. Any 1-2 space-separated Tickable method names work (`'play'`, `'play reverse'`, ...). |
| 4 method names, e.g. `'play pause resume reverse'` | bidirectional methods | `[enterForward, leaveForward, enterBackward, leaveBackward]`. >2 names switches to this mapping (3rd/4th optional). |
| `true` or `'linear'` | scrub | `linked.seek(duration * progress)` 1:1 with scroll. |
| number `0 < n <= 1` | smooth scrub | Lerped follow: `p = lerp(linkedProgress, scrollProgress, lerp(0.01, 0.2, n))`. Smaller = laggier/smoother; `1` = instant. Engine keeps ticking after scroll stops until caught up. |
| ease name string (`'inOutQuad'`, `'out(3)'`, ...) or easing function | eased scrub | `linked.seek(duration * ease(progress))`. |
| `false` | observer only | No sync flag; linked object (if any) stays paused. Use plain callbacks. |

Method-name strings call `this.linked[name]()` — valid names are any linked method: `play`, `pause`, `resume`, `reverse`, `restart`, `alternate`, `complete`, `cancel`, `revert`.

## Callbacks

All receive the `ScrollObserver` as the only argument.

| Callback | Fires |
|---|---|
| `onEnter(self)` | target enters the [enter, leave] scroll window (any direction) |
| `onEnterForward(self)` / `onEnterBackward(self)` | enter while scrolling forward / backward |
| `onLeave(self)` | target leaves the window (any direction) |
| `onLeaveForward(self)` / `onLeaveBackward(self)` | leave while scrolling forward / backward |
| `onUpdate(self)` | every processed scroll tick while in view (plus the leave frame); in seek modes only when eased/smoothed progress actually changed |
| `onSyncComplete(self)` | progress reached 1 and the sync cycle finished (seek modes: when `linked.progress === 1`; method modes: on leave) |
| `onResize(self)` | after the container's debounced (~250 ms) resize refresh |

## Methods & properties

| Member | Returns | Description |
|---|---|---|
| `.link(anim)` | `this` | Attach a Timer/Animation/Timeline/WAAPIAnimation. **Pauses it immediately**; forces `persist = true` on WAAPI animations; adopts its first DOM target as `target` if none was given. |
| `.refresh()` | `this` | Re-evaluates function params (`enter/leave/axis/repeat`), re-measures bounds, re-runs scroll handling. Call after DOM changes that move the target. |
| `.revert()` | `this` | Removes the observer; reverts the shared container (listeners + ResizeObserver) when it was the container's last observer. Does NOT revert the linked animation. |
| `.debug()` / `.removeDebug()` | — | Add/remove the visual overlay manually. |
| `.progress` | getter `0..1` | `(scroll - offsetStart) / distance`, clamped, rounded to 6 decimals (`0` when distance is 0). |
| `.scroll` | getter px | Container scroll position on the observed axis (rounded to int). |
| `.velocity` | getter | Container scroll velocity in px/ms (sampled at 30 fps, shared per container). |
| `.backward` | getter bool | Scrolling backward on the observed axis. |
| `.isInView` / `.began` / `.completed` | bool | State flags. |
| `.target` / `.container` / `.linked` / `.id` | — | Resolved values. |

## Attaching to animations and timelines

Pass the observer as `autoplay`. `Timer.init()` (src/timer/timer.js:349-350) detects a ScrollObserver
(`autoplay.linked !== undefined`) and calls `observer.link(this)`. Works for `animate()`,
`createTimer()`, `createTimeline()`, the WAAPI flavor (`src/waapi/waapi.js:360`), and `createLayout` transitions.

```js
animate('.el', { x: 100, autoplay: onScroll({ sync: true }) });
```

`animation.revert()` also reverts its attached observer (src/timer/timer.js:483-487).

## Examples

### 1. Play on enter, pause on leave (defaults)

```js
import { animate, onScroll } from 'animejs';

animate('.card', {
  y: [50, 0],
  opacity: [0, 1],
  duration: 600,
  // sync defaults to 'play pause'; target defaults to the first '.card' element
  autoplay: onScroll({ enter: 'bottom-=50 top' }),
});
```

### 2. One-shot reveal (no replay, observer self-destructs)

```js
import { animate, onScroll, stagger } from 'animejs';

animate('.feature', {
  opacity: [0, 1],
  y: ['2rem', 0],
  delay: stagger(80),
  autoplay: onScroll({
    enter: '80% top',   // target top reaches 80% of viewport height
    sync: 'play',       // only play, never pause/reverse
    repeat: false,      // observer reverts itself after completion
  }),
});
```

### 3. Scrubbed timeline pinned to a sticky section

```js
import { createTimeline, onScroll } from 'animejs';

createTimeline({
  defaults: { ease: 'linear', duration: 500 },
  autoplay: onScroll({
    target: '.sticky-container',  // tall wrapper around a position:sticky element
    enter: 'top top',             // container top meets target top  -> progress 0
    leave: 'bottom bottom',       // container bottom meets target bottom -> progress 1
    sync: 0.5,                    // smooth follow (1 = instant, smaller = smoother)
    debug: true,                  // visualize thresholds while building
  }),
})
.add('.stack', { rotateY: [-180, 0] }, 0)
.add('.card',  { y: '-60%' }, 0);
```

### 4. Standalone observer (progress bar, no linked animation)

```js
import { onScroll, utils } from 'animejs';

const setWidth = utils.set; // or an Animatable
const observer = onScroll({
  target: 'article',
  enter: 'top top',
  leave: 'bottom bottom',
  onUpdate: (self) => utils.set('.progress', { scaleX: self.progress }),
  onEnterForward: () => document.body.classList.add('reading'),
  onLeaveBackward: () => document.body.classList.remove('reading'),
});

// later (e.g. component unmount):
observer.revert();
```

### 5. Custom scroll container + horizontal axis + `.link()`

```js
import { animate, onScroll } from 'animejs';

const anim = animate('.slide', { x: '-100vw', ease: 'linear', duration: 1000 });

onScroll({
  container: '.scroll-x-wrapper',  // any overflowed element, not just window
  target: '.slide-track',
  axis: 'x',
  enter: 'right left',
  leave: 'left right',
  sync: 'inOut(2)',               // eased scrub: seek(duration * ease(progress))
}).link(anim);                    // link() pauses anim and takes control
```

## Gotchas

- **Threshold string order is `'container target'`**, not target-first. `enter: 'bottom top'` = "container bottom meets target top". A single value sets only the container side.
- **Default `sync` is `'play pause'`**, NOT scrub. For scroll-scrubbing you must pass `sync: true`, a number, or an ease. With the default + `repeat: true` (also default), the animation re-plays on every re-entry and pauses on every exit.
- `.link()` / `autoplay: onScroll()` **immediately pauses** the linked object — never call `.play()` yourself; the observer owns playback.
- `repeat: false` makes the observer **revert (destroy) itself** after completing once; with a linked object only once `linked.completed` is true. Re-creating requires a new `onScroll()`.
- `target`/`container` selectors are resolved **one frame after creation** (deferred via `sync()` in the constructor, src/events/scroll.js:525-533). A selector matching nothing silently falls back to `document.body` — a common cause of "progress always 0/weird bounds".
- Sync-mode disambiguation: any string that parses as a valid ease (`'linear'`, `'inOutQuad'`, `'out(3)'`...) becomes eased/scrub mode, never method names. `'linear'` and `true` are identical (direct scrub).
- `observer.revert()` does **not** revert the linked animation, but `animation.revert()` DOES revert its attached observer. Observers auto-register with the active `createScope()`, so `scope.revert()` cleans them up too (best pattern for React/Next.js).
- Containers are cached and shared per element (`scrollContainers` Map). Scroll/resize listeners are removed only when the **last** observer of that container is reverted.
- During `updateBounds()` measurement, any `position: sticky` ancestor of the target is temporarily set to `static`, and `linked.seek(0, true)` / restore runs — avoid calling `.refresh()` every frame.
- `debug: true` appends overlay divs to the container and forces `position: relative` on a static container (reverted on `removeDebug()`/`revert()`).
- Units: bare numbers are px; `%` on the target side is relative to target size, on the container side relative to container size; other CSS units are converted against the **target** element. All bound values are rounded to whole px.
- `'min'`/`'max'` are clamped `'start'`/`'end'` — use them for targets near the very top/bottom of the page where the normal trigger positions can never be reached by scrolling.
- Smooth sync (`sync: n < 1`) keeps the engine ticking after scrolling stops (container `wakeTicker` restarts until linked progress catches up) — `onUpdate` continues firing during that settle phase.
- Window scrolling is keyed to `document.body`; viewport height uses `100lvh` (large viewport) to avoid mobile URL-bar jumps (src/events/scroll.js:99-106).
- WAAPI animations get `persist = true` forced on link, otherwise they would stop syncing after finishing.
