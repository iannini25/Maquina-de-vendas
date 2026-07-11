# Layout — `createLayout()` / `AutoLayout` (FLIP-style auto layout transitions)

Animates DOM layout changes automatically (FLIP technique): you snapshot the layout, mutate the DOM (add/remove/move/reparent elements, toggle classes, resize), and the module diffs old vs new geometry and animates the difference. Position is animated via the CSS `translate` property, transforms via a synced WAAPI animation, sizes and CSS properties via a regular anime.js Timeline. Newest v4.x feature, source: `vendor/anime/src/layout/layout.js`.

## Import

```js
import { createLayout } from 'animejs';
// the class is also exported:
import { AutoLayout } from 'animejs';
```

## API

```ts
createLayout(root: DOMTargetSelector, params?: AutoLayoutParams): AutoLayout
// equivalent to: new AutoLayout(root, params)
```

`root` is the container whose subtree is tracked (first match if a selector). The **constructor immediately records the current state** as `oldState`, so `layout.animate()` can be called right after a mutation without an explicit first `record()`.

### `AutoLayoutParams` (constructor params)

| Param | Type | Default | Description |
|---|---|---|---|
| `children` | `DOMTargetSelector \| Array<DOMTargetSelector>` | `'*'` | Which elements are animation *targets*. `'*'` = every element under root. Custom selectors are queried from the **scope root (document)**, not the layout root — out-of-root matches are kept only if their `data-layout-id` matches an in-root node (enables shared-element transitions to modals/overlays). Non-target descendants are "swapped" mid-flight instead of tweened. |
| `properties` | `Array<String>` | — | Extra CSS properties to diff and animate, added to the built-in set: `opacity, fontSize, color, backgroundColor, borderRadius, border, filter, clipPath`. Kebab-case (`'background-color'`) and CSS custom properties (`'--overlay-alpha'`) work (read via `getPropertyValue`). |
| `duration` | `Number \| FunctionValue` | `350` | Per-node duration in ms (NOT the global 1000ms default). |
| `delay` | `Number \| FunctionValue` | `0` | Per-node delay; function values get `($el, index, targets)` so `stagger()` works. |
| `ease` | `EasingParam \| FunctionValue` | `'inOut(3.5)'` | Per-node ease. A `spring()` is detected (via `.ease` property) and its `settlingDuration` **overrides `duration`**. |
| `enterFrom` | `LayoutStateParams` | `{ opacity: 0 }` | State entering nodes animate *from* (newly inserted, or `display:none`/`visibility:hidden` → visible). May embed its own `duration`/`delay`/`ease`. |
| `leaveTo` | `LayoutStateParams` | `{ opacity: 0 }` | State leaving nodes animate *to* (removed-from-flow via `display:none`/`visibility:hidden`, or kept visible while pending removal). May embed timings. |
| `swapAt` | `LayoutStateParams` | `{ opacity: 0, ease: 'inOut(1.75)' }` | Intermediate state for non-target ("swapping") children of resizing targets: animated `[old → swapAt → new]`, second half uses the inverse ease. Supplying `swapAt` **replaces** `{opacity: 0}` (no deep merge); the `'inOut(1.75)'` ease is only a fallback. |
| `id` | `Number \| String` | auto-increment | Forwarded as the timeline id. |
| `playbackEase`, `loop`, `alternate`, `reversed`, `autoplay`, `persist`, `loopDelay`, `playbackRate`, `frameRate`, `modifier`, `onBegin/onUpdate/onLoop/onComplete/onPause/onRender/...` | (Timer/Tickable params) | engine defaults | Any key present in the global `defaults` object (except `ease/duration/delay`) is forwarded to the internal Timeline. `composition` is **forced to `false`**. |

Property keys used inside `enterFrom`/`leaveTo`/`swapAt` are automatically added to the tracked `properties` set.

`LayoutStateParams` = `Record<string, number|string|FunctionValue>` of CSS properties **plus** optional `duration`/`delay`/`ease` for that phase. All property values accept function values `($el, index, targets) => value`.

### Methods

