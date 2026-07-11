# anime.js v4 — Text module (`splitText` / `scrambleText`)

Source: `vendor/anime/src/text/split.js`, `vendor/anime/src/text/scramble.js` (v4.4.1).

## Import

```js
import { splitText, scrambleText, TextSplitter } from 'animejs';
// or namespaced:
import { text } from 'animejs';   // text.splitText(), text.scrambleText()
```

`text.split()` still exists but is **deprecated** (logs a console warning) — use `splitText()`.
`splitText(target, params)` is sugar for `new TextSplitter(target, params)`.

---

## splitText()

```ts
splitText(
  target: Element | NodeList | string | Array<Element>,
  parameters?: TextSplitterParams
): TextSplitter
```

**Only the FIRST matched element is split** (`split.js` takes `target[0]` / first node of the NodeList). To split several elements, loop: `utils.$('.title').forEach($el => splitText($el, {...}))`.

### TextSplitterParams

| Param | Type | Default | Description |
|---|---|---|---|
| `words` | `true \| false \| SplitTemplateParams \| string \| (node) => string` | **`true`** (splits words even when omitted) | Word splitting config |
| `chars` | same union | `false` | Character (grapheme) splitting config |
| `lines` | same union | `false` | Line splitting config (measured by bounding-rect Y deltas) |
| `accessible` | `Boolean` | `true` | Prepends a visually-hidden `<span>` with the original HTML; all split elements get `aria-hidden="true"` |
| `includeSpaces` | `Boolean` | `false` | `true`: trailing space is appended inside the word/last-char span as `\xa0`. `false`: spaces stay as plain text nodes between spans |
| `debug` | `Boolean` | `false` | Dotted outlines: line `#00D672`, word `#FF4B4B`, char `#5A87FF`. Toggle later via `split.debug = true; split.refresh()` |

Each of `lines`/`words`/`chars` accepts:

- `true` → default generated `<span>` wrapper
- `false` → disabled (note `words` must be **explicitly** `false` to disable)
- **object** (`SplitTemplateParams`, below) → generated wrapper with options
- **string template** → custom HTML; must contain `{value}` (warns and skips if missing); `{i}` is replaced with the element index
- **function** `(node) => string` → per-node template

### SplitTemplateParams (object form)

| Param | Type | Default | Description |
|---|---|---|---|
| `class` | `false \| string` | none | `class="..."` on the split `<span>` |
| `wrap` | `Boolean \| 'hidden' \| 'clip' \| 'visible' \| 'scroll' \| 'auto'` | `false` | Adds an outer `<span style="overflow:...">`; `true` → `clip` |
| `clone` | `Boolean \| 'top' \| 'right' \| 'bottom' \| 'left' \| 'center'` | `false` | Duplicates content: `<span>{value}</span>` + an `inert` absolutely-positioned copy offset `-100%/100%` in the given direction (`left` → `left:-100%`, `bottom` → `top:100%`, …) |

Generated markup for `chars: { class: 'char', clone: 'left', wrap: 'clip' }`:

```html
<span style="overflow:clip;">
  <span class="char" style="position:relative;" data-char="0" data-word="0" data-line="0">
    <span>A</span>
    <span inert style="position:absolute;top:0;left:-100%;white-space:nowrap;">A</span>
  </span>
</span>
```

Split elements get `display:inline-block` (`block` for lines) plus data attributes: every element gets `data-line="n"`; words `data-word="i"`; chars `data-char="i"` + their `data-word`. These pair with stagger: `stagger(50, { use: 'data-line' })`.

### TextSplitter instance

| Member | Type | Description |
|---|---|---|
| `lines` / `words` / `chars` | `HTMLElement[]` | Top-level split elements (animatable targets) |
| `$target` | `HTMLElement` | The split root |
| `html` | `string` | Original innerHTML (restored on revert) |
| `ready` | `boolean` | `false` while waiting on `document.fonts.ready` (line splits only) |
| `debug`, `includeSpaces`, `accessible` | — | Mirrors of params |
| `addEffect(fn)` | `(split) => Tickable \| (() => void) \| void` → `this` | Registers a re-runnable effect (see below) |
| `split(clearCache = false)` | → `this` | Re-splits (used internally on resize) |
| `refresh()` | → `void` | `split(true)`: clears cache, re-splits from original HTML, re-runs effects |
| `revert()` | → `this` | Disconnects ResizeObserver, reverts/cleans effects, restores original innerHTML |

