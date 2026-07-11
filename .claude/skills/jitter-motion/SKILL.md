---
name: jitter-motion
description: Ferramenta oficial de motion design do projeto (Jitter — jitter.video). Use esta skill SEMPRE que for integrar vídeos animados, motion graphics, mockups animados, heros em vídeo, animações com fundo transparente sobre o layout, ou arquivos exportados do Jitter (MP4, WebM, MOV/ProRes, GIF, Lottie). Dispare em qualquer menção a "jitter", "vídeo animado", "motion", "animação do hero", "vídeo de fundo", "vídeo transparente", "demo animada", ou quando arquivos em public/animations/jitter/ forem referenciados. Para ícones de UI use iconsax-icons; para SVG animado interativo use svgator-animations; esta skill cobre VÍDEO e cenas de motion design. Nunca embede GIF pesado no app nem recrie à mão um motion que já existe no Jitter.
---

# Jitter — Motion design (vídeo e cenas) do projeto

Jitter (jitter.video) é onde as peças de motion design do projeto são criadas (importa
direto do Figma). Exporta **MP4, MOV, WebM, GIF e Lottie**; transparência só em WebM e
MOV (ProRes 4444). Você NÃO tem login no Jitter: quando faltar um arquivo, peça ao
usuário o export com o checklist abaixo.

**Limites de plano (avise o usuário quando relevante):** Free = GIF/MP4/Lottie até
720p/30fps COM marca d'água — serve só para rascunho. Export final exige Pro (1080p,
WebM, ProRes, sem marca). **Fundo transparente exige o plano Max.**

## Convenções de arquivos

Pasta única: `public/animations/jitter/`, kebab-case.

- Vídeo normal: `nome.mp4` + poster obrigatório `nome.poster.jpg`
- Vídeo transparente (par obrigatório p/ cross-browser): `nome.webm` + `nome.hevc.mp4`
- Lottie do Jitter: `nome.json` (renderiza com o `AnimatedIcon` da skill iconsax-icons)
- GIF: NUNCA dentro do app (pesado, sem controle) — só README, e-mail e social.

## Decisão: qual export para cada caso

| Caso | Export no Jitter | Embed |
|---|---|---|
| Elemento vetorial animado de UI (leve, escala) | Lottie JSON | `AnimatedIcon` |
| Hero/seção cinematográfica, mockup de produto animado, demo | MP4 (H.264) | `JitterVideo` |
| Animação SEM fundo flutuando sobre o layout | WebM transparente + MOV ProRes 4444 | `JitterVideo` com `alpha` |
| Social, e-mail, README | GIF ou MP4 | fora do app |

Lottie do Jitter tem pegadinha: propriedades não suportadas pelo formato (blurs e
alguns efeitos) simplesmente NÃO são renderizadas no export. Sempre peça ao usuário
para conferir o preview Lottie antes de salvar; se o efeito sumir, exporte como vídeo.

## A pegadinha da transparência (cross-browser)

WebM com alpha roda em Chrome/Firefox/Edge, **mas não no Safari**. Safari precisa de
HEVC com alpha (`hvc1`). O Jitter exporta a transparência em WebM e MOV ProRes 4444 —
o ProRes é gigante e não é para web: converta para HEVC alpha. O componente
`JitterVideo` com `alpha` já declara as duas fontes na ordem certa.

Conversões (você pode rodar ffmpeg):

```bash
# ProRes 4444 (.mov) -> HEVC alpha p/ Safari (REQUER macOS/VideoToolbox)
ffmpeg -i nome.mov -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.75 -tag:v hvc1 -an nome.hevc.mp4
# Sem macOS disponível: peça ao usuário para converter (ex.: rotato.app/converter) ou rodar o comando num Mac.

# Comprimir MP4 para web (alvo: hero <= 2,5 MB)
ffmpeg -i original.mp4 -c:v libx264 -crf 23 -preset slow -movflags +faststart -an nome.mp4

# Gerar poster do primeiro frame
ffmpeg -i nome.mp4 -frames:v 1 -q:v 3 nome.poster.jpg
```

## Componente padrão: JitterVideo

Template em `assets/JitterVideo.tsx` desta skill — copie para
`src/components/animations/JitterVideo.tsx` na primeira utilização. Sem dependências.

```tsx
// hero com vídeo (toca quando visível, pausa fora da tela, poster automático)
<JitterVideo srcBase="/animations/jitter/hero" width={960} aspectRatio="16/9" ariaLabel="Demonstração do produto" />

// animação transparente sobre o layout (webm + hevc fallback)
<JitterVideo srcBase="/animations/jitter/logo-hero" alpha width={220} aspectRatio="1/1" />
```

O componente sempre usa `muted playsInline loop preload="metadata"` + poster,
IntersectionObserver (play visível / pause fora) e `prefers-reduced-motion`
(mostra só o poster, nunca dá autoplay).

## Checklist de exportação (passe EXATAMENTE isto ao usuário)

1. Formato conforme a tabela de decisão (MP4 / WebM+MOV transparente / Lottie).
2. Resolução: 2x a área de exibição, teto 1080p (4K só para vídeo full-bleed em telão).
3. FPS: 30 (60 apenas para micro-detalhe rápido — dobra o peso).
4. Loop: marcado para fundos/LIVE; desmarcado para sucesso/erro (toca 1x).
5. Transparente: remover o fundo do artboard E escolher formato transparente (plano Max).
6. Sem marca d'água (plano pago) para qualquer asset final.
7. Salvar com o nome convencionado em `public/animations/jitter/`.

## Regras de performance e acessibilidade

- Orçamento de peso: hero MP4 <= 2,5 MB · alpha (webm) <= 1,5 MB · Lottie <= 300 KB.
  Estourou? Recomprimir com os comandos acima ou reduzir duração/resolução.
- Máximo 1 vídeo em autoplay por tela; abaixo da dobra só toca quando visível.
- Vídeo decorativo → `aria-hidden`; significativo → `ariaLabel` no componente.
- Nunca vídeo com áudio em autoplay (o componente já remove áudio com `-an`/muted).
- Não sobrepor animação Framer Motion ao próprio vídeo (conflito visual).

## Checklist final

- [ ] Export certo para o caso; GIF não entrou no app.
- [ ] Poster gerado; par webm+hevc presente quando `alpha`.
- [ ] Dentro do orçamento de peso; reduced-motion preservado.
- [ ] Se faltou arquivo ou plano: pediu ao usuário com o checklist completo.
