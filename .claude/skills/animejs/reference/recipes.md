# anime.js v4 Recipes — Effects Playbook from the Official Examples

Patterns extracted from `vendor/anime/examples/` (v4.4.1). Each recipe names the technique and the minimal code that powers it. All snippets use the public package import.

## Import

```js
import {
  animate, createTimeline, createTimer, createAnimatable, createDraggable,
  createScope, createLayout, onScroll, stagger, svg, utils,
  eases, easings, createSpring, spring, splitText, scrambleText, engine,
} from 'animejs';
```

`eases` = ease-function object (`eases.outElastic(1.1, .9)`); `easings` = namespace incl. `easings.irregular(steps, randomness)`, `easings.steps(n)`. `spring({ bounce, duration })` and `createSpring({ mass, stiffness, damping, velocity })` are both exported.

---

## 1. Organic cursor-follow swarm — `composition: 'blend'` + throttled re-targeting (additive-creature)

Fire a NEW `animate()` toward the cursor every N ms from a low-`frameRate` timer; `composition: 'blend'` makes overlapping animations merge additively instead of cancelling. Grid staggers on `delay`/`duration` make the swarm trail like a creature.

```js
const grid = [13, 13], from = 'center';
createTimer({
  frameRate: 15, // re-target every ~66ms — cheap, and blend smooths it
  onUpdate: () => animate(particles, {
    x: cursor.x, y: cursor.y,
    delay: stagger(40, { grid, from }),
    duration: stagger(120, { start: 750, ease: 'inQuad', grid, from }),
    ease: 'inOut',
    composition: 'blend', // KEY: overlapping animations blend instead of cut
  }),
});
```

Autonomous motion when idle: a looping timeline animates `cursor` (a plain object) and a `modifier` adds a sine drift ON TOP of the tweened value:

```js
createTimeline().add(cursor, {
  x: [-w * .45, w * .45],
  modifier: x => x + Math.sin(mainLoop.currentTime * .0007) * w * .5, // drift layer
  duration: 3000, ease: 'inOutExpo', alternate: true, loop: true,
}, 0);
// pointer takes over: autoMove.pause(); idleTimer (createTimer({duration:1500, onComplete:()=>autoMove.play()})).restart()
```

## 2. Fireflies — per-particle timers + random polar targets (additive-fireflies)

Each particle has its own `frameRate: 4` timer that keeps launching blend animations toward a random angle around a shared pointer. Per-PROPERTY durations via function values create non-circular wobble.

```js
createTimer({
  frameRate: 4,
  onUpdate: () => {
    const angle = Math.random() * Math.PI * 2;
    animate($el, {
      x: { to: Math.cos(angle) * radius + pointer.x, duration: () => utils.random(1000, 2000) },
      y: { to: Math.sin(angle) * radius + pointer.y, duration: () => utils.random(1000, 2000) },
      scale: .5 + utils.random(.1, 1, 2),
      ease: `inOut(${utils.random(1, 5)})`,
      composition: 'blend',
    });
  }
});
```

## 3. Ripple grid — stagger from a moving index + self-restarting timeline (advanced-grid-staggering)

`stagger(v, { grid, from: index, axis: 'x'|'y' })` computes signed per-axis distances from ANY grid cell. Recurse via `onComplete` for an endless, re-randomized loop.

```js
const grid = [rows, rows];
function animateGrid() {
  nextIndex = utils.random(0, numberOfElements);
  createTimeline({ defaults: { ease: 'inOutQuad' }, onComplete: animateGrid })
    .add('.dot', {
      keyframes: [
        { x: stagger('-.175rem', { grid, from: index, axis: 'x' }),
          y: stagger('-.175rem', { grid, from: index, axis: 'y' }), duration: 200 }, // recoil
        { x: stagger('.125rem', { grid, from: index, axis: 'x' }),
          y: stagger('.125rem', { grid, from: index, axis: 'y' }), scale: 2, duration: 500 }, // push
        { x: 0, y: 0, scale: 1, duration: 600 },
      ],
      delay: stagger(50, { grid, from: index }), // wave propagation
    }, 0)
    .add('.cursor', { // animate stagger-to-stagger: from/to both stagger functions
      x: { from: stagger('-1rem', { grid, from: index, axis: 'x' }), to: stagger('-1rem', { grid, from: nextIndex, axis: 'x' }) },
    }, '-=1500');
  index = nextIndex;
}
```