### addEffect() semantics

`effect(splitterInstance)` may return:

- a **Tickable** (animation/timeline/timer) → wrapped with `keepTime()` (`src/utils/time.js`): on every re-split the old one is `revert()`ed and the new one is fast-forwarded to the same `currentIteration` / `iterationProgress` / `_startTime`, so looping effects survive line re-flows seamlessly;
- a **cleanup function** → called with the splitter before each re-split and on `revert()`;
- nothing.

Effects run immediately if the split is `ready`, otherwise after the first split. They are re-run **only** when line-splitting is active (resize re-flow) or on `refresh()`.

### Resize / fonts behavior

- A `ResizeObserver` watches the target; re-split is debounced **150 ms** and skipped if `offsetWidth` is unchanged.
- When `lines` is enabled, the initial split waits for `doc.fonts.ready` (line measurement needs final metrics).
- Word/char-only splits are cached (`innerHTML` snapshot) and not recomputed on resize.
- With an active `createScope()`, the splitter is auto-registered, so `scope.revert()` reverts it.
- Lines-only mode (`{ lines: true, words: false }`): words are still split internally for measurement, then unwrapped and `split.words` is emptied. With just `{ lines: true }`, word spans are **kept** (words default to `true`).

---

## scrambleText()

```ts
scrambleText(params?: ScrambleTextParams): FunctionValue
```

Returns a **function-based tween value** — assign it to a string property of an animation, normally `innerHTML` (or `textContent`):

```js
animate('.el', { innerHTML: scrambleText({ duration: 800 }) });
```

Internally it returns `(target, index, targets, prevTween) => ({ from: 0, to: 1, duration, delay, ease: 'linear', modifier })` — the whole effect lives in the `modifier`, which rebuilds the string per frame.

### ScrambleTextParams

| Param | Type | Default | Description |
|---|---|---|---|
| `text` | `string \| (target, i, targets) => string` | original `textContent` | Target text. Omitted → reverts to the element's original text (stored in a module-level `WeakMap` on first use) |
| `chars` | `string \| fn` | `'a-zA-Z0-9!%#_'` | Scramble charset. Named sets: `lowercase`, `uppercase`, `numbers`, `symbols` (`!%#_\|*+=`), `braille`, `blocks`, `shades`. Range syntax `'A-Z'`, `'a-z0-9'`; literal `-` allowed at string start/end |
| `ease` | `EasingParam` | `'linear'` | Applied **inside the modifier** (outer tween stays linear) |
| `from` | `number \| 'left' \| 'center' \| 'right' \| 'random' \| 'auto'` | `'auto'` | Reveal-wave origin. `'auto'` = `'left'` when text grows, `'right'` when it shrinks. A number is a character index |
| `reversed` | `Boolean` | `false` | Reverses reveal order (`'center'` becomes edges-inward) |
| `cursor` | `Boolean \| number \| string` | none | Leading-edge characters. `true` → `'_'`; number → char code; string → trail (last char leads, e.g. `'░▒▓█'`) |
| `perturbation` | `number` | `0` | 0–1: random offsets on each char's start/end times (organic feel) |
| `seed` | `number` | `0` (unseeded) | Reproducible randomness |
| `override` | `Boolean \| string` | `true` | Starting appearance: `true` scramble starting text with `chars`; `false` keep original glyphs until the wave reaches them; `''` start from blank (animates only target length); `' '` fill with `\xa0`; any other string (named set / range OK) = pre-zone scramble set |
| `revealRate` | `number` | `60` | Chars per second entering the active zone (wave speed) |
| `settleDuration` | `number` | `300` (ms) | Time each char scrambles before settling |
| `settleRate` | `number` | `30` | Scramble-glyph refresh rate (Hz) |
| `duration` | `number \| fn` | `0` (auto) | `> 0` overrides auto duration = `(length - 1) * 1000/revealRate + settleDuration` |
| `revealDelay` | `number \| fn` | `0` | Delay (ms) *inside* the tween before the wave starts — scrambling shows during it |
| `delay` | `number \| fn` | `0` | Delay before the tween — starting text remains untouched |
| `onChange` | `(scrambled: string, easedT: number) => void` | noop | Fires on each glyph-refresh step (at `settleRate`), e.g. tick sounds |

---

## Examples

### 1. Stagger chars in (the classic v4 hero title)

