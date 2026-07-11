---
name: scroll-cinematic
description: Scroll-driven storytelling e sites cinematográficos. Use SEMPRE que a tarefa envolver scroll-vídeo (sequência de frames em canvas amarrada ao scroll, estilo Logitech/Apple), pin + scroll horizontal, parallax, smooth scroll (Lenis), reveals no scroll, animação de texto letra-a-letra no scroll (SplitText), traço SVG que se desenha (DrawSVG), morph de SVG (MorphSVG), ou qualquer "momento cinematográfico" controlado pela rolagem. Cobre a stack GSAP 3.13+ (agora 100% grátis, TODOS os plugins) + ScrollTrigger + Lenis 1.3.x + Canvas API + pipeline de assets com FFmpeg e Higgsfield (MCP). NÃO cobre micro-interações genéricas por código puro (skill animejs) nem ícones Lottie (iconsax-icons). Dispare em: "scroll", "scrollytelling", "scroll-vídeo", "parallax", "pin", "smooth scroll", "Lenis", "GSAP", "ScrollTrigger", "herói cinematográfico", "site imersivo".
---

# scroll-cinematic — Sites cinematográficos com scroll

Storytelling dirigido por scroll: a página conta uma história conforme rola, com
imagens, vídeo e elementos reagindo à rolagem. Família de sites tipo Fanta, Logitech,
Iron Man, Amaro.fy. A arte é **combinar peças de lego** (scrub, pin, parallax, frames,
traço SVG, reveals) na dose certa, com degradação graciosa.

> **Resumo de uma linha:** GSAP + ScrollTrigger animam, **Lenis** deixa fluido, e o
> **canvas com sequência de frames** faz o "scroll-vídeo". Combine as três (em HTML
> puro ou React) e você reproduz qualquer um desses sites.

---

## 0. FATO CRÍTICO — GSAP é 100% grátis desde abril/2025 (v3.13)

Graças à Webflow, **TODO o GSAP é grátis, inclusive comercial**, incluindo os plugins
que eram pagos (Club GSAP). Isto muda o jogo — não evite mais estes plugins:

| Plugin (agora grátis) | O que faz | Uso cinematográfico |
|---|---|---|
| **SplitText** | quebra texto em linhas/palavras/letras (reescrito, 50% menor, com máscara e acessibilidade) | text-reveal letra-a-letra no scroll, hero que "monta" |
| **DrawSVG** | anima `stroke` de um path (draw-on) | o "fio" que se desenha (era feito na mão com dashoffset) |
| **MorphSVG** | transforma um SVG em outro | logo que vira ícone, play↔pause, formas fluidas |
| **ScrollSmoother** | smooth scroll do próprio GSAP (alternativa ao Lenis) | fluidez + efeito `data-speed` de parallax nativo |
| **ScrambleText** | embaralha texto até o final | contadores/hero com "decode" |
| **Physics2D / Inertia** | física de partículas e arremesso | letras que caem, grids interativos |
| **MotionPath** | anima ao longo de um path | elemento que segue uma curva no scroll |
| **Flip** | transição de estado de layout | reordenar grid com animação |