## 4. 60fps cursor-follow without animations — `createAnimatable` (animatable-follow-cursor)

`createAnimatable` registers props once, then you CALL them as setter functions every pointermove — no animation objects created per event. Per-element stagger easing on `duration` gives the elastic trailing.

```js
const duration = stagger(50, { ease: 'in(1)', from: 'center', grid: [rows, rows] });
const particles = createAnimatable('.particles div', {
  x: { duration },                       // animated towards new value over staggered duration
  y: { duration },
  rotate: { unit: 'rad', duration: 0 },  // duration 0 = instant setter, radian unit
  ease: 'outElastic(.3, 1.4)',
});
window.onpointermove = e => {
  particles.x(utils.mapRange(e.clientX, 0, w, -w/2, w/2));
  particles.y(utils.mapRange(e.clientY, 0, h, -h/2, h/2));
  particles.rotate(-Math.atan2(w/2 - e.clientX, h/2 - e.clientY)); // getter when called with no arg
};
```

## 5. Cinematic logo sequence — labels, `<<`, morphs, scramble (animejs-v4-logo-animation)

The full v4 timeline-position grammar in production use:

```js
tl.label('POP')                       // named position
  .set('#line', { opacity: 0 }, 'POP')
  .add(els, { /* ... */ }, stagger(80, { from: 'center' })) // stagger AS position = staggered insert
  .add('#dot-1', { /* ... */ }, 'POP')          // at label
  .add('#i-1', { /* ... */ }, '<<+=380')        // previous animation START + 380ms
  .label('SWEECH', '-=290')                      // label relative to last end
  .add('#a-1', { d: svg.morphTo('#a-2', 0), ease, duration: 900 }, 'SWEECH+=00');
```

Multi-step SVG morph as keyframes on `d` (also works on `points`):

```js
d: [
  { to: svg.morphTo('#line-0-1', 0), delay: 320, duration: 60, ease: 'inQuad' },
  { to: svg.morphTo('#line-0-2', 0), duration: 80 },
],
```

Per-character text scramble WITHOUT splitText — animate `textContent` through a charset index with a `modifier`:

```js
const chars = ' !#%&"()*+×,.:;…0123456789ABC…Z';
animate('#sub-text span', {
  textContent: {
    to: $el => [0, chars.indexOf($el.textContent)],          // function from/to per element
    modifier: v => chars[utils.round(v, 0)] ?? ' ',
  },
  delay: stagger(30, { from: 'center', ease: 'inOut(2)' }),
});
```

Onion-skin motion trails: clone the element N times, animate clones with `opacity: stagger([1, .4])` and `delay: stagger(18)` toward the same morph. Animate SVG filter attributes directly: `.add('#blur feGaussianBlur', { stdDeviation: ['15,15', '0,0'] })`. Build the whole timeline, then `.init()`.

## 6. FLIP layout animation — `createLayout` (auto-layout/*)

Mutate the DOM inside `layout.update(fn)`; anime.js FLIP-animates positions/sizes plus any registered CSS `properties`. `spring({ bounce, duration })` is the natural ease here.

```js
const layout = createLayout('.accordion', {
  properties: ['background-color'],       // extra CSS props to transition
  ease: spring({ bounce: .2, duration: 450 }),
  added:   { opacity: 0, filter: 'blur(5px)' }, // state for newly added nodes
  removed: { opacity: 0, filter: 'blur(5px)' },
});
layout.update(() => $item.classList.toggle('is-open'));            // that's it
layout.update(() => { /* mutate */ }, { ease: 'inOutExpo', delay: stagger([0, 750], { from: 'random' }) }); // per-call overrides
```

Enter/leave states (`enterFrom`/`leaveTo` accept function values), shared-element transitions via `data-layout-id`, and coordinating TWO layouts (nav + content) with manual `record()`/`animate()`:

```js
const content = createLayout('.content', {
  enterFrom: { opacity: 0, duration: 500, delay: 200 },
  leaveTo:   { opacity: 0, transform: () => `translate(${random(-50,50)}px, ${random(-200,200)}px)`,
               delay: stagger([0, 200], { from: 'random' }) },
});
nav.update(() => {
  content.record();              // snapshot before mutation
  /* ...move .button-bg, toggle sections... */
  content.animate();             // FLIP from snapshot
});
// Scroll-scrubbed FLIP: layout.record(); mutate; layout.animate({ autoplay: onScroll({ sync: true, enter: 'top top' }) })
```

