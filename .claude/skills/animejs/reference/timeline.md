# Timeline — `createTimeline()`

Sequencing container for animations, timers and other timelines. `Timeline extends Timer`, so every Timer playback method/getter (play, pause, seek, progress, …) works on a timeline. A timeline's duration starts at `0` and grows as children are added (`vendor/anime/src/timeline/timeline.js`).

## Import

```js
import { createTimeline } from 'animejs';
// class is also exported if you need instanceof checks:
import { Timeline } from 'animejs';
```

## API

### `createTimeline(parameters?: TimelineParams): Timeline`

Creates the timeline and immediately calls `.init()` (renders children initial states). All parameters are optional.

| Param | Type | Default | Description |
|---|---|---|---|
| `defaults` | `DefaultsParams` | `globals.defaults` | Defaults inherited by **every child** added to this timeline (e.g. `duration`, `ease`, `composition`, callbacks). Merged over global defaults via `mergeObjects(defaults, globals.defaults)`. |
| `playbackEase` | `EasingParam` | `null` | Eases the playback of the **entire timeline** progress (parsed with `parseEase`). |
| `composition` | `Boolean` | `true` | When `true`, each `.add()` ticks the timeline to the insert position and inits the child immediately (correct start-value chaining). `false` skips this (cheaper build, lazy value resolution). Note: this is a *Boolean*, unlike the per-animation `composition: 'replace'|'none'|'blend'`. |
| `id` | `String\|Number` | auto-increment | Timeline id. |
| `delay` | `Number` | `0` | Delay before the whole timeline starts. |
| `loop` | `Number\|Boolean` | `0` | Extra iterations. `true`, `Infinity` or negative → infinite. Total iterations = `loop + 1`. |
| `loopDelay` | `Number` | `0` | Pause between iterations. |
| `reversed` | `Boolean` | `false` | Start in reverse. |
| `alternate` | `Boolean` | `false` | Alternate direction each loop. |
| `autoplay` | `Boolean\|ScrollObserver` | `true` | `false` = start paused; a `ScrollObserver` (from `onScroll()`) links playback to scroll. |
| `playbackRate` | `Number` | `1` | Speed multiplier (also settable later via `tl.speed`). |
| `frameRate` | `Number` | `240` (maxFps) | FPS cap. |
| `onBegin/onUpdate/onBeforeUpdate/onLoop/onPause/onComplete` | `Callback<Timeline>` | `noop` | Tickable callbacks. |
| `onRender` | `Callback<Timeline>` | `noop` | Fired on every render of the timeline. |

Global default `duration` is `1000` ms and `ease` is `'out(2)'` — children inherit these unless overridden by `defaults` or per-child params.

### Time position syntax (`TimelinePosition`)

3rd arg of `.add(targets, params, position)` / 2nd arg of `.add(timerParams, position)`, `.set()`, `.call()`, `.label()`, `.sync()`. Parsed by `parseTimelinePosition` (`vendor/anime/src/timeline/position.js`).

