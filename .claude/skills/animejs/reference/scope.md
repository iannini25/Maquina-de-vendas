# Scope — `createScope()`

Scopes group animations under a root element, give them their own parameter defaults, make
selectors resolve *inside* the root, re-run construction code when media queries change, and
revert everything with one call. This is the official integration point for React / Vue /
Angular / any framework with mount–unmount lifecycles.

Source: `vendor/anime/src/scope/scope.js` · Types: `vendor/anime/dist/modules/scope/scope.d.ts` (v4.4.1)

## Import

```js
import { createScope } from 'animejs';
// the class is also exported if you need the type:
import { Scope } from 'animejs';
```

## API

```ts
createScope(params?: ScopeParams): Scope
```

### `ScopeParams`

| Param | Type | Default | Description |
|---|---|---|---|
| `root` | `DOMTargetSelector \| ReactRef \| AngularRef` | `document` | Container of the scope. Resolution order in source: `rootParam.current` (React ref) → `rootParam.nativeElement` (Angular ref) → `parseTargets(rootParam)[0]` (selector/element) → `document`. You can pass a React ref object directly: `createScope({ root: myRef })`. |
| `defaults` | `DefaultsParams` | `globals.defaults` | Per-scope animation defaults (`duration`, `ease`, `delay`, callbacks, …). Merged with global defaults via `mergeObjects(scopeDefaults, globalDefault)` — **scope values win**, globals fill missing keys. Applied to everything created inside scope callbacks. |
| `mediaQueries` | `Record<string, string>` | `undefined` | Map of name → media query string, e.g. `{ isSmall: '(max-width: 640px)', reduceMotion: '(prefers-reduced-motion: reduce)' }`. Each entry is registered with `window.matchMedia()` and the scope listens for `'change'` → auto-`refresh()`. Results readable as booleans on `scope.matches.<name>`. |

### Scope properties

| Property | Type | Description |
|---|---|---|
| `root` | `Document \| DOMTarget` | Resolved root. While scope code executes, string selectors resolve via `root.querySelectorAll()` (`src/core/targets.js getNodeList`). |
| `defaults` | `DefaultsParams` | Merged defaults used by everything constructed inside the scope. |
| `matches` | `Record<string, boolean>` | Current `matchMedia` results, keyed by the names given in `mediaQueries`. Re-snapshotted at the start of every `execute()` (so always fresh inside constructors and methods). |
| `methods` | `Record<string, ScopeMethod>` | Functions registered with `add(name, fn)`. Calling one executes it *inside* the scope context. |
| `data` | `Record<string, any>` | Free-form storage for sharing state between constructors / methods. Wiped by `revert()`. |
| `mediaQueryLists` | `Record<string, MediaQueryList>` | Raw `MediaQueryList` objects. |
| `revertibles` | `Array<Revertible>` | Auto-registered objects (see below) to be reverted on `refresh()` / `revert()`. |

### Methods

| Method | Signature | Returns | Description |
|---|---|---|---|
| `add` (constructor) | `add(cb: (scope) => cleanup \| void)` | `this` (chainable) | Runs `cb` immediately inside the scope context and stores it; it **re-runs on every media-query change** (`refresh()`). If `cb` returns a function, that function is a cleanup called before each re-run and on `revert()`. |
| `add` (method) | `add(name: string, fn: (...args) => void)` | `this` | Registers `scope.methods[name]`. Each call runs `fn` inside the scope context (scoped root/defaults, fresh `matches`). **Not** re-run on media changes. |
| `addOnce` | `addOnce(cb: (scope) => cleanup \| void)` | `this` | Like `add()` but the constructor runs only the first time; it is **skipped on refresh** (tracked positionally by an internal `onceIndex`). Its revertibles/cleanups only run on full `revert()`. |
| `keepTime` | `keepTime(cb: (scope) => Tickable)` | `Tickable` | Re-runs on refresh like `add()`, but transplants playback state — `currentIteration`, `iterationProgress` (flipped correctly for `alternate`/`reversed`), `_startTime` — from the old Tickable to the new one, so the animation continues seamlessly across responsive rebuilds (`src/utils/time.js keepTime`). |
| `refresh` | `refresh(): this` | `this` | Reverts all revertibles + runs all stored cleanups (in reverse order), then re-executes every `add()` constructor. Called automatically when any registered media query fires `'change'`. |
| `revert` | `revert(): void` | — | Full teardown: reverts everything (including `addOnce`/`keepTime` items), removes media-query listeners, clears constructors, `methods`, `matches`, `data`. The scope is **dead** afterwards — create a new one to restart. |
| `execute` | `execute<T>(cb: (scope) => T): T` | `T` | Low-level: runs `cb` with `scope.current`, `scope.root` and `globals.defaults` temporarily swapped to this scope. `add`/`methods` use it internally. |

### What gets auto-registered for cleanup

Anything constructed **synchronously** inside a scope callback registers itself via
`if (scope.current) scope.current.register(this)`:
`Timer` (`createTimer`), `JSAnimation` (`animate`), `Timeline` (`createTimeline`),
`Animatable`, `Draggable`, `ScrollObserver` (`onScroll`), `TextSplitter` (`text.split`),
`Layout`, WAAPI animations (`waapi.animate`) — and nested `Scope`s register with their parent.

## Examples

### React — the canonical pattern (`useEffect` + `revert`)