| Method | Returns | Description |
|---|---|---|
| `record()` | `this` | Snapshot the *current* layout as `oldState`. Cancels any running layout timeline + WAAPI transform animation and restores previously captured inline styles. **Call BEFORE mutating the DOM** (interruption-safe: calling mid-animation re-records from the in-flight positions). |
| `animate(params?)` | `Timeline` | Snapshot the *new* state, diff vs `oldState`, build and start the animation. `params` (`LayoutAnimationParams`) can override `duration/delay/ease/playbackEase`, `enterFrom/leaveTo/swapAt`, callbacks and timer params (e.g. `autoplay: onScroll(...)`). Per-call params win over constructor params (`mergeObjects` keeps first-object priority). If **no change is detected**, returns an already-completed timeline. The timeline autoplays by default. |
| `update(cb, params?)` | `Timeline` | Sugar for `record(); cb(this); return animate(params)`. The main API you'll use. Thenable: `layout.update(...).then(...)`. |
| `revert()` | `this` | Completes timeline + transform animation, clears node snapshots, removes all `data-layout-id` attributes, restores muted CSS transitions next frame. Auto-registered in `createScope()` if one is active. |

### Useful instance properties

| Property | Type | Description |
|---|---|---|
| `root` | `DOMTarget` | Resolved root element. Gets class `is-animated` while a layout animation runs (style hook). |
| `timeline` | `Timeline` | The current/last layout timeline. |
| `oldState` / `newState` | `LayoutSnapshot` | Snapshots; `state.getComputedValue($el, prop)` reads recorded values. |
| `animating` / `entering` / `leaving` / `swapping` | `Array<DOMTarget>` | Per-phase target lists (these are the `targets` arrays passed to function values / `stagger`). |

## How it works (from source)

1. `record()` measures every node with `getBoundingClientRect()` while temporarily forcing `transform: none` and `transition: none !important` (transitions restored a frame after the animation ends). Window scroll position is captured.
2. Identity is the auto-assigned `data-layout-id` attribute (`node-N`). **Two different elements sharing the same `data-layout-id` are treated as the same node** → shared-element transitions (e.g. card → cloned card inside a `<dialog>`).
3. `animate()` re-measures, then for each changed target: sets `position: absolute` (or `fixed` if root is absolutely/fixed positioned), zeroes `left/top/margin`, sets `translate: Xpx Ypx` + `width/height` to old values, and overrides `min-*`/`max-*` (`minWidth/minHeight: auto`, `maxWidth/maxHeight: none`).
4. Position animates via the standalone `translate` CSS property and size/properties via Timeline tweens `[old, new]` (`composition: 'none'`). Nodes that have a real `transform` in either state are animated via one shared `waapi.animate()` (translate + transform together, hardware accelerated) `.sync()`'d into the timeline at 0.
5. Non-target descendants ("swapping") jump from old → new styles at `delay + duration/2` via `timeline.call()`; those whose size changed with a resizing target parent are animated through the `swapAt` intermediate state.
6. On completion: inline styles restored, final transforms committed, `is-animated` removed, `onComplete` fired, transitions restored next frame. Leaving elements stay rendered during the animation (their `display`/`visibility` is forced back), removal stays "pending" until completion.

## Examples

### 1. List reorder / move between containers

```js
import { createLayout, spring } from 'animejs';

const layout = createLayout('#todo-app', {
  properties: ['backgroundColor', 'color'],
  ease: spring({ bounce: .3, duration: 450 }), // spring settlingDuration overrides duration
  leaveTo: { opacity: 0, transform: 'translateY(.5rem) scale(.9)' },
});

// Mutate inside update(): record -> mutate -> animate
checkbox.addEventListener('change', () => {
  layout.update(() => doneList.prepend(item), { ease: 'inOutExpo' });
});
```

### 2. Enter / leave with per-phase timings

```js
import { createLayout, stagger, utils } from 'animejs';

const layout = createLayout('.grid', {
  duration: 1000,
  ease: 'inOutExpo',
  enterFrom: { opacity: 0, duration: 1250, delay: 300 },
  leaveTo: {
    opacity: 0,
    transform: () => `translate(${utils.random(-50, 50)}px, ${utils.random(-200, 200)}px)`,
    duration: 750,
    delay: stagger([0, 200], { from: 'random' }),
    ease: 'out(3)',
  },
});

// Toggling a class that sets display:none triggers leaveTo; removing it triggers enterFrom
layout.update(() => card.classList.toggle('is-hidden'));
```

