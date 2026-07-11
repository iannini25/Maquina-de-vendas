# anime.js v4 — `createTimer()` / `Timer` & the `engine` object

Timers are the base scheduling primitive of anime.js v4. The `Timer` class (src/timer/timer.js)
is the parent class of `JSAnimation` and `Timeline`, so **everything documented here (params,
callbacks, methods, properties) also applies to `animate()` and `createTimeline()` results**.
The `engine` singleton (src/engine/engine.js) is the global clock that ticks every timer.

## Import

```js
import { createTimer, Timer, engine } from 'animejs';
```

`createTimer(parameters)` is literally `new Timer(parameters, null, 0).init()` (src/timer/timer.js:531).

## API — `createTimer()`

```ts
createTimer(parameters?: TimerParams): Timer
// TimerParams = TimerOptions & TickableCallbacks<Timer>
```

All parameters are optional. Defaults below come from `src/core/globals.js` (`defaults`) and
the `Timer` constructor (src/timer/timer.js).

| Param | Type | Default | Description |
|---|---|---|---|
| `id` | `number \| string` | auto-incremented number | Identifier (also shown in devtools/editor). |
| `duration` | `number \| FunctionValue` | **`Infinity`** | Duration of ONE iteration in current time unit (ms by default). NOTE: timers default to `Infinity`, NOT the global `defaults.duration` (1000) used by animations. Internally clamped to `1e12`. |
| `delay` | `number \| FunctionValue` | `0` | Delay before the timer starts. While delaying, `currentTime` goes from `-delay` to `0`. |
| `loop` | `number \| boolean` | `0` | Extra iterations. `loop: N` ⇒ `iterationCount = N + 1` total plays. `true`, `Infinity` or any negative number ⇒ infinite. |
| `loopDelay` | `number` | `0` | Pause between iterations. Total `duration = (iterationDuration + loopDelay) * iterationCount - loopDelay`. |
| `reversed` | `boolean` | `false` | Start playing backwards. |
| `alternate` | `boolean` | `false` | Ping-pong direction on each loop. |
| `autoplay` | `boolean \| ScrollObserver` | `true` | `true` ⇒ resume on creation. Pass an `onScroll()` ScrollObserver to link playback to scroll. `false` ⇒ created paused. |
| `frameRate` | `number` | `240` (`maxFps`) | Per-timer fps cap. Only throttles when LOWER than the engine fps. |
| `playbackRate` | `number` | `1` | Speed multiplier (also exposed as the `.speed` property). Clamped to a minimum of `1e-11`. |
| `priority` | `number` | `1` | Tick order inside the engine: higher priority ⇒ inserted later in the list ⇒ updated later each frame. |

### Callbacks (all default to `noop`; signature `(self: Timer, e?: PointerEvent) => any`)

Firing order within one tick (src/core/render.js): `onBegin` → `onLoop` → `onBeforeUpdate` → (render) → `onUpdate` → `onComplete`.

| Callback | Fires |
|---|---|
| `onBegin` | Once, the first time `currentTime > 0` (i.e. after the delay). Reset by `reset()`/`restart()`. |
| `onBeforeUpdate` | Every tick while active, before values render. |
| `onUpdate` | Every tick while active, after values render. |
| `onLoop` | Each time `currentIteration` changes (never for `loop: 0`). |
| `onPause` | When `.pause()` is called (NOT when setting `.paused = true` directly). |
| `onComplete` | Once when the last iteration reaches its end (then the timer auto-pauses and is auto-cancelled by the engine). Also resolves the `.then()` promise. |

## Methods — all chainable (`return this`)

| Method | Signature | Behavior |
|---|---|---|
| `play()` | `(): this` | Resume forward. If currently reversed, un-reverses first (calls `alternate()`). |
| `reverse()` | `(): this` | Resume backward. If currently forward, reverses first. |
| `pause()` | `(): this` | Pause + fire `onPause`. The engine removes the paused timer from its list on the next frame. |
| `resume()` | `(): this` | Resume in the CURRENT direction (unlike `play()`). Re-registers with the engine and wakes it. |
| `restart()` | `(): this` | `reset().resume()` — back to 0, flags cleared, plays again. |
| `seek(time, muteCallbacks?, internalRender?)` | `(number, boolean\|number = 0, boolean\|number = 0): this` | Jump to `time` (measured AFTER the delay: ticks at `time + _delay`). Clears `completed`. Keeps playing if it was playing. |
| `alternate()` | `(): this` | Flip direction in place (mirrors `iterationProgress` for infinite loops). |
| `stretch(newDuration)` | `(number): this` | Rescale `duration`, `iterationDuration`, `_delay`, `_loopDelay`, `_offset` proportionally. `newDuration <= 1e-11` turns it into a setter. |
| `cancel()` | `(): this` | Remove tween composition siblings (and cancel children), set `cancelled`, then `pause()`. |
| `revert()` | `(): this` | Seek to 0 with muted callbacks, revert a linked ScrollObserver, then `cancel()`. Use this for cleanup (React unmount etc.). |
| `complete(muteCallbacks?)` | `(boolean\|number = 0): this` | `seek(duration, muteCallbacks).cancel()` — jumps to end, fires `onComplete` unless muted. |
| `reset(softReset?)` | `(boolean = false): this` | Force-render back to 0, clear `paused/began/completed`, revive if cancelled. |
| `resetTime()` | `(): this` | Recompute `_startTime` from `now()` — prevents time jumps after speed changes. |
| `then(callback?)` | `(cb?): Promise` | Timer is thenable: `await timer` resolves on completion (immediately if already completed). |

