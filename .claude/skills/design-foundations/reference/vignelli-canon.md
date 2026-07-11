# Massimo Vignelli: o Cânone (a disciplina que virou o design tech)

Vignelli (metrô de NY, American Airlines, Knoll) escreveu *The Vignelli Canon*, o manifesto
que mais influenciou a estética que hoje chamamos de "premium tech". Seu lema: "If you can
design one thing, you can design everything". O Cânone divide o ofício em **Intangíveis** (a
filosofia) e **Tangíveis** (a prática), e os intangíveis são exatamente o que falta em site de IA.

## Os Intangíveis (a tríade + a disciplina)

- **Semântica**: a busca do significado do que se vai desenhar. A PRIMEIRA coisa em qualquer
  projeto: pesquisar a história do assunto, a empresa, o produto, a posição de mercado, a
  concorrência e o destino final, para achar a direção apropriada. Design sem essa busca é
  arbitrário, raso, e ignora a cultura estabelecida. (É o espelho visual do R do RMBC da skill
  de copy. Pesquisa é a raiz das duas.)
- **Sintática**: a gramática visual — estrutura geral, grid, tipografias, títulos, texto,
  ilustração, e a relação disciplinada entre eles. O mestre de Vignelli dizia que Deus está
  nos detalhes: sintaxe é controlar cada relação entre elementos. Consistência sintática =
  coerência entre todas as partes.
- **Pragmática**: se, no fim, ninguém entende o resultado, todo o esforço foi desperdiçado.
  Qualquer artefato deve se sustentar sozinho, com clareza total. Régua prática para interface:
  quanto mais copy explicativa e onboarding a tela precisa, pior a pragmática dela.
- Os outros intangíveis que completam a régua: **Disciplina** (atenção obsessiva a cada
  detalhe), **Adequação** (a solução serve a ESTE problema, não ao portfólio), **Ambiguidade
  controlada** (camadas de leitura, nunca confusão), **Design é um só** (quem projeta uma
  coisa projeta qualquer coisa: a mesma cabeça serve logo, site e fachada), **Força visual**
  (conceito claro + forma bela + escala certa), **Elegância intelectual** (a solução acima do
  compromisso), **Atemporalidade** (fugir da moda literal), **Responsabilidade** e **Equidade**.

## Os Tangíveis (a prática que virou design token)

- **Grid, margens, colunas e módulos** como fundação de qualquer página.
- **Pouquíssimas typefaces bastam.** Vignelli defendia trabalhar com um punhado de famílias de
  qualidade a vida inteira. Tradução direta: a regra do kit de 2-3 famílias por projeto é
  Vignelli puro.
- **Relações de corpo tipográfico**: poucos tamanhos, com relação clara entre eles (uma escala
  modular), não um tamanho novo por caixa de texto.
- **Espaço em branco é material de projeto**, não sobra. Ele separa, agrupa e dá respiro (o
  macro-whitespace das skills de taste é isto).
- **Escala**: o contraste de tamanhos é uma das maiores fontes de força visual.
- Paleta estrutural mínima: ele resolvia quase tudo com preto, branco e vermelho. Tradução:
  1 cor de marca + neutros + 1 acento resolve 90% dos projetos.

## Aplicação web direta

- **Design tokens são o Cânone codificado**: definir `--font-display`, `--font-body`, escala
  de espaçamento (4/8px), escala tipográfica modular e 3 cores estruturais ANTES da primeira
  seção. Depois, disciplina: nenhum valor mágico fora do sistema.
- **Escala tipográfica com `clamp()`**: poucos degraus, fluidos entre breakpoints (padrão 2026
  verificado), em vez de um tamanho por media query.
- **Teste de atemporalidade** antes de entregar: se remover os acentos de tendência, a página
  ainda para em pé em 5 anos? Se não, a base está errada.