| Position | Meaning |
|---|---|
| *(omitted)* | Append at the **end of the last child** (`tl.iterationDuration`). Default sequencing. |
| `Number` | Absolute time in ms (e.g. `500`). |
| `'+=N'` | N ms **after** the current timeline end (creates a gap). |
| `'-=N'` | N ms **before** the current timeline end (overlap). |
| `'*=N'` | Fraction of the current timeline duration (`'*=.5'` = halfway of what's been built so far). |
| `'<'` | At the **end** of the previously added child (`prev._offset + prev._delay + prev.duration`). |
| `'<<'` | At the **start** of the previously added child (`prev._offset + prev._delay`). |
| `'<+=N'` / `'<-=N'` | Relative to previous child's end. |
| `'<<+=N'` / `'<<-=N'` | Relative to previous child's start (e.g. `'<<+=250'`). |
| `'myLabel'` | At a label created with `.label('myLabel', pos)`. Unknown bare label silently falls back to timeline end. |
| `'myLabel+=N'` / `'myLabel-=N'` | Relative to a label position. Label **must exist** or result is `NaN`. |
| `stagger(...)` (function) | Per-target position: each target becomes its own child animation (see Methods/add). |

### Methods (Timeline-specific)

All return `this` (chainable).

| Method | Signature | Notes |
|---|---|---|
| `add` (animation) | `add(targets: TargetsParam, params: AnimationParams, position?: TimelinePosition \| StaggerFunction)` | Adds a `JSAnimation`. With a function position (e.g. `stagger(100)`), targets are split into one animation per target — ids become `id-0`, `id-1`, … and the stagger fn gets `(target, i, targets, null, tl)`. |
| `add` (timer) | `add(timerParams: TimerParams, position?: TimelinePosition)` | First arg is an *object* → adds a `Timer` child (no targets). |
| `sync` | `sync(synced?: Tickable \| WAAPIAnimation \| globalThis.Animation, position?)` | Nests another timeline/animation/WAAPI animation. Pauses it, reads its duration, then drives it by animating `currentTime: [0, duration]` with `ease: 'linear', playbackEase: 'linear'`. Sets `persist = true` on WAAPI animations so they keep syncing after finish. No-op if `synced` has no `.pause`. |
| `set` | `set(targets, params: AnimationParams, position?)` | Instant setter: forces `duration = minValue (1e-11)` and `composition: 'replace'`. Internally inserted at `position - minValue` so the value is applied exactly *at* `position`. |
| `call` | `call(callback: (tl) => void, position?)` | Adds `{ duration: 0, delay: 0, onComplete: () => callback(this) }`. Callback receives the **timeline**. Non-function args are ignored. |
| `label` | `label(name: String, position?)` | Stores `labels[name] = parsed position` (default: current end). Define a label *before* using it in another `.add()`. |
| `remove` | `remove(targets, propertyName?: String)` | Removes targets (or one property of them) from all child renderables. |
| `stretch` | `stretch(newDuration: Number)` | Rescales every child (`child.stretch(child.duration * scale)`), all label positions, and own `_offset/_delay/_loopDelay` to fit `newDuration`. |
| `refresh` | `refresh()` | Calls `.refresh()` on children that have one (JSAnimations) — re-evaluates function-based / relative values. Use before `.restart()`. |
| `revert` | `revert()` | Reverts timer + all children + reverts inline styles (`revertValues`). Use for cleanup (e.g. React unmount). |
| `init` | `init(internalRender = false)` | Renders children initial state and resets. Already called by `createTimeline()`; rarely needed manually. |
| `then` | `then(callback?) => Promise` | Awaitable; resolves on completion (resolved object has `then: null` to avoid async recursion). |

### Inherited from Timer (playback)

| Method / Property | Behavior |
|---|---|
| `play()` / `reverse()` | Play forward / backward (flips via `alternate()` if needed), then `resume()`. |
| `pause()` / `resume()` | Pause / resume (fires `onPause`). |
| `restart()` | `reset().resume()` — back to 0 and play. |
| `seek(time, muteCallbacks = 0)` | Jump to `time` (ms, before `playbackEase`). Stays paused if it was paused. |
| `complete(muteCallbacks = 0)` | Seek to end and cancel. |
| `cancel()` | Cancels all children, removes from engine. |
| `alternate()` | Toggle direction in place. |
| `currentTime`, `progress` (0–1), `iterationProgress`, `currentIteration` | Read/write getters/setters. |
| `speed` | Playback rate getter/setter (resets internal clock on set). |
| `duration`, `iterationDuration`, `labels`, `paused`, `began`, `completed`, `reversed` | State. `duration` = `(iterationDuration + loopDelay) * iterationCount - loopDelay`. |

## Examples

### 1. Sequencing with defaults, overlap and labels

```js
import { createTimeline } from 'animejs';

const tl = createTimeline({
  defaults: { duration: 600, ease: 'inOut(3)' }, // inherited by all children
  loop: 2,
  alternate: true,
});

tl.add('.box', { x: 240 })                  // starts at 0
  .add('.box', { rotate: '1turn' }, '-=200') // overlaps previous by 200ms
  .label('SHAPES')                           // label at current end
  .add('.circle', { scale: [0, 1] }, 'SHAPES')
  .add('.triangle', { y: -64 }, '<<+=100');  // 100ms after .circle's start
```

### 2. Setters, callbacks and absolute positions

```js
import { createTimeline, utils } from 'animejs';

const tl = createTimeline({ autoplay: false })
  .set('.dot', { opacity: 0, scale: 0 })          // instant, at t=0
  .add('.dot', { opacity: 1, scale: 1, duration: 400 }, 500) // absolute: 500ms
  .call(self => console.log('halfway', self.currentTime), '*=.5')
  .add({ duration: 800, onUpdate: t => utils.set('#counter', { innerHTML: Math.round(t.progress * 100) }) }, '<'); // Timer child

document.querySelector('#play').onclick = () => tl.restart();
```

### 3. Per-target stagger positions

```js
import { createTimeline, stagger } from 'animejs';

createTimeline()
  .add('.row', { x: 100, duration: 500 }, stagger(80))           // one child per .row, 80ms apart
  .add('.row', { opacity: 0 }, stagger(50, { from: 'last' }));   // positions, not delays
```

### 4. Nesting with sync()

```js
import { createTimeline, animate, waapi } from 'animejs';

const intro = createTimeline().add('.logo', { y: [-40, 0] }).add('.tagline', { opacity: [0, 1] });
const pulse = animate('.cta', { scale: 1.1, alternate: true, loop: 1 });

createTimeline()
  .sync(intro)                 // nested timeline at 0
  .sync(pulse, '-=300')        // JSAnimation, overlapping
  .sync(waapi.animate('.bg', { opacity: [0, 1], duration: 1000 }), '<'); // WAAPI too
```

### 5. Await, stretch, refresh

```js
import { createTimeline, utils } from 'animejs';

const tl = createTimeline()
  .add('.el', { x: () => utils.random(0, 300) });

await tl;              // resolves on complete
tl.stretch(2000);      // rescale whole timeline (children + labels) to 2s
tl.refresh().restart() // re-evaluate the function-based x, replay
```

## Gotchas

- **v3 → v4**: there is no `anime.timeline({ targets })`. Use `createTimeline(params)` then `.add(targets, params, position)` — targets are the *first* argument of `.add()`, position the *third*.
- **Two `.add()` shapes**: `add(targets, animParams, position?)` vs `add(timerParams, position?)`. Dispatch is by type: if the **2nd arg is an object** it's an animation; else if the 1st arg is an object it's a Timer. If neither matches, `add()` returns `undefined` (no error) — breaking your chain.
- **`'+='`/`'-='`/`'*='` are relative to the timeline's current end** (`iterationDuration`, i.e. what's been built so far), not to the previous child. Use `'<+=N'` / `'<<+=N'` for previous-child-relative offsets.
- **`'<'` on an empty timeline throws** (`prevAnimation.duration` on `null`, `src/timeline/position.js:41`). `'<<'` on an empty timeline returns 0.
- **Label order matters**: `.label('x')` must be called before any `.add(..., 'x')` that uses it. A bare unknown label silently resolves to the timeline end; `'unknownLabel+=100'` yields `NaN` (silent breakage).
- **Defaults inheritance**: child params resolve against `tl.defaults` (which already merged `globals.defaults`), not directly against globals. Per-child params always win. Child `autoplay` is forced `false` (`src/timer/timer.js:197`).
- **`.set()`/`call()`/zero-duration children are nudged back by `1e-11` ms** so their end value lands exactly *at* the given position — at time `position` the value is already applied.
- **Default position appends to `iterationDuration`**, so a child's `loop` multiplies its own duration into the timeline length (`child._offset + child._delay + child.duration` where `duration` is the child's *total* looped duration). An infinitely-looping child makes the timeline duration effectively infinite (clamped to `1e12`).
- **`composition: true` (default) ticks the timeline on every `.add()`** and re-inits — correct start-value chaining for sequenced transforms on the same target, but O(n) work per add. `composition: false` skips it; only use when children don't chain values on the same targets.
- **`sync()` requires a pausable**: objects without `.pause` are ignored. Synced WAAPI animations get `persist = true` (otherwise they stop syncing after finish). The child created by `sync()` animates `currentTime` linearly — the synced object's own ease is preserved; don't add another ease.
- **`stretch()` rescales labels and child delays too**; `stretch(0)` turns the timeline into a setter (`duration = minValue`).
- **Cleanup**: `revert()` (not just `pause()`) cancels children, unlinks any `ScrollObserver` autoplay and restores inline styles — use it in React/Vue unmount (or wrap everything in `createScope()` and call `scope.revert()`).
- **`call()` callbacks fire via `onComplete` of a 0-duration timer** — when scrubbing/seeking backwards over them they can re-fire; mute with `seek(t, true)` if needed.