### 3. Animated element removal (two-step)

```js
removeBtn.onclick = () => {
  layout.update(() => item.classList.add('is-removed'), { // .is-removed { display: none }
    ease: 'out(3.5)',
    onComplete: () => layout.update(() => item.remove()), // animate the list collapsing
  });
};
```

### 4. Shared-element modal via `data-layout-id`

```js
const modalLayout = createLayout(overlay, {
  children: ['.card', '.card-image', '.card-title', '.close-overlay'], // queried document-wide
  properties: ['--overlay-alpha'],
  duration: 500,
});

card.onclick = () => {
  const clone = card.cloneNode(true);
  clone.dataset.layoutId = card.dataset.layoutId; // same id = same node = FLIP between them
  overlay.replaceChildren(clone);
  modalLayout.update(() => {
    overlay.showModal();
    card.classList.add('is-open'); // hides original
  }).then(() => clone.querySelector('button').focus());
};
```

### 5. Scroll-driven layout transition

```js
import { createLayout, onScroll } from 'animejs';

const layout = createLayout('.container', { duration: 1000, ease: 'inOutExpo' });
layout.record();
layout.root.classList.toggle('expanded'); // mutate manually instead of update()
layout.animate({ autoplay: onScroll({ sync: true, enter: 'top top' }) });
```

## Gotchas

- **Always mutate between `record()` and `animate()`** — `update(cb)` does this for you. The constructor pre-records once, so the very first `update()` works.
- **Default duration is 350ms** here, not the engine-wide 1000ms; default ease is `'inOut(3.5)'`, not `'out(2)'`.
- **Supplying `swapAt`/`enterFrom`/`leaveTo` replaces the `{opacity: 0}` default entirely** (no merge of property keys; only missing `ease/delay/duration` fall back).
- **During the animation children are pulled out of flow** (`position: absolute`, zeroed left/top/margins) and `min/max-width/height` are overridden — layouts depending on normal flow inside the root will look frozen until completion. `display: grid` nodes are forced to `display: block !important` for the transition; a `position: static` root becomes `relative`.
- **SVG elements are skipped** (`isSvg` check in `registerElement`) — SVG children are never animated.
- **Elements with adjacent text nodes (`isInlined`) never get position animated** (no absolute positioning / translate) to avoid text reflow — only size and CSS properties animate. Wrap inline text in its own element if you need it to move.
- **Position uses the standalone CSS `translate` property**, not `transform`. Don't fight it with your own `translate`; existing `transform`s are preserved and animated through a separate WAAPI animation so they stay in sync.
- **CSS transitions are muted** (`transition: none !important`) on all tracked elements during measure/animate and restored one rAF after completion — your own CSS transitions on those elements won't fire during a layout animation.
- **Size changes under 1px are ignored** (tolerance to avoid jitter on sub-pixel layouts), source `vendor/anime/src/layout/layout.js` (`sizeTolerance = 1`).
- **`children` selectors are queried from the scope root (document)**, not the layout root — intentional for cross-tree shared elements, but a broad selector can register unexpected out-of-root elements if their `data-layout-id` matches.
- The internal timeline is created with `composition: false` and tweens use `composition: 'none'` — layout animations don't compose with other anime.js animations on the same targets; other running animations on those properties will be visually overridden by inline styles.
- **Leaving nodes are NOT removed from the DOM by the module** — hide via class/`display:none` first, then call `.remove()` in `onComplete` (wrap in another `layout.update()` to animate the resulting collapse).
- If the layout change alters page scroll, the previous scroll position is restored on the next frame (`window.scrollTo(oldX, oldY)`) — don't scroll programmatically in the same frame as `animate()`.
- With a scroll-linked `autoplay` (`onScroll({ sync: true })`) the completion cleanup (style restore) is intentionally skipped so the scrubbed styles persist; `onPause` also fires `onComplete`.
- `revert()` (or a `createScope().revert()`) removes all `data-layout-id` attributes — needed for clean React/Next unmounts since the module writes attributes and inline styles onto your DOM.
- The old `examples/auto-layout/accordion` uses stale param names `added`/`removed`; the current API names are `enterFrom`/`leaveTo` (verified in `src/layout/layout.js`).
