---
name: svgator-animations
description: Sistema oficial de animações vetoriais do projeto (SVGator — app.svgator.com). Use esta skill SEMPRE que for adicionar ou integrar qualquer animação vetorial na interface — logo animada, loaders/spinners, heros animados, ilustrações de empty state, animações de sucesso/erro, micro-interações de scroll ou hover, e qualquer arquivo .svg animado exportado do SVGator. Dispare em qualquer menção a "animação", "SVG animado", "svgator", "logo animada", "loader", "animar o hero/landing", ou quando um arquivo em public/animations/svgator/ for referenciado. Para ÍCONES pequenos de UI use a skill iconsax-icons; esta skill cobre animações maiores e cenas. Nunca recrie animações prontas do SVGator à mão em CSS/Framer Motion.
---

# SVGator — Animações vetoriais do projeto

SVGator (app.svgator.com) é a ferramenta onde as animações vetoriais do projeto são
criadas. Ele exporta SVG animado em **dois motores: JavaScript ou CSS only** — e também
Lottie JSON, GIF, WEBP, APNG e vídeo. O SVG animado roda nativo no navegador, sem
biblioteca. Você NÃO tem login no SVGator: quando faltar um arquivo, peça ao usuário
para exportar com as configurações da seção "Checklist de exportação" e salvar na pasta
convencionada.

## Convenções de arquivos

- Pasta única: `public/animations/svgator/` (Next.js) em kebab-case.
- Sufixo indica o motor: `nome--css.svg` (CSS only) ou `nome--js.svg` (JavaScript).
  Se o sufixo faltar, detecte: o arquivo contém `<script` → motor JS.
- Lottie JSON exportado do SVGator vai para `public/icons/animated/` e usa o
  componente `AnimatedIcon` da skill iconsax-icons (mesmo pipeline lottie-react).

## Decisão: qual exportação usar para cada caso

| Caso | Exportar | Embed |
|---|---|---|
| Loader, fundo, decorativo em loop, sem interação | **CSS only** | `<img src="/animations/svgator/x--css.svg" />` |
| Interativo (hover, click, scroll into view) ou controlado por código | **JavaScript** + start "Programmatic" | componente `SvgatorPlayer` (abaixo) |
| React Native / Flutter / pipeline Lottie | **Lottie JSON** | `AnimatedIcon` (skill iconsax) |

Regra de ouro: prefira **CSS only** sempre que a animação for "dispara e esquece" —
zero JavaScript, mais leve, roda até dentro de `<img>`. Use JS apenas quando precisar
de gatilho ou controle.

## Por que NUNCA inlinar o SVG com motor JS no JSX

O export JS do SVGator embute um `<script>` dentro do `.svg`. React não executa
scripts vindos de JSX nem de `dangerouslySetInnerHTML` — a animação simplesmente não
roda. O embed correto para motor JS é `<object type="image/svg+xml">` (executa o
script e, por ser same-origin em /public, dá acesso ao player). O componente
`SvgatorPlayer` já resolve isso. `<img>` NÃO executa script (só serve para CSS only).

## Componente padrão: SvgatorPlayer

Template em `assets/SvgatorPlayer.tsx` desta skill. Na primeira utilização, copie para
`src/components/animations/SvgatorPlayer.tsx`. Não tem dependência externa.

```tsx
// dispara quando entra na tela (heros, ilustrações de seção)
<SvgatorPlayer src="/animations/svgator/hero-lancamento--js.svg" trigger="visible" width={520} height={360} />

// toca no hover (logo do header)
<SvgatorPlayer src="/animations/svgator/logo--js.svg" trigger="hover" width={120} height={40} ariaLabel="Logo" />

// controle manual (sucesso de pagamento: tocar quando a confirmação chegar)
<SvgatorPlayer src="/animations/svgator/pagamento-sucesso--js.svg" trigger="manual" onReady={(p) => (playerRef.current = p)} />
// depois: playerRef.current?.play()
```

A API do player (em `svgElement.svgatorPlayer`, após `.ready()`) tem `play()`,
`pause()`, `restart()`, `reverse()`, `toggle()`, `seek()` e `setSpeed()` — o wrapper
entrega o objeto `player` pronto via `onReady`.

## Checklist de exportação (passe EXATAMENTE isto ao usuário quando pedir um arquivo)

1. Export → **Animated SVG**.
2. Animation type: **JavaScript** (se interativo/controlado) ou **CSS only** (decorativo).
3. Start: **Programmatic** quando for usar `trigger="manual"|"visible"|"hover"` no
   wrapper (o wrapper controla); ou o gatilho nativo se for uso solto.
4. IDs: **Unique IDs** — obrigatório, pois haverá vários SVGs na mesma página.
5. Document type: **Responsive**.
6. Salvar como `public/animations/svgator/<nome>--js.svg` (ou `--css.svg`).

## Regras de performance e acessibilidade

- Máximo de 2–3 animações SVGator rodando simultaneamente por tela; pause o que saiu
  do viewport (o wrapper com `trigger="visible"` já pausa ao sair).
- Animações abaixo da dobra: sempre `trigger="visible"` (não rodar fora da tela).
- `prefers-reduced-motion: reduce` → o wrapper nunca chama play (mostra o primeiro
  frame estático). Não remova esse comportamento.
- Decorativo → `aria-hidden`; significativo → `ariaLabel` (o wrapper aplica `role="img"`).
- Loop infinito só para LIVE/loaders. Sucesso/erro tocam uma vez.
- Não anime via Framer Motion algo que já é animado pelo SVGator (conflito de transform).

## Checklist final de qualquer tarefa com SVGator

- [ ] Motor certo para o caso (CSS only vs JS) e embed certo (`<img>` vs `SvgatorPlayer`).
- [ ] Arquivo na pasta convencionada com sufixo de motor.
- [ ] Reduced-motion preservado; abaixo da dobra usa `visible`.
- [ ] Nenhum SVG com `<script>` foi inlinado em JSX.
- [ ] Se faltou arquivo: pediu o export ao usuário com o checklist completo.