Modal hero transition (planets): clone the card into a `<dialog>`, copy its `dataset.layoutId`, then `modalLayout.update(() => $overlay.showModal())` — matching layout-ids tween between containers. 3D layouts (periodic-table): set arbitrary `translate3d/rotate` transforms inside `update()`; FLIP interpolates between full transform matrices.

## 7. Canvas 2D — animate plain objects, render in one timer (canvas-2d)

4000 particles: anime.js tweens `{x, y, radius}` JS objects (no DOM), ONE `createTimer` repaints. Trail = translucent black fill + `screen` compositing. Speed-proportional duration.

```js
function animateParticule(p) {
  const newX = utils.random(0, vw), newY = utils.random(0, vh);
  animate(p, {
    x: { to: newX, duration: Math.abs((newX - p.x) * 20) },  // constant speed
    y: { to: newY, duration: Math.abs((newY - p.y) * 20) },
    radius: utils.random(2, 6), ease: 'out(1)',
    onComplete: () => animateParticule(p),                   // perpetual
  });
}
createTimer({ onUpdate: () => {                              // single render loop
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh);        // fading trails
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen';
  for (const p of particules) drawParticule(p);
}});
```

## 8. Timeline as a media/clock object (clock-playback-controls)

A timeline can be a 24h clock: pin `duration`, set `currentTime` from wall time, and — the killer trick — **animate the timeline itself**:

```js
const masterTL = createTimeline({ defaults: { ease: 'linear' }, autoplay: false });
masterTL.sync(numTL, 0);          // nest independently-looping child timelines
masterTL.duration = oneday; masterTL.iterationDuration = oneday;
masterTL.currentTime = new Date().getTime() % oneday;

animate(masterTL, { currentTime: getNow(), ease: 'inOut(3)', duration: 1500 }); // eased seek
animate(masterTL, { speed: .1, ease: 'out(3)', duration: 1500 });               // eased slow-mo
$range.oninput = () => utils.sync(() => masterTL.currentTime = +$range.value);  // scrub safely inside a frame tick
```

## 9. Infinite auto-scrolling draggable carousel (draggable-infinite-auto-carousel)

The non-obvious architecture: draggable targets a PLAIN OBJECT (so it produces deltas, not transforms), an `createAnimatable` with a `utils.wrap` modifier owns the actual x, and one timer composes auto-speed + drag delta + wheel.

```js
$carousel.innerHTML += $carousel.innerHTML; // duplicate children = infinity illusion
const carousel = { width: totalWidth, speedX: 2, wheelX: 0, wheelY: 0 };

const { x } = createAnimatable($carousel, {
  x: 0, modifier: v => utils.wrap(v, -carousel.width / 2, 0), // seamless wrap
});
const draggable = createDraggable(carousel, {   // <- plain object target!
  trigger: '#infinite-carousel', y: false,
  onGrab:    () => animate(carousel, { speedX: 0, duration: 500 }), // ease auto-scroll out
  onRelease: () => animate(carousel, { speedX: 2, duration: 500 }), // ease it back in
  releaseStiffness: 20, velocityMultiplier: 1.5,
});
createTimer({ onUpdate: () => x(x() - carousel.speedX + draggable.deltaX - carousel.wheelX - carousel.wheelY) });

// Mousewheel: lerp delta in, decay back to 0 with a reusable autoplay:false animation
const wheelDecay = animate(carousel, { wheelY: 0, wheelX: 0, duration: 500, autoplay: false, ease: 'out(4)' });
$carousel.addEventListener('wheel', e => {
  e.preventDefault();
  carousel.wheelY = utils.lerp(carousel.wheelY, e.deltaY, .2);
  wheelDecay.refresh().restart();   // refresh() re-reads the new start values
}, { passive: false });
```

## 10. Scroll-snap carousel with wheel-physics (draggable-mouse-scroll-snap-carousel)

Bounded snap carousel: function-valued `container` bounds and `snap`, re-snap after resize. Wheel events are injected into the draggable's velocity pipeline so release momentum + snapping work from trackpads too (uses internals: `pointer`, `computeVelocity`, `handleUp` — see vendor/anime/examples/draggable-mouse-scroll-snap-carousel/index.js:63).