```js
import { animate, stagger, splitText } from 'animejs';

const { chars } = splitText('.hero h1', { chars: true });
animate(chars, {
  y: ['1em', 0],
  opacity: [0, 1],
  duration: 600,
  ease: 'out(3)',
  delay: stagger(30),
});
```

### 2. Responsive line reveal that survives re-flow (addEffect)

```js
import { animate, stagger, splitText } from 'animejs';

splitText('p.intro', { lines: { wrap: 'clip' } })
  .addEffect(({ lines }) => animate(lines, {
    y: ['100%', '0%'],
    duration: 800,
    ease: 'outQuart',
    delay: stagger(120),
  })); // returned animation is reverted + time-restored on every resize re-split
```

### 3. Clone slide hover effect (from `examples/text/hover-effects`)

```js
import { animate, stagger, splitText } from 'animejs';

splitText('h2', { chars: { class: 'char', clone: 'left', wrap: 'clip' } });
// each .char holds <span>{value}</span> + an inert clone at left:-100%
animate('.char > span', { x: '100%' }, /* on hover */);
// or staggered by char index:
// createTimeline().add('.char > span', { x: '100%' }, stagger(5, { use: 'data-char' }))
```

### 4. Scramble in, then scramble to new text (timeline chaining)

```js
import { createTimeline, scrambleText } from 'animejs';

createTimeline()
  .add('.status', { innerHTML: scrambleText({ override: '', duration: 750, cursor: '░▒▓█' }) })
  .add('.status', { innerHTML: scrambleText({
    text: 'SYSTEM ONLINE', from: 'center', duration: 600, chars: 'uppercase',
  }) }, '+=400'); // chained tween starts from the previous tween's final text
```

### 5. Per-char scramble on split text (FunctionValue resolves per target)

```js
import { animate, stagger, splitText, scrambleText } from 'animejs';

const { words } = splitText('.terminal', { words: true });
animate(words, {
  innerHTML: scrambleText({ duration: 400, chars: '01' }), // per-word binary scramble
  delay: stagger(80),
});
```

---

## Gotchas

- **`splitText` only splits the first matched element.** Loop over a NodeList yourself for multiple targets.
- **`words` defaults to `true`** even when only `{ chars: true }` or `{ lines: true }` is passed... precisely: `words` undefined → split. Pass `words: false` explicitly for a chars-only or lines-only split.
- **Custom templates need `{value}`** or the node is silently dropped (console warning only). `{i}` is the index of that unit type.
- **Line splitting waits for `document.fonts.ready`** — `split.lines` is empty until then; put animations in `addEffect()` (runs once ready) instead of right after `splitText()`.
- **Resize re-splits lines (debounced 150 ms)** and destroys/re-creates the DOM — references captured outside `addEffect()` go stale. Always read `split.lines/words/chars` inside the effect callback. Return the Tickable so `keepTime` preserves playback position across re-splits.
- **`revert()` restores the original innerHTML** and disconnects the ResizeObserver; inside a `createScope()` the splitter is auto-reverted with the scope.
- `clone` mode wraps each value twice — animate the **inner** spans (`.char > span`), not the `data-char` element itself.
- `includeSpaces: true` appends the trailing space to the word/char as `\xa0` *inside* the span (spaces move with words); default keeps spaces as bare text nodes (gaps don't animate).
- **`scrambleText` is a tween value, not an animation** — use `animate(el, { innerHTML: scrambleText({...}) })`. Put `ease` *inside* the scramble params; the outer tween is forced `ease: 'linear'` and easing the property instead distorts timing.
- **Original text is cached in a module-level WeakMap on first scramble** — later calls without `text` always settle back to that first-seen text, even after you changed `el.textContent` manually.
- `text: ' '` or `text: '&nbsp;'` settles to `'\xa0'`; `override: ' '` fills with `'\xa0'` (real spaces collapse in innerHTML) — `src/text/scramble.js` L107/L115.
- `delay` vs `revealDelay`: during `delay` the element shows the untouched starting text; during `revealDelay` it's already scrambling but no character settles yet.
- The scramble modifier rebuilds the string every frame and caches by progress value (`v === lastValue` short-circuit); glyphs refresh only at `settleRate` Hz, so high `settleRate` + long text = more string churn. Use `seed` for deterministic replays.
- Units: durations are in ms scaled by `globals.timeScale` — they follow `engine.timeUnit` like the rest of v4.