CDN oficial (cdnjs/jsdelivr), sem token:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/SplitText.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/DrawSVGPlugin.min.js"></script>
```
```js
gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
```

**Nota de escolha:** Lenis vs ScrollSmoother — ambos dão smooth scroll. Use **Lenis**
como padrão (leve, robusto, integra com tudo). Use **ScrollSmoother** se já estiver 100%
no ecossistema GSAP e quiser `data-speed`/`data-lag` nativos. Nunca os dois juntos.

---

## 1. Stack e quando usar cada peça

| Ferramenta | O que faz | Quando |
|---|---|---|
| **GSAP** | motor de animação JS, timelines precisas | sempre que tiver animação séria |
| **ScrollTrigger** | liga animação ao scroll: dispara, pin, scrub | qualquer efeito controlado pelo scroll |
| **Lenis** | smooth scroll (amortece a rolagem) | sensação premium no site inteiro |
| **Canvas API** | desenha pixels; "toca" sequência de frames | scroll-vídeo frame a frame |
| **SplitText/DrawSVG/MorphSVG** | texto/SVG avançado (grátis) | reveals de texto, traços, morphs |
| **Framer Motion** | animação declarativa p/ React | só em projeto React grande/componentizado |

> **Regra de ouro:** GSAP + ScrollTrigger + Lenis resolvem 90% desses efeitos em
> HTML/CSS/JS puro, **sem framework**. React/Framer só compensa quando o site é grande.
> Para uma página só, vanilla é mais leve e "abre com dois cliques".

---

## 2. Técnicas-núcleo (código real)

### A) Smooth scroll — base fluida (Lenis 1.3.x)
Versão atual do Lenis tem `autoRaf` (não precisa mais fiar o loop na mão):
```js
import Lenis from 'lenis'
// simples: autoRaf cuida do requestAnimationFrame
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, autoRaf: true })
```
Integração com GSAP ScrollTrigger (quando quiser controlar o tick pelo GSAP — não use
`autoRaf` neste caso):
```js
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
```
No-code (drop numa tag, resolve modais/âncoras/reset de página):
```html
<link rel="stylesheet" href="https://unpkg.com/lenis@1.3.23/dist/lenis.css">
<script src="https://unpkg.com/lenis@1.3.23/dist/lenis.min.js"></script>
<script>new Lenis({ autoRaf: true, anchors: true, allowNestedScroll: true })</script>
```
Modais/áreas que não devem suavizar: `<div data-lenis-prevent>`.

### B) Elementos que viajam entre seções — scrub (técnica do Fanta)
Elementos em `position:absolute` + timeline com `scrub:true` animando `top/left/width/rotate`.
Truque: `top` passa de 100% (`120%`, `160%`) porque o elemento é absoluto na 1ª seção mas
é empurrado para baixo, caindo nas seções seguintes.
```js
const tl = gsap.timeline({ scrollTrigger:{
  trigger: '.two', start: '0% 95%', end: '70% 50%', scrub: true
}});
tl.to('#produto', { top: '120%', left: '0%'  }, 'move')   // label 'move'…
  .to('#folha',   { width: '15%', top: '160%', right: '10%' }, 'move')  // …sincroniza tudo
  .to('#brilho',  { top: '110%', rotate: '130deg', left: '70%' }, 'move');
```
- `scrub:true` = animação "rolada" pela barra (vai e volta com você).
- **label** (`'move'`) = vários elementos animam ao mesmo tempo.
- `.from(...)` com `left:'-100%'`, `rotate:'-90deg'` = peça "voa" pela lateral.

### C) Scroll-vídeo: sequência de frames em canvas (Logitech / Iron Man)
**NÃO é `<video>` tocando.** Um vídeo vira centenas de JPGs; os frames são pré-carregados
e desenhados num `<canvas>`; o índice do frame é mapeado ao scroll. (`<video>` trava ao
"pular" para `currentTime` exato — canvas é liso e confiável.)
```js
const FRAME_COUNT = 150;
const framePath = i => `assets/frames/f_${String(i).padStart(3,'0')}.jpg`;
const frames = []; let target = 0, eased = 0, lastDrawn = -1;
const canvas = document.querySelector('#heroCanvas'), ctx = canvas.getContext('2d');
const hero = document.querySelector('#hero');
const DPR = Math.min(window.devicePixelRatio, 2);        // trava DPR (retina mata perf)

// 1) pré-carrega (mostre uma barra de progresso!)
for (let i = 0; i < FRAME_COUNT; i++){ const img = new Image(); img.src = framePath(i+1); frames[i] = img; }

function resize(){ canvas.width = innerWidth*DPR; canvas.height = innerHeight*DPR; }
function draw(f){
  const img = frames[Math.round(f)]; if(!img || !img.naturalWidth) return;
  const cw = canvas.width, ch = canvas.height;
  const scale = Math.max(cw/img.naturalWidth, ch/img.naturalHeight);   // ← COVER (sem borda)
  const w = img.naturalWidth*scale, h = img.naturalHeight*scale;
  ctx.clearRect(0,0,cw,ch);
  ctx.drawImage(img, (cw-w)*0.5, (ch-h)*0.5, w, h);
}
function progress(){
  const rect = hero.getBoundingClientRect();
  return Math.min(1, Math.max(0, -rect.top / (hero.offsetHeight - innerHeight)));
}
function onScroll(){ target = progress() * (FRAME_COUNT - 1); }
function tick(){
  eased += (target - eased) * 0.18;                       // ← a "manteiga" (easing por rAF)
  if (Math.round(eased) !== lastDrawn){ draw(eased); lastDrawn = Math.round(eased); }
  requestAnimationFrame(tick);
}
addEventListener('resize', () => { resize(); draw(eased); });
addEventListener('scroll', onScroll, { passive:true });
resize(); onScroll(); tick();
```
Três detalhes que fazem a diferença: **herói mais alto que a tela** (`~300vh`) com o canvas
`sticky` dentro (é a "distância de rolagem" que toca o vídeo); **`Math.max` (cover)** para
nunca aparecer borda; **easing por rAF** (`eased += (target-eased)*0.18`) para o movimento
ser sedoso, não travado.

HTML do herói:
```html
<section id="hero" style="height:300vh">
  <div style="position:sticky;top:0;height:100svh;overflow:hidden">
    <canvas id="heroCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    <h1 style="position:absolute;z-index:2">Seu título</h1>
  </div>
