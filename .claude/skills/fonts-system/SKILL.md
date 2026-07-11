---
name: fonts-system
description: Sistema de fontes do estúdio. Use SEMPRE que for escolher, instalar, inspecionar ou aplicar tipografia num projeto. Sabe onde ficam as fontes locais do usuário por SO (Windows/macOS/Linux), inspeciona arquivos .ttf/.otf/.woff2 (família, pesos, glifos) com fonttools, converte para WOFF2, monta @font-face (embutido em base64 ou referenciado), e recomenda pares display+corpo por tipo de projeto. Complementa ui-ux-pro-max (57 pares de fonte) e o FONTES.md. Regra dura herdada de todas as skills de taste: NUNCA Inter/Roboto/Arial/Open Sans/Helvetica como display. Dispare em: "fonte", "tipografia", "font-face", "usar minhas fontes", "que fonte usar", "font pairing".
---

# fonts-system — Tipografia do estúdio

A tipografia carrega a personalidade da página. O pior sinal de "site de IA" é
Inter/Roboto/Arial como display. Esta skill faz duas coisas: **(1) usar as fontes que
você já baixou no seu computador** e **(2) recomendar fontes de caráter** que o Claude
Code normalmente não alcança. Tabelas completas (locais por SO + biblioteca curada) em
`FONTES.md`.

---

## 1. Onde ficam as fontes locais (por SO)

Quando o usuário disser "use minhas fontes", procure aqui:

| SO | Pasta(s) |
|---|---|
| **Windows** | `C:\Windows\Fonts` (sistema) · `%LOCALAPPDATA%\Microsoft\Windows\Fonts` (por usuário) |
| **macOS** | `/Library/Fonts` · `~/Library/Fonts` (usuário) · `/System/Library/Fonts` |
| **Linux** | `/usr/share/fonts` · `/usr/local/share/fonts` · `~/.local/share/fonts` · `~/.fonts` |

> **Recomendado:** peça ao usuário para manter um **repositório de fontes** próprio
> (ex.: `~/Fontes/` ou `D:\Fontes\`) e aponte o Claude Code para lá — mais limpo que varrer
> a pasta do sistema inteira. O prompt `prompts/02-ingerir-minhas-fontes.md` cataloga
> essa pasta e gera um manifest.

---

## 2. Inspecionar fontes (fonttools)

Nunca chute o nome da família nem os pesos — leia do arquivo:
```bash
pip install fonttools
# nome da família + subfamília:
python -c "from fontTools.ttLib import TTFont; f=TTFont('MinhaFonte.otf'); \
print({r.nameID:r.toUnicode() for r in f['name'].names if r.nameID in (1,2,4,6,16,17)})"
```
- nameID 1/2 = família/subfamília · 4 = nome completo · 6 = PostScript name · 16/17 =
  família/subfamília tipográfica preferida (para famílias com muitos pesos).
- Cobertura de glifos (tem acentos PT-BR? tem o caractere X?):
```bash
python -c "from fontTools.ttLib import TTFont; f=TTFont('MinhaFonte.otf'); \
cmap=f.getBestCmap(); print('á' in map(chr,cmap), 'ç' in map(chr,cmap), len(cmap),'glifos')"
```

---

## 3. Converter para WOFF2 (menor, universal)

Sempre sirva **WOFF2** na web (menor que TTF/OTF, suporte universal):
```bash
pip install fonttools brotli
python -c "from fontTools.ttLib import TTFont; f=TTFont('MinhaFonte.otf'); \
f.flavor='woff2'; f.save('MinhaFonte.woff2')"
```

---

## 4. Montar @font-face — 2 modos

**Modo A — referenciado (padrão em projeto com build / pasta de assets):**
```css
@font-face {
  font-family: 'Clash Display';
  src: url('/fonts/ClashDisplay-Variable.woff2') format('woff2');
  font-weight: 200 700;               /* range = fonte variável */
  font-display: swap;
  font-style: normal;
}
:root { --font-display: 'Clash Display', serif; --font-body: 'Switzer', sans-serif; }
```

**Modo B — embutido em base64 (HTML "abre com dois cliques", 100% portátil):**
```bash
# gera o data URI da fonte:
python -c "import base64; print('data:font/woff2;base64,'+base64.b64encode(open('MinhaFonte.woff2','rb').read()).decode())"
```
```css
@font-face{ font-family:'MinhaFonte'; src:url(data:font/woff2;base64,XXXX...) format('woff2'); font-display:swap; }
```
> Embutir deixa o arquivo autossuficiente (bom para o estilo "vanilla, dois cliques"),
> mas engorda o HTML. Referenciar mantém limpo mas exige os arquivos junto. Escolha pelo
> tipo de entrega.

**Página de specimen:** para o usuário ver as fontes antes de escolher, gere um HTML com a
família em vários tamanhos/pesos + um pangrama PT-BR ("Um pequeno jabuti xereta viu dez
cegonhas felizes").

---

## 5. Fontes de caráter (grátis) que o Claude Code normalmente não usa

Fontshare (Indian Type Foundry — **grátis inclusive comercial**) é a mina de ouro:
**Clash Display, General Sans, Satoshi, Cabinet Grotesk, Switzer, Zodiak, Sentient,
Ranade, Melodrama, Panchang, Boska, Erode**.
Google Fonts com personalidade: **Fraunces** (serifa variável "wonky"), **Bricolage
Grotesque, Space Grotesk, Instrument Serif, Unbounded, Hanken Grotesk, Newsreader**.
Monos com caráter: **JetBrains Mono, Geist Mono, Departure Mono, Martian Mono, Space Mono**.

Fontes de fundição (o usuário baixa e entrega os arquivos → você usa via §1-4):
**PP Editorial New, PP Neue Montreal (Pangram Pangram)**, **Söhne, GT America, GT Sectra
(Grilli Type/Klim)**, **Migra, Basement Grotesque**, etc.

Biblioteca completa por estilo (Institucional / Premium-Tech / Marketing / Editorial /
Disruptivo / Mobile) → **`FONTES.md`**. Pares prontos → skill `ui-ux-pro-max` (57 pares).

---

## 6. Regras (herdadas das skills de taste)

- **Banidas como display:** Inter, Roboto, Arial, Open Sans, Helvetica. (Como corpo, em
  último caso, tudo bem — mas prefira uma grotesk de caráter.)
- **Par deliberado:** 1 display característico (usado com contenção) + 1 corpo legível
  (+ 1 mono para dados/código, se precisar).
- **Escala e peso intencionais:** tracking apertado em títulos (`-0.02em` a `-0.04em`),
  `line-height` ~1.1 no display e ~1.6 no corpo.
- **Corpo nunca preto puro** (`#111` / charcoal); performance: `font-display: swap`.
- Faça a tipografia ser **memorável**, não um veículo neutro do conteúdo.