```jsx
import { useEffect, useRef } from 'react';
import { animate, createScope } from 'animejs';

export function Logo() {
  const root = useRef(null);
  const scope = useRef(null);

  useEffect(() => {
    scope.current = createScope({ root }).add((self) => {
      // '.logo' resolves inside root only
      animate('.logo', { rotate: 360, duration: 2000, loop: true });

      // register a method callable from event handlers
      self.add('pulse', () => {
        animate('.logo', { scale: [1, 1.2, 1], duration: 400 });
      });
    });
    return () => scope.current.revert(); // reverts ALL animations in the scope
  }, []);

  return (
    <div ref={root}>
      <img className="logo" src="/logo.svg" alt="" />
      <button onClick={() => scope.current.methods.pulse()}>Pulse</button>
    </div>
  );
}
```

### Responsive animations with `mediaQueries` (auto-rebuild on change)

```js
import { animate, stagger, createScope } from 'animejs';

createScope({
  mediaQueries: {
    isSmall: '(max-width: 640px)',
    reduceMotion: '(prefers-reduced-motion: reduce)',
  },
  defaults: { ease: 'out(3)', duration: 500 },
}).add((scope) => {
  const { isSmall, reduceMotion } = scope.matches;
  if (reduceMotion) return; // constructor re-runs if the user toggles the setting

  animate('.card', {
    y: isSmall ? ['100vh', 0] : [0, 0],
    x: isSmall ? [0, 0] : ['-100vw', 0],
    delay: stagger(60, { from: 'last' }),
  });
  // everything is reverted + this callback re-runs whenever a query flips
});
```

### Constructor cleanup callback (for non-anime side effects)

```js
createScope({ root: '#app' }).add(() => {
  const onResize = () => { /* ... */ };
  window.addEventListener('resize', onResize);
  animate('.box', { x: 100 }); // auto-reverted, no manual cleanup needed
  // returned fn runs before every refresh() and on revert():
  return () => window.removeEventListener('resize', onResize);
});
```

### `keepTime()` — survive responsive rebuilds without losing progress

```js
const scope = createScope({
  mediaQueries: { portrait: '(orientation: portrait)' },
});

scope.add((self) => {
  // Rebuilt on each orientation change, but resumes at the same iteration/progress:
  self.keepTime(() =>
    animate('.spinner', {
      rotate: 360,
      duration: self.matches.portrait ? 4000 : 2000,
      loop: true,
    })
  );
});
```

### `onScroll` + scope (from `vendor/anime/examples/onscroll-responsive-scope/index.js`)

```js
import { animate, onScroll, stagger, createScope } from 'animejs';

createScope({
  mediaQueries: { landscape: '(orientation: landscape)' },
  defaults: { ease: 'out(3)', duration: 500 },
}).add((scope) => {
  const cards = scope.matches.landscape
    ? animate('.card', { x: ['-60vw', stagger(['-20%', '20%'])], duration: 750 })
    : animate('.card', { y: ['150vh', stagger(['20%', '-20%'])] });

  onScroll({ target: '.sticky-container', enter: 'top', leave: 'bottom', sync: 0.1 })
    .link(cards); // ScrollObserver is also auto-registered & reverted with the scope
});
```

## Gotchas

- **Only synchronous construction is scoped.** `execute()` swaps `scope.current` / `scope.root`
  / `globals.defaults` around the callback and restores them right after. Animations created in
  `setTimeout`, promises, or event listeners declared inside a constructor are **not** registered
  for cleanup and don't get scoped root/defaults. Create them through `scope.add('name', fn)`
  methods instead — methods re-enter the scope context on every call.
- **`add(name, fn)` methods are not constructors** — they never re-run on media-query changes.
  Only `add(callback)` constructors do.
- **`addOnce`/`keepTime` are positional, like React hooks.** They are tracked by an incrementing
  `onceIndex` that resets on each `refresh()`. Call them in the same order/count on every
  constructor run — never inside an `if` whose condition can change between refreshes
  (`src/scope/scope.js` `onceIndex` / `constructorsOnce`).
- **Any media-query change refreshes everything.** `refresh()` reverts and re-runs *all*
  constructors, not just those reading the changed match. By default animations restart from 0 —
  wrap with `scope.keepTime()` to preserve playback position.
- **`revert()` is terminal.** It clears `constructors`, `methods`, `matches`, `data`, and
  removes all `matchMedia` listeners. A reverted scope cannot be refreshed back — build a new
  scope (this is why the React pattern recreates it inside `useEffect`).
- **React refs are read at construction time.** `createScope({ root: ref })` reads
  `ref.current` immediately, so it must run after mount (inside `useEffect`), not during render.
  If the resolved root is falsy, it silently falls back to `document` — your selectors then leak
  out of the component.
- **`mediaQueries` requires a browser.** The constructor calls `window.matchMedia` directly; in
  SSR this throws. Keep `createScope` calls in client-only lifecycle code.
- **Defaults precedence:** scope `defaults` override globals key-by-key
  (`mergeObjects(scopeDefaults, globalDefault)` keeps scope values, fills gaps from globals).
  Inside a timeline, the timeline's own `defaults` still take precedence for its children.
- **Cleanup order is LIFO.** `refresh()`/`revert()` walk `revertibles` and stored cleanups in
  reverse creation order.
- **Selector scoping applies to plain strings only.** `'.card'` becomes
  `root.querySelectorAll('.card')`; element references and NodeLists you pass are used as-is and
  are not checked for containment in `root`.