```js
const draggable = createDraggable($carousel, {
  trigger: document.body,
  container: () => [0, 0, 0, -carousel.totalWidth + $carousel.offsetWidth - carousel.spacing],
  x: { snap: () => carousel.itemWidth },   // dynamic snap cell
  y: false,
  onResize: updateDimensions,
  onAfterResize: self => self.setX(utils.snap(self.x, self.snapX)),
  releaseStiffness: 100, velocityMultiplier: 1.5, containerFriction: .5,
});
```

## 11. Draggable playground micro-recipes (draggable-playground)

```js
// Bottom drawer: draggable progress scrubs a paused timeline
const drawer = createDraggable($drawer, {
  container: () => [0, $drawer.offsetWidth, $drawer.offsetHeight, 0],
  y: { snap: ({ $target }) => $target.offsetHeight }, x: false,
  onUpdate: self => { drawerOpenAnim.progress = self.progressY; },
});
animate(drawer, { progressY: drawer.y < 100 ? 1 : 0, duration: 375, ease: 'out(4)' }); // programmatic open/close

// 3D cover-flow: map drag x to rotateY
utils.set('.carousel-item', { rotateY: stagger(itemAngle), z: 'min(40vw, 200px)' });
createDraggable('.carousel', { x: { mapTo: 'rotateY' }, y: false, snap: itemAngle, dragSpeed: .4, releaseStiffness: 10 });
animate(carousel, { x: utils.snap(carousel.x - 40, itemAngle), duration: 500 }); // prev/next buttons

// Sortable list via onSnap
createDraggable($item, { x: false, snap: 60, onSnap: self => {
  const toIndex = utils.round(0).clamp(0, list.length - 1)(self.destY / snap); // chained utils!
  /* splice list, animate others to i * snap with eases.outElastic(.8, 1) */
}});

// Spring release physics
createDraggable(el, { releaseEase: createSpring({ mass: 1, stiffness: 400, damping: 30 }) });
// Snap-to-position list: snap: itemEls.map($el => -$el.offsetLeft)
// utils.set returns a revertable: const styles = utils.set(el, {...}); styles.revert();
```

## 12. Bake an easing into geometry (easings-visualizer)

`stagger([from, to], { ease })` distributes values along ANY ease — use it to plot curves, distribute opacity, anything indexed:

```js
utils.set(points, { y: stagger([100, 0], { ease: parsedEasing }) }); // points = array of {x,y} objects
animate($polyline, { points: coordsToPoints(points), composition: 'add' }); // 'add' = additive curve morph
```

## 13. Typewriter — distort time itself with `playbackEase` (irregular-playback-typewriter)

`playbackEase` warps a whole timeline's progress. `easings.irregular(steps, randomness)` = human typing rhythm; `easings.steps(n)` = discrete cursor.

```js
createTimeline({ playbackEase: easings.irregular(keystrokes, 2) })
  .set($spans, { opacity: [0, 1] }, stagger(125))                 // .set() staggered = letters appear
  .add($cursor, { left: '100%', duration: keystrokes * 125, ease: easings.steps(keystrokes) }, 0)
  .init();
animate($cursor, { opacity: 0, duration: 750, loop: true, alternate: true }); // blink
```

## 14. Endless random keyframe streams (layered-css-transforms)

Generate 100 keyframes with random ease/duration per step (mix string eases and `createSpring()` instances), restart with new randomness on complete. Animates SVG geometry attributes (`r`, `width`, `points`) alongside transforms.

```js
const eases = ['inOutQuad', 'inOutCirc', 'inOutSine', createSpring()];
const keyframes = n => Array.from({ length: 100 }, () => ({
  to: () => utils.random(-4, 4) + 'rem',   // function value, re-evaluated per target
  ease: utils.randomPick(eases),
  duration: utils.random(300, 1600),
}));
createTimeline({ onComplete: () => animateShape(el) })
  .add(el, { translateX: keyframes(), translateY: keyframes(), rotate: keyframes() }, 0)
  .add(circleEl, { r: keyframes() }, 0)
  .init();
```

## 15. Responsive scroll animations — `createScope` mediaQueries (onscroll-responsive-scope)

Scope re-runs its constructors on media-query change and auto-reverts everything created inside. Pick a different animation per breakpoint, then `link()` it to scroll.