</section>
```
> Alternativa com GSAP puro (sem loop manual): anime um objeto `{f:0}` com
> `snap:'f'`, `scrub:true`, `pin:true` e `onUpdate: () => draw(obj.f)`.

### D) Pin + scroll horizontal
```js
const track = document.querySelector('.track');
gsap.to(track, {
  x: () => -(track.scrollWidth - innerWidth), ease: 'none',
  scrollTrigger: {
    trigger: '.galeria', start: 'top top',
    end: () => '+=' + (track.scrollWidth - innerWidth),
    scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true
  }
});
```

### E) Parallax
```js
gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none',
  scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }});
```
> Deixe a imagem com `transform: scale(1.1)` no CSS para a margem extra esconder as bordas.

### F) Traço SVG que se desenha (o "fio" do Amaro.fy) — agora com DrawSVG
Antes (na mão, sem plugin):
```js
const L = path.getTotalLength(); path.style.strokeDasharray = L;
function knit(){ const p = scrollY/(document.documentElement.scrollHeight - innerHeight);
  path.style.strokeDashoffset = L*(1-p); }
```
Agora (DrawSVG, grátis):
```js
gsap.from('#fio', { drawSVG: '0%', ease: 'none',
  scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: true }});
```
> Use `vector-effect="non-scaling-stroke"` para o traço manter espessura ao esticar o SVG.

### G) Reveal no scroll (barato e elegante)
```js
gsap.set('.reveal', { opacity: 0, y: 24 });
ScrollTrigger.batch('.reveal', { start: 'top 86%',
  onEnter: els => gsap.to(els, { opacity:1, y:0, stagger:.09, ease:'power3.out', duration:.8 })
});
```

### H) Text-reveal letra-a-letra no scroll (SplitText — grátis)
```js
const split = new SplitText('.hero-title', { type: 'chars, words', mask: 'chars' });
gsap.from(split.chars, {
  yPercent: 120, opacity: 0, stagger: 0.02, ease: 'power4.out',
  scrollTrigger: { trigger: '.hero-title', start: 'top 80%' }
});
```

### I) Degradação graciosa (NÃO pule)
```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) {
  // não liga Lenis, não faz scrub; desenha 1 frame estático; mostra tudo visível
  gsap.set('.reveal', { opacity: 1, y: 0 });
} else {
  // liga Lenis + ScrollTriggers normalmente
}
```

---

## 3. Pipeline de assets (o segredo do scroll-vídeo)

Dois caminhos para o vídeo-fonte:
1. **Filmar** (produto real): movimento único, lento, contínuo, sem cortes; câmera estável
   (tripé/slider/gimbal); fundo limpo; 4–8s.
2. **Gerar por IA** (Higgsfield via MCP): imagem-base fotorrealista → animar (img→vídeo) →
   exportar. Ver §5.

Fatiar em frames (FFmpeg):
```bash
# ~150 frames, largura 1280, boa qualidade:
ffmpeg -i video.mp4 -vf "fps=150/DURACAO_EM_SEGUNDOS,scale=1280:-1" -q:v 4 frames/f_%03d.jpg
```
Matemática: `fps_de_extração = nº_de_frames ÷ duração`. Nomenclatura `f_001.jpg`… e ajuste
`FRAME_COUNT`.

---

## 4. Qualidade de vídeo e fluidez (os "botões")

- **Nº de frames** (o principal): 60–80 (mobile/curto) · 100–150 (sweet spot desktop) ·
  200–240 (ultra-suave, só se o peso permitir).
- **Peso por frame:** mire 40–120KB. Redimensione para 940–1280px, qualidade ~72.
  **Conjunto total < 8–15MB.**
- **Formato:** JPG progressivo é o padrão; **WebP corta ~30%** com mesma qualidade
  (vale trocar). Evite PNG.
- **Easing (a "manteiga"):** o `0.18` do loop — menor (0.10) = mais suave/"preguiçoso";
  maior (0.25) = mais grudado no scroll.
- **DPR:** `Math.min(devicePixelRatio, 2)` (1.5 no mobile).
- **Pré-carregamento:** conjunto ≤150 → carregue tudo com barra; >150 → carregue 1 a cada
  N primeiro (preview) e preencha o resto.
- **fps cinematográfico:** vídeo a 24fps tem cara de cinema; o scrub redistribui pelo
  scroll — precisa de frames **bem distribuídos e nítidos**, não de fps alto.

---

## 5. Gerar assets com o Higgsfield (MCP)

MCP conectado? Verifique com a ferramenta `balance`. Fluxo realista (imagem→vídeo, nunca
texto→vídeo):
```
1) generate_image  → model nano_banana_2, resolution "4K", aspect_ratio "3:4",
                     prompt FOTOGRÁFICO (lente 85mm f/1.8 + luz natural + material real + film grain)
                     [+ referência de foto real / Soul p/ autenticidade]  →  pega o job_id
