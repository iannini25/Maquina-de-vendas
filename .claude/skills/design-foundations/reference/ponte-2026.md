# A ponte 2026: fundamento → tendência (estado verificado) + checklist

O que a pesquisa de estado atual confirma, mapeado para o mestre que o sustenta. Regra-mãe
(verificada e alinhada ao Vignelli): **estilo duradouro na base, tendência como acento
removível.** Estilo é linguagem que dura décadas; tendência é expressão de 18 meses. Quem
constrói sobre tendência redesenha todo ano.

| Estado 2026 (verificado) | Fundamento que sustenta | Regra prática no kit |
|---|---|---|
| Clareza em 5 segundos é o "trend" nº 1: o visitante decide se fica | Vignelli (pragmática) + Rand | Herói passa o teste dos 5s: o que é, para quem, qual ação |
| Bento domina como layout modular | Müller-Brockmann (grid modular) | Bento SEM buraco (`grid-flow-dense`) e com colapso mobile projetado |
| Tipografia como arquitetura primária; kinetic type | Scher (tipo como imagem) | Herói tipográfico com display de caráter; kinetic SÓ no herói |
| Anti-grid brutalism como contraposicionamento (quando todos parecem Apple, diferente vira diferencial) | Scher (sério, não solene) + Rand (posicionamento) | `industrial-brutalist-ui` para marcas que aguentam; nunca para clínica/contador |
| Dark mode como tema de primeira classe | Scher (identidade dinâmica) | Tokens prevendo os dois temas desde o início |
| Glassmorphism só como acento (nav/modais); soft UI saindo, "tactile brutalism" entrando (borda 1px, geometria firme) | Vignelli (disciplina) + Müller-Brockmann | Regra do kit confirmada: `backdrop-blur` só em fixed/sticky; cards com borda 1px |
| WebGL/3D só quando a marca É a experiência (peso mata Core Web Vitals no mobile) | Bass (movimento com significado) | ShaderGradient/Three só em projeto que justifica; nunca por padrão |
| Variable fonts + `clamp()` para tipo fluido | Vignelli (relações de corpo) | Escala tipográfica fluida no token, não por breakpoint |
| Tokens com contraste acessível embutido | Vignelli (responsabilidade) | Paleta já nasce AA; a restrição força cor mais corajosa |
| Motion como identidade (logo/tipo concebidos com movimento) | Bass (kinetic typography) | O elemento-assinatura pode ser cinético; um motivo, sempre o mesmo |

**Anti-padrões (o que os fundamentos proíbem):** decoração sem ideia (semântica zero); bento
com buracos ou sem narrativa no mobile; página que é 100% tendência sem estilo-base; 4+ famílias
tipográficas; efeito em todas as seções (se tudo grita, nada fala); trocar a base do design a
cada projeto do mesmo cliente (a marca precisa de associação repetida, Rand); símbolo que tenta
explicar o negócio inteiro.

---

## Checklist de decisão visual (passe antes de codar)

- [ ] Ideia declarada em uma frase; elemento-assinatura escolhido (um só)
- [ ] Pesquisa semântica feita (negócio, nome, história, mercado, concorrência local)
- [ ] Sistema definido: grid, escala de espaçamento 4/8, escala tipográfica com `clamp()`,
      tokens (1 cor de marca + neutros + 1 acento; AA embutido)
- [ ] 2 famílias (máx. 3) com racional; display com caráter (`fonts-system`/`FONTES.md`)
- [ ] Estilo-base duradouro nomeado; acentos de tendência listados como removíveis
- [ ] Hierarquia por dobra: caminho único do olho (1º, 2º, 3º)
- [ ] Herói passa os 5 segundos E condiciona como abertura de filme (Bass)
- [ ] Todo motion expressa uma ideia; pirotecnia cortada; um desvio "sério" por página
- [ ] Bento/grid sem buraco e com colapso mobile projetado
- [ ] Whitespace estrutural (espaços diferentes para relações diferentes)
- [ ] Símbolo/assinatura sobrevive a favicon 16px e preto-e-branco
- [ ] Passada de redução feita: algo saiu (se nada saiu, refaça)
- [ ] Sistema total: o critério do site vale para Maps/Insta/WhatsApp (proposta ao cliente)
- [ ] Teste de atemporalidade: sem os acentos, a base para em pé em 5 anos