```js
createScope({
  mediaQueries: { landscape: '(orientation: landscape)' },
  defaults: { ease: 'out(3)', duration: 500 },
}).add(scope => {
  const anim = scope.matches.landscape
    ? animate('.card', { x: ['-60vw', stagger(['-20%', '20%'])], rotate: { to: stagger([-30, 30]), delay: stagger([0, 950], { from: 'last' }) } })
    : animate('.card', { y: ['150vh', stagger(['20%', '-20%'])], rotate: { from: (_, i) => i % 2 ? '-20deg' : '20deg' } });
  onScroll({ target: '.sticky-container', enter: 'top', leave: 'bottom', sync: .1 }).link(anim);
});
```

## 16. Sticky scroll-scrubbed deck (onscroll-sticky)

CSS does the pinning (`.sticky-container { height: 400lvh }` + `.sticky-content { position: sticky; top: 0; height: 100lvh }`); `onScroll` as `autoplay` scrubs the timeline. `composition: 'blend'` defaults let hover animations coexist with the scroll-driven ones on the SAME properties.

```js
createTimeline({
  defaults: { ease: 'linear', duration: 500, composition: 'blend' },
  autoplay: onScroll({ target: '.sticky-container', enter: 'top top', leave: 'bottom bottom', sync: .5 }), // sync:.5 = smoothed scrub
})
.add('.stack', { rotateY: [-180, 0], ease: 'in(2)' }, 0)
.add('.card', { rotateZ: { to: stagger([0, -360], { from: 'last' }) }, y: { to: '-60%' },
  transformOrigin: ['50% 100%', '50% 50%'], delay: stagger(1) }, 0)
.init();
$card.onmouseenter = () => animate($card, { y: '-70%', composition: 'blend' }); // doesn't fight the scroll tween
```

## 17. 1000-element wave — `composition: false` for perf (stagger)

Disabling composition skips conflict bookkeeping = much faster for huge counts. Relative `'-='`/`'+='` from/to keyframes ripple from each element's own random start state. `grid: true` auto-computes the grid from DOM positions.

```js
utils.set(dots, { x: () => utils.random(0, w), rotate: () => utils.random(-180, 180), scale: () => utils.random(.2, 2, 3) });
createTimeline({ composition: false })
  .add(dots, {
    scale: [{ from: '-=1', to: '+=2' }],
    rotate: [{ from: '-=180', to: '+=180' }],
    background: [{ from: '#FFF' }],
    duration: 1000, ease: 'inOut(3)', loop: true,
  }, stagger([0, 2000], { grid: true, from: 'center', axis: 'x' }))
  .init();
```

## 18. Animated counter + bar graph (svg-graph)

```js
.add('#count', {
  innerHTML: { from: 0 },                                  // tween TO current text content
  modifier: v => utils.round(v, 0).toLocaleString(),       // format mid-flight
}, '<<')
.add('#b', { x: [0, 0], width: [0, 900] }, 0)              // SVG attributes animate directly
```

## 19. Generative line drawing — `draw` beyond [0,1] (svg-line-drawing)

`svg.createDrawable()` exposes a `draw` prop taking `'start end'` pairs; values may be negative or >1 to slide dashes through/past the path. Function keyframe values randomize per target.

```js
createTimeline({ defaults: { ease: 'inOut(4)', duration: 10000, loop: true } })
.add(svg.createDrawable('.line-v'), {
  draw: ['.5 .5',
    () => { const l = utils.random(.05, .45, 2); return `${.5 - l} ${.5 + l}` }, // grow from middle
    '0.5 0.5'],
  stroke: '#FF4B4B',
}, stagger([0, 8000]))
.add(svg.createDrawable('.circle'), {
  draw: [() => { const v = utils.random(-1, -.5, 2); return `${v} ${v}` },       // off-path start
         () => `${utils.random(0, .25, 2)} ${utils.random(.5, .75, 2)}`,
         () => { const v = utils.random(1, 1.5, 2); return `${v} ${v}` }],       // off-path end
}, stagger([0, 8000]));
```

## 20. Text: splitText effects (text/split-effects, text/hover-effects)

`splitText` with `clone` + `wrap: 'clip'` builds slide-reveal structure for free; `addEffect(cb)` re-runs the effect when lines re-split on resize — return a timeline to keep it synced, or return a function as a pre-resplit cleanup hook:

```js
const split = splitText('h2', { chars: { class: 'char', clone: 'left', wrap: 'clip' } });
// each char becomes <span class=char><span>orig</span><span>clone</span></span> inside a clip wrapper
createTimeline({ autoplay: false }).add('.char > span', { x: '100%' }, stagger(5, { use: 'data-char' }));
// stagger {use:'data-char'} indexes by attribute -> stable across line re-splits

split.addEffect(self => createTimeline()                 // returned timeline auto-reverts+rebuilds on resplit
  .add(self.lines, { color: { from: '#61C3FF' }, y: -10 }, stagger(100))
  .add(self.words, { scale: [.98, 1.04] }, stagger(100, { use: 'data-line' })).init());
split.addEffect(self => () => { /* runs BEFORE next resplit: store coords etc. */ });
split.revert(); // full cleanup
```

Hover-scrub trick — drive a prebuilt paused timeline by animating its `progress` (reversible mid-flight, no rebuilds):

```js
root.addEventListener('pointerenter', () => animate(rotateAnim, { progress: 1 }));
root.addEventListener('pointerleave', () => animate(rotateAnim, { progress: 0 }));
```

Amplitude-controlled infinite wave — `modifier` scales a looping tween by a tweened strength var:

```js
const wave = createTimeline().add(chars, {
  y: ['-50%', '50%'], loop: true, alternate: true,
  modifier: v => v * params.strength,            // strength tweened 0..1 on hover
}, stagger(50)).seek(1000);
```

Custom word markup template (3D flip cube per word): `splitText('h2', { words: '<span class="word-3d word-{i}"><em>{value}</em>…</span>' })`.

## 21. Text: scrambleText (text/scramble, text/scramble-tl)

`scrambleText(params)` returns a FunctionValue you assign to `innerHTML`; combine with normal props in the same animation/timeline step:

```js
tl.add('p.center', {
  scale: { from: 3 }, color: { from: 'var(--yellow-1)' },
  innerHTML: scrambleText({
    text: 'Anime.js Scramble Text',  // omit to scramble-in existing text; '' scrambles out
    override: false,                  // false = scramble real chars; ' ' = type-on from blank; '#!%' = custom charset
    from: 'center',                   // 'left' | 'right' | 'center' | 'random'
    reversed: true,                   // un-type
    duration: 1000, perturbation: .25, cursor: '░▒▓█',
    revealDelay: 250, revealRate: 50, settleDuration: 250, settleRate: 30,
    onChange: tickSound,              // per-character-change hook (audio ticks)
  }),
}, '<<');
```

## 22. 50K-stars — timeline-of-timelines acceleration (timeline-50K-stars)

A child timeline with `loop: 500` + `onLoop: refresh()` is one "click"; the parent ACCELERATES it by tweening its `progress` with an explosive bezier. Count-up uses `innerHTML` + `modifier: utils.round(0)` with `cubicBezier(1,0,1,1)` (slow→vertical).

```js
const clickAnim = createTimeline({ loop: 500, autoplay: false, onLoop: self => self.refresh() })
  .add('.star-button', { scale: [1, .97, 1], rotate: () => utils.random(-d.mult, d.mult) }, 0)
  .call(() => spawnStarParticle(), 0);

masterTL
  .add(clickAnim, { progress: 1, duration: 10000, ease: cubicBezier(.65, 0, 0, 1) }, 'CLICK START') // 500 clicks, eased
  .add($count, { innerHTML: ['5', '40000'], modifier: utils.round(0), ease: cubicBezier(1, 0, 1, 1), duration: 5000 });
```

## 23. Murmuration — `onLoop: refresh()` + Symbol state (timeline-refresh-starlings)

2500 DOM divs flock: store polar coords as `Symbol` props on elements, animate to function values, and re-randomize EVERY loop with `onLoop: self => self.refresh()`. Sine `modifier` drift on the shared target adds the organic sway. `tl.seek(20000)` jumps straight into steady state.