2) generate_video  → model kling3_0, start_image = job_id, aspect_ratio "9:16",
                     prompt "slow continuous pull-back, smooth steady, no cuts, cinematic"
3) upscale_video   → Topaz/ByteDance (1080p/4K)   [nunca faça upscale de frame borrado]
4) baixa o .mp4    → FFmpeg (§3) → frames → pronto pro herói
```
Regras de realismo: **imagem→vídeo** sempre; **referência real** (`media_upload_widget`)
ou **Soul Character** p/ mesma pessoa; **prompt fotográfico** (evite "3D render", "CGI",
"cartoon"); **movimento único, lento, sem cortes**; `count:1` + `get_cost:true` antes.
Rode `models_explore` para o catálogo atual. URL do MCP: `https://mcp.higgsfield.ai/mcp`.

---

## 6. Mobile, tablet e desktop (não podem ser iguais)

Use `gsap.matchMedia()` (o `ScrollTrigger.matchMedia` está deprecado):
```js
const mm = gsap.matchMedia();
mm.add('(min-width: 861px)', () => { /* pin, frames cheios (100–240), parallax forte */ });
mm.add('(max-width: 860px)', () => { /* swipe nativo, frames enxutos (60–80), SEM pin */ });
```
- **Scroll-vídeo:** desktop cheio + `~300vh`; mobile enxuto + `~200vh`; aparelho fraco →
  troca canvas por **imagem-pôster**. Sirva **9:16 no mobile, 16:9 no desktop** (gere as
  duas versões ou use `reframe` do Higgsfield). Aponte `framePath` p/ `frames-mobile/`.
- **Galeria horizontal:** pin só no desktop; mobile = `overflow-x:auto; scroll-snap` (a
  barra de endereço causa "pulos" com pin).
- **Lenis:** `smoothWheel:true` no desktop; deixe o **toque nativo** no mobile.
- **Altura:** use `100svh`/`100dvh` (não `100vh` — barra de endereço bagunça).
- **Parallax/animação:** reduza no mobile (CPU mais fraca); `will-change` com parcimônia.
- **Conexão:** `loading="lazy"`, assets menores; leia `navigator.connection` (`saveData`,
  `effectiveType`) p/ servir o conjunto leve em 3G.

---

## 7. Guia de decisão rápido

- **Vanilla ou React?** 1 página / entrega simples → **vanilla**. App grande com time →
  **React/Next + Framer Motion**.
- **Scroll-vídeo (frames) ou elementos viajando (scrub)?** "Tocar" um vídeo no scroll →
  **frames no canvas** (C). Objetos deslizando entre seções → **timeline com scrub** (B).
  Os dois juntos = o efeito mais rico.
- **Sempre adicione:** Lenis (A), reveals (G) e degradação graciosa (I).

---

## 8. Erros comuns & performance

- **Não use `<video>` para scrub** — use frames (vídeo trava ao buscar tempo exato).
- **Pré-carregue os frames** com barra; sem isso o herói pisca vazio.
- **`Math.min(devicePixelRatio, 2)`** — sem limitar DPR, retina mata a perf.
- **`scrub` vs disparo:** `scrub` segue o scroll (vai e volta); sem `scrub` roda uma vez ao
  entrar. Não troque um pelo outro sem querer.
- **`invalidateOnRefresh:true`** em pins/horizontais (recalcular no resize).
- **Só `transform`/`opacity`**; `backdrop-blur` só em fixed/sticky.
- **Scripts no fim do `<body>`**, estilos no `<head>`.
- **Sempre `prefers-reduced-motion`.**
- **Nunca dois motores no mesmo elemento** (GSAP + anime.js brigando por `transform`).

---

## 9. Esqueleto mínimo (ponto de partida)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js"></script>
<script src="https://unpkg.com/lenis@1.3.23/dist/lenis.min.js"></script>

<section id="hero" style="height:300vh">
  <div style="position:sticky;top:0;height:100svh;overflow:hidden">
    <canvas id="heroCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    <h1 style="position:absolute;z-index:2">Seu título</h1>
  </div>
</section>
```
```js
gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce){
  const lenis = new Lenis({ lerp:0.1, autoRaf:true });   // A
  // C: canvas scrub  ·  G: ScrollTrigger.batch reveals  ·  D/E: pin/parallax
}
```

Receitas por tipo de site: `SISTEMA.md`. Fontes: `FONTES.md`.
