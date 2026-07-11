# Recipes — código copiável de responsividade

Mobile-first. Cada receita tem CSS puro e o equivalente Tailwind. Adapte tokens ao
design system do projeto. Regra: só `transform`/`opacity` animam.

---

## 1. Grid de cards → CARROSSEL scroll-snap no mobile (CSS puro, sem lib)

O anti-"trem de card" nº 1. No desktop é grid; no mobile vira trilho horizontal com "peek"
do próximo card (sinaliza que há mais).

```css
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);   /* desktop */
  gap: 1.25rem;
}
@media (max-width: 640px) {
  .cards {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: 82%;               /* < 100% => aparece um pedaço do próximo */
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 1rem;
    padding-inline: 1rem;                  /* respiro nas pontas */
    margin-inline: -1rem;                  /* sangra até a borda da tela */
    scrollbar-width: none;                 /* Firefox */
  }
  .cards::-webkit-scrollbar { display: none; }
  .cards > * { scroll-snap-align: center; }
}
```
Tailwind (mesmo efeito): `grid grid-cols-3 gap-5 max-sm:grid-flow-col max-sm:auto-cols-[82%]
max-sm:grid-cols-none max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory
max-sm:[scrollbar-width:none] ...` + nos filhos `snap-center`.

---

## 2. Grid de cards → 2 COLUNAS compactas (quando carrossel não cabe na narrativa)

```css
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
@media (max-width: 640px) {
  .cards { grid-template-columns: 1fr 1fr; gap: .6rem; }
  .card { padding: 1rem; }                 /* card encolhe de verdade */
  .card p.desc { display: none; }          /* corta a descrição: fica ícone+título */
}
```
Tailwind: `grid grid-cols-4 gap-4 max-sm:grid-cols-2 max-sm:gap-2.5` + `max-sm:hidden` na descrição.

---

## 3. Grid de cards → LISTA (linha: ícone · título · seta)

Ótimo para "serviços"/menu de opções: densíssimo e escaneável.

```css
@media (max-width: 640px) {
  .cards { display: flex; flex-direction: column; gap: 0; }
  .card {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .8rem;
    padding: .9rem 0; border-bottom: 1px solid var(--hairline); border-radius: 0;
    min-height: 44px;                       /* alvo de toque */
  }
  .card .icon { width: 1.5rem; }
  .card .desc, .card .bg { display: none; }
  .card::after { content: "›"; opacity: .5; } /* afordância de tap */
}
```

---

## 4. Bento assimétrico → reflow com `order` (não achatar tudo)

```css
.bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.b-hero { grid-column: span 2; grid-row: span 2; }
@media (max-width: 640px) {
  .bento { grid-template-columns: 1fr 1fr; }
  .b-hero { grid-column: 1 / -1; order: -1; }  /* herói full no topo, resto 2-col */
  .b-tall { grid-row: auto; }                  /* desfaz spans que não cabem */
}
```

---

## 5. Tabela → CARDS `label: valor` (mobile), ou scroll-x com 1ª coluna fixa

**5a. Vira cards** (cada linha um bloco; usa `data-label` nas células):
```html
<td data-label="Plano">Pro</td>
```
```css
@media (max-width: 640px) {
  table, thead, tbody, tr, td { display: block; }
  thead { position: absolute; left: -9999px; }         /* esconde o cabeçalho */
  tr { border: 1px solid var(--hairline); border-radius: 12px; margin-bottom: .75rem; padding: .5rem .9rem; }
  td { display: flex; justify-content: space-between; gap: 1rem; padding: .4rem 0; border: 0; }
  td::before { content: attr(data-label); font-weight: 600; opacity: .7; }
}
```
**5b. Ou mantém tabela com scroll horizontal e 1ª coluna sticky:**
```css
.table-wrap { overflow-x: auto; }
@media (max-width: 640px) {
  th:first-child, td:first-child { position: sticky; left: 0; background: var(--bg); }
}
```

---

## 6. Nav horizontal → HAMBÚRGUER + drawer overlay (CSS + JS mínimo)

```html
<nav class="nav">
  <a class="brand" href="#">Marca</a>
  <button class="burger" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu">
    <span></span><span></span>
  </button>
  <div class="links" id="menu"><a href="#a">A</a><a href="#b">B</a><a href="#c">C</a></div>
</nav>
```
```css
.burger { display: none; }
@media (max-width: 768px) {
  .links {
    position: fixed; inset: 0; z-index: 40;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(20px);
    opacity: 0; visibility: hidden; transition: opacity .3s ease, visibility 0s .3s;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .links.open { opacity: 1; visibility: visible; transition: opacity .3s ease; }
  .links a { font-size: 1.5rem; }              /* alvo grande */
  .burger { display: inline-flex; flex-direction: column; gap: 5px; width: 44px; height: 44px;
            align-items: center; justify-content: center; background: none; border: 0; }
  .burger span { width: 22px; height: 2px; background: currentColor; transition: transform .25s; }
  .burger[aria-expanded="true"] span:first-child { transform: translateY(3.5px) rotate(45deg); }
  .burger[aria-expanded="true"] span:last-child { transform: translateY(-3.5px) rotate(-45deg); }
}
```
```js
const b = document.querySelector('.burger'), m = document.getElementById('menu');
b.addEventListener('click', () => {
  const open = b.getAttribute('aria-expanded') === 'true';
  b.setAttribute('aria-expanded', String(!open));
  m.classList.toggle('open', !open);
});
m.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  b.setAttribute('aria-expanded', 'false'); m.classList.remove('open');   /* fecha ao navegar */
}));
```
Alternativa (app/e-commerce): **bottom tab bar** com 4-5 ações na thumb-zone, `position: fixed;
bottom: 0; padding-bottom: env(safe-area-inset-bottom)`.