```js
const radius = Symbol(), theta = Symbol();
tl.add('div', {
  x: $el => target.x + $el[radius] * Math.cos($el[theta]),
  y: $el => target.y + $el[radius] * Math.sin($el[theta]),
  duration: () => 3000 + utils.random(-100, 100),
  loop: true,
  onLoop: self => {                       // per-target loop: pick a new spot, re-resolve function values
    const t = self.targets[0];
    t[theta] = Math.random() * Math.PI * 2;
    t[radius] = target.r * Math.sqrt(Math.random());
    self.refresh();
  },
}, stagger((3000 / count) * 1.125))       // continuous desync
.add(target, { x: () => utils.random(-w, w), modifier: x => x + Math.sin(tl.currentTime * .0007) * w * .65, duration: 2800 }, 0);
tl.seek(20000);                           // pre-warm: no visible "start"
```

## 24. Seamless loops — period math + deep seek (timeline-seamless-loop, timeline-stress-test)

A loop is seamless when (animation period) divides (insertion spread), every child loops infinitely (`loop: true` inside a timeline), and you `seek()` past the ramp-up.

```js
// 500 spokes, each loops forever; loopDelay pads each cycle to exactly loopDuration/5
tl.add(el, { rotate: [...], scale: [...], loop: -1 }, delay * i); // delay = loopDuration / numberOfEls
tl.seek(10000); // start mid-loop -> no visible intro

// 2024-dot spiral (stress test): index-driven geometry + full-period stagger
const angle = utils.mapRange(0, count, 0, Math.PI * 100);  // curried: angle(i) -> mapped value
createTimeline().add('div', {
  x: (_, i) => `${Math.sin(angle(i)) * 20}rem`,
  y: (_, i) => `${Math.cos(angle(i)) * 20}rem`,
  scale: [0, .4, .2, .9, 0],
  playbackEase: 'inOutSine', loop: true, duration: 10000,
}, stagger([0, duration]))                                  // spread inserts across one full period
.init().seek(10000);
```

## Gotchas

- **`.init()`**: examples call it on every non-autoplaying/visual-setup timeline after building (`tl....init()`). It forces the first render so elements snap to their `from` states immediately — without it, staggered/late children show unset styles until played over.
- **`composition`** is the superpower: `'blend'` for overlapping/interactive layers (hover over scroll-scrub, swarms), `'add'` for additive value morphs, `false`/`'none'` to skip conflict tracking on 1000+ targets (stagger example).
- **`onLoop: self => self.refresh()`** is THE idiom for "random every cycle" — function values are only re-evaluated on `refresh()`, not automatically per loop. With `refresh()`, function values MUST return plain Numbers/Strings (object returns crash `decomposeRawValue`), and to re-pin a constant-per-cycle value you MUST use tuple syntax `prop: [fn, fn]` — `{ from: fn, to: fn }` object syntax never registers the from-function and silently drifts old→new after refresh (see animate.md `refresh()` row).
- **`refresh().restart()`** is also needed when retargeting an `autoplay: false` animation whose start values changed (wheel decay pattern).
- **`seek(bigNumber)`** to start loops mid-steady-state; works because timelines are fully deterministic.
- **`createDraggable` on a plain object** gives you physics deltas (`deltaX`, velocity, releaseStiffness springs) without it touching any element — compose the result yourself in a `createTimer`.
- **`utils.wrap(min, max)`** as an animatable/draggable `modifier` is how every infinite carousel works (plus duplicating children once).
- **Animate anything with numeric props**: plain objects, draggables (`progressX/Y`, `x`), timelines (`progress`, `currentTime`, `speed`), animatables.
- **`modifier` stacks a layer on top of the tween** (sine drift, amplitude scaling, value formatting) — it does not affect the stored target value mid-tween computation order.
- **`stagger(...)` is itself callable**: `stagger([0,1], {...})($el, i, total)` returns the raw value (used in timeline-seamless-loop for per-element strength).
- **`stagger(v, { use: 'data-char' })`** indexes by attribute, surviving splitText re-splits; `start: '<<'` works inside stagger position objects on timelines.
- **`utils.set()` returns a revertable** object — `const s = utils.set(el, {...}); s.revert()` (used to block/unblock page scroll).
- **`utils.sync(fn)`** when mutating `currentTime`/props from outside the engine tick (range-input scrubbing).
- **Wheel support is manual**: `addEventListener('wheel', fn, { passive: false })` + `e.preventDefault()` + lerped deltas; native draggables ignore wheels.
- **`frameRate`** on `createTimer`/animations throttles updates (15fps re-targeting is plenty when `composition: 'blend'` smooths between).
- `engine.timeUnit = 'ms' | 's'` switches the global time unit (draggable-playground).