## Properties (getters/setters on `Timer`)

| Property | Type | Notes |
|---|---|---|
| `currentTime` | `number` | Clamped to `[-delay, duration]`, rounded to `engine.precision` decimals. Setter pauses → seeks → resumes to avoid jumps. |
| `progress` | `number` | `0..1` over the TOTAL duration (all loops). Writable. |
| `iterationCurrentTime` | `number` | Time within the current iteration `[0, iterationDuration]`. Writable. |
| `iterationProgress` | `number` | `0..1` within the current iteration. Writable. |
| `currentIteration` | `number` | Current loop index (0-based). Writable (clamped to `iterationCount - 1`). |
| `duration` | `number` | TOTAL duration incl. loops & loopDelays (`Infinity` → `1e12`). |
| `iterationDuration` / `iterationCount` | `number` | One loop's duration / number of plays (`loop + 1`). |
| `speed` | `number` | Playback rate; setter calls `resetTime()` (min `1e-11`). |
| `fps` | `number` | Per-instance frame cap (min `1e-11`). |
| `deltaTime` | `number` | Time elapsed since previous tick (from `Clock`). |
| `paused` / `began` / `completed` / `backwards` | `boolean` | State flags. `backwards` is true while rendering in reverse. |
| `reversed` | `boolean` | Setter: `true` ⇒ `reverse()`, `false` ⇒ `play()`. |
| `cancelled` | `boolean` | Setter: `true` ⇒ `cancel()`, `false` ⇒ `reset(true).play()`. |
| `id` / `parent` | — | `parent` is the `Timeline` containing this timer, or `null`. |

## API — `engine` (singleton)

```js
import { engine } from 'animejs';
```

| Member | Type | Default | Description |
|---|---|---|---|
| `engine.timeUnit` | `'ms' \| 's'` | `'ms'` | Switching to `'s'` sets `globals.timeScale = 0.001`, scales `engine.defaults.duration` (1000 → 1) and engine speed, `tickThreshold` 200 → 0.2. All durations/delays are then written in seconds. |
| `engine.precision` | `number` | `4` | Decimal places values are rounded to (`globals.precision`). Lower for perf, raise for tiny value ranges. |
| `engine.fps` | `number` | `240` (`maxFps`) | Global frame cap; rAF still drives the loop, frames are skipped via `requestTick()`. |
| `engine.speed` | `number` | `1` | Global playback rate; setter re-applies every child's speed. |
| `engine.pauseOnDocumentHidden` | `boolean` | `true` | When `true`, a `visibilitychange` listener pauses/resumes the engine. `resume()` calls `resetTime()` on every child so no time jump. Set `false` to let timers catch up after tab switch. |
| `engine.useDefaultMainLoop` | `boolean` | `true` | Set `false` to disable the internal rAF loop and drive ticking yourself via `engine.update()`. |
| `engine.defaults` | `DefaultsParams` | see below | The MUTABLE global defaults object used by all timers/animations/timelines. |
| `engine.paused` | `boolean` | `true` (until first timer wakes it) | Engine state. |
| `engine.reqId` | `number` | `0` | Current rAF id; `0` means the loop is asleep (auto-sleeps when no active tickables, auto-wakes on any `resume()`). |
| `engine.update()` | method | — | Ticks all registered tickables once with `now()`. Call inside your own loop when `useDefaultMainLoop = false`. |
| `engine.pause()` | method | — | Kills the rAF loop (`cancelAnimationFrame`). All timers freeze. |
| `engine.resume()` | method | — | `resetTime()` on all children (no jump) and restarts the loop. |
| `engine.wake()` | method | — | Restarts the loop without touching child times (internal; `resume()` is the public path). |
| `engine.deltaTime` | `number` | — | ms elapsed between the last two engine ticks. |

### `engine.defaults` — every default value (src/core/globals.js)

| Key | Default | | Key | Default |
|---|---|---|---|---|
| `id` | `null` | | `duration` | `1000` (`K`; becomes `1` in `'s'` mode) |
| `keyframes` | `null` | | `delay` | `0` |
| `playbackEase` | `null` | | `loopDelay` | `0` |
| `playbackRate` | `1` | | `ease` | `'out(2)'` |
| `frameRate` | `240` | | `composition` | `'replace'` (`0`) |
| `loop` | `0` | | `modifier` | `v => v` |
| `reversed` | `false` | | `onBegin/onBeforeUpdate/onUpdate` | `noop` |
| `alternate` | `false` | | `onLoop/onPause/onComplete/onRender` | `noop` |
| `autoplay` | `true` | | `persist` | `false` |