---

## 7. CTA primário → STICKY-BOTTOM full-width no mobile (conversão)

```css
@media (max-width: 640px) {
  .cta-sticky {
    position: sticky; bottom: 0; z-index: 30;
    padding: .75rem 1rem calc(.75rem + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(12px);
  }
  .cta-sticky .btn { width: 100%; min-height: 48px; }
}
```

---

## 8. Matar hover / parallax / pin no mobile

**Hover só onde existe ponteiro fino** (todo hover do site):
```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-4px); }
  .btn:hover .icon { transform: translateX(2px); }
}
.btn:active { transform: scale(.98); }   /* feedback tátil no toque, sempre */
```
**GSAP: pin/parallax só no desktop; mobile ganha reveal simples ou estático:**
```js
const mm = gsap.matchMedia();
mm.add("(min-width: 861px)", () => {
  // pin, scroll-vídeo, parallax aqui
  gsap.to(track, { x: () => -(track.scrollWidth - innerWidth),
    scrollTrigger: { trigger: gal, pin: true, scrub: .6, anticipatePin: 1, invalidateOnRefresh: true }});
});
mm.add("(max-width: 860px)", () => {
  // sem pin: trilho nativo + reveal leve
  ScrollTrigger.batch(".reveal", { start: "top 88%", once: true,
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, stagger: .08, duration: .6 }) });
});
```
**Cursor custom / tilt / magnético:** só instancie dentro de
`if (matchMedia("(hover: hover) and (pointer: fine)").matches) { ... }`.

---

## 9. Container query (componente reage ao contêiner, não à tela)

```css
.card-host { container-type: inline-size; }
.card { display: grid; gap: .75rem; }                 /* base: empilhado */
@container (min-width: 420px) {
  .card { grid-template-columns: 96px 1fr; align-items: center; }  /* largo: imagem ao lado */
}
```
Tailwind v4: `@container` + `@min-[420px]:grid-cols-[96px_1fr]` (com plugin/`@container`).

---

## 10. Tokens fluidos (clamp) — cole no `:root`

```css
:root {
  --step-fluid-hero: clamp(2.2rem, 7vw, 5rem);
  --step-fluid-h2:   clamp(1.6rem, 4.5vw, 3rem);
  --pad-section:     clamp(3rem, 10vw, 8rem);   /* padding-block das seções */
  --gap:             clamp(.75rem, 3vw, 1.5rem);
}
.hero-title { font-size: var(--step-fluid-hero); line-height: 1.05; text-wrap: balance;
              overflow-wrap: anywhere; }
section { padding-block: var(--pad-section); }
```

---

## 11. Imagens responsivas (resolução + art direction + sem CLS)

```html
<!-- resolução por densidade/tamanho -->
<img src="hero-800.jpg"
     srcset="hero-480.jpg 480w, hero-800.jpg 800w, hero-1600.jpg 1600w"
     sizes="(max-width: 640px) 100vw, 50vw"
     width="1600" height="1000" style="aspect-ratio:16/10;object-fit:cover"
     loading="eager" fetchpriority="high" alt="...">

<!-- art direction: recorte diferente no mobile -->
<picture>
  <source media="(max-width: 640px)" srcset="hero-portrait.jpg">
  <img src="hero-landscape.jpg" alt="..." style="aspect-ratio:4/5" loading="lazy">
</picture>
```

---

## 12. Caçar o overflow horizontal (o scroll fantasma)

```css
html, body { overflow-x: clip; }               /* trava o sintoma */
* { min-width: 0; }                            /* filhos de flex/grid não estouram */
img, video, svg, table { max-width: 100%; }
```
Para achar o CULPADO (cole no console):
```js
document.querySelectorAll('*').forEach(el => {
  if (el.offsetWidth > document.documentElement.clientWidth) console.log('estoura:', el);
});
```
Culpados comuns: `100vw` dentro de container com padding (use `100%`), largura fixa em px,
imagem sem `max-width`, grid que não colapsou, `margin` negativa maior que o respiro.

---

## 13. Detecção em JS (quando precisa ramificar comportamento)

```js
const isTouch  = matchMedia("(hover: none) and (pointer: coarse)").matches;
const isPhone  = matchMedia("(max-width: 640px)").matches;
const reduce   = matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = navigator.connection?.saveData === true;
// ex.: só carrega o efeito pesado se fizer sentido
if (!isPhone && !reduce && !saveData) initHeavyEffect();
```
Prefira **CSS media/container queries** para layout; use JS só para **comportamento**
(montar/desmontar efeito, trocar componente).