Mutate them globally: `engine.defaults.ease = 'inOutQuad'; engine.defaults.duration = 600;`

## Examples

```js
// 1. Frame loop with delta time (replaces requestAnimationFrame bookkeeping)
import { createTimer } from 'animejs';
const loop = createTimer({
  frameRate: 60,
  onUpdate: self => render(self.deltaTime, self.currentTime),
});
// later: loop.pause(); loop.resume(); loop.revert();
```

```js
// 2. Countdown / repeating tick with loops
import { createTimer } from 'animejs';
createTimer({
  duration: 1000,     // one iteration = 1s
  loop: 4,            // 4 extra loops => 5 iterations total
  loopDelay: 250,
  onLoop:     self => console.log('iteration', self.currentIteration),
  onComplete: self => console.log('done at', self.currentTime), // total = (1000+250)*5 - 250
});
```

```js
// 3. Awaitable one-shot delay (Timer is thenable)
import { createTimer } from 'animejs';
await createTimer({ duration: 500 });          // resolves on complete
// or: createTimer({ duration: 500 }).then(self => next());
```

```js
// 4. Scrubbing a paused timer from UI
import { createTimer, utils } from 'animejs';
const timer = createTimer({ duration: 2000, autoplay: false, onUpdate: drawFrame });
slider.addEventListener('input', () => { timer.progress = +slider.value; }); // 0..1
playBtn.addEventListener('click', () => timer.paused ? timer.resume() : timer.pause());
```

```js
// 5. Drive anime.js from an external loop (Three.js / R3F / game engine)
import { engine } from 'animejs';
engine.useDefaultMainLoop = false;   // stop anime's own rAF
engine.timeUnit = 's';               // optional: author durations in seconds
function gameLoop() {
  engine.update();                   // ticks every animation/timer/timeline once
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

## Gotchas

- **Timer `duration` defaults to `Infinity`, not 1000.** Only animations fall back to
  `defaults.duration` (1000). An "infinite" timer's `duration` is internally clamped to
  `1e12` ms (`clampInfinity`, src/core/helpers.js:167), so `progress` of an infinite timer
  is effectively always ~0 — use `iterationProgress`/`currentTime` instead.
- **`loop: N` plays N+1 times** (`iterationCount = loop + 1`); `loop: true`, `Infinity`, or
  any negative value ⇒ infinite. Infinite loops never fire `onComplete`; the engine restarts
  them by offsetting `_startTime` (src/core/render.js:287).
- **`play()` ≠ `resume()`**: `play()` forces forward direction (un-reverses), `resume()`
  continues in the current direction. Same for `reverse()` vs `resume()` when reversed.
- **`seek(t)` is post-delay**: it ticks at `t + delay` (src/timer/timer.js:413). During the
  initial delay, `currentTime` is negative (clamped at `-delay`). `seek()` also clears
  `completed` so a subsequent `play()` continues from there instead of restarting.
- **Cleanup**: `pause()` only freezes (the engine drops it next frame, and a completed timer is
  auto-`cancel()`ed by `engine.update`). `cancel()` releases tween composition siblings.
  `revert()` = seek-to-0 (muted) + cancel + revert linked ScrollObserver — use `revert()` in
  React/Vue unmount or `createScope(...).revert()`.
- **Don't set `timer.paused = true` directly** — it removes the timer from the engine but
  skips the `onPause` callback and the resume bookkeeping. Use `.pause()`/`.resume()`.
- **Per-timer `frameRate` only throttles below the engine fps** (`engine.update`:
  `activeTickable._fps < engineFps ? ... : tickModes.AUTO`). Also, `Clock`'s fps setter bumps
  the global `defaults.frameRate` up if you set a higher value (src/core/clock.js:62).
- **Changing `speed` mid-flight is safe** (the setter calls `resetTime()`), but writing
  `_speed` directly causes a time jump. Speeds below `1e-11` are clamped (no speed 0 — pause instead).
- **`engine.timeUnit = 's'` rescales `engine.defaults.duration` and engine speed once** —
  flip it before creating animations; existing instances keep their old timings.
- **Tab switch**: with the default `pauseOnDocumentHidden = true` everything resumes where it
  left off (no jump, `resume()` resets child times). With `false`, time keeps accruing and a
  jump > `tickThreshold` (200ms / 0.2s) is rendered as a forced "manual" tick on return
  (src/core/render.js:151).
- **The engine sleeps when idle** (`reqId = 0` when no tickables remain) and any
  `timer.resume()` wakes it — no work happens with zero active animations. In Node, ticking
  uses `setImmediate`/`clearImmediate` instead of rAF (src/engine/engine.js:44).
- **`priority`** (default `1`): the engine keeps tickables sorted ascending by priority; higher
  priority timers tick LATER each frame (their writes win for same-frame conflicts).
- A `duration <= 1e-11` (`minValue`) timer behaves as a setter: it force-renders immediately on
  `resume()` without joining the engine loop (src/timer/timer.js:378).
