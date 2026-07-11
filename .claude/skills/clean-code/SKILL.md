---
name: clean-code
description: Fonte oficial de qualidade de código do projeto, baseada nos princípios do livro Código Limpo (Clean Code, Robert C. Martin). Use SEMPRE que for escrever, alterar, revisar ou refatorar qualquer código — nomes, funções, classes, comentários, formatação, tratamento de erro, integração com bibliotecas de terceiros, testes, concorrência. Dispare em qualquer menção a "código limpo", "clean code", "refatorar", "code review", "boas práticas", "legibilidade", "code smell", "qualidade de código", e SEMPRE antes de finalizar um módulo novo. O código deste projeto deve nascer sólido, legível, testado e pronto para escalar — não "funcionar primeiro e limpar um dia".
---

# Código Limpo — Padrão de construção de código do projeto

Destilação dos princípios do livro **Código Limpo** (Clean Code, Robert C. Martin), em
formato prescritivo. É a régua de TODO código produzido no projeto: escrever, revisar e
refatorar. A única forma de ir rápido é manter o código limpo o tempo todo — "depois"
é igual a nunca (Lei de LeBlanc).

## Regras inegociáveis

1. **Regra do Escoteiro** — deixe cada arquivo tocado mais limpo do que o encontrou.
2. **Projeto Simples (Kent Beck), nesta ordem de prioridade:** (1) passa em todos os
   testes; (2) zero duplicação; (3) expressa a intenção do autor; (4) minimiza a
   quantidade de classes e métodos.
3. **Funções pequenas que fazem UMA coisa**, em um único nível de abstração:
   ≤ ~20 linhas, 0–2 parâmetros, nunca flag booleana, sem efeito colateral escondido,
   comando OU consulta (nunca ambos).
4. **Nomes revelam intenção.** Se o nome precisa de comentário, o nome está errado.
   Tamanho do nome proporcional ao escopo. Classes = substantivos; métodos = verbos.
5. **Comentário é fracasso de expressão** — antes de escrever um, tente expressar no
   código. Código comentado se DELETA (o controle de versão lembra).
6. **Exceções, nunca códigos de erro. Nunca retorne nem passe `null`** — use Special
   Case / coleção vazia.
7. **TDD e testes limpos:** as 3 leis, F.I.R.S.T., um conceito por teste. Teste sujo é
   pior do que teste nenhum.
8. **Classes pequenas e coesas**, medidas em responsabilidades, não em linhas:
   SRP — um único motivo para mudar.
9. **Encapsule limites:** APIs de terceiros atrás de wrappers/adapters seus; respeite a
   Lei de Demeter (fale com amigos, não com estranhos).
10. Antes de declarar pronto, **varra `reference/odores.md`**: cada heurística violada
    exige justificativa explícita — silêncio não é justificativa.

## Onde está cada coisa

| Tema | Arquivo |
|---|---|
| Nomes significativos | `reference/nomes.md` |
| Funções | `reference/funcoes.md` |
| Comentários (bons × ruins) | `reference/comentarios.md` |
| Formatação vertical e horizontal | `reference/formatacao.md` |
| Objetos × estruturas de dados, Lei de Demeter | `reference/objetos-estruturas.md` |
| Tratamento de erro, Special Case, null | `reference/erros.md` |
| Limites com código de terceiros | `reference/limites.md` |
| Testes de unidade, TDD, F.I.R.S.T. | `reference/testes.md` |
| Classes, SRP, coesão, OCP/DIP | `reference/classes.md` |
| Sistemas, DI e projeto simples emergente | `reference/sistemas.md` |
| Concorrência | `reference/concorrencia.md` |
| **Checklist completo de odores e heurísticas** | `reference/odores.md` |

## Fluxo de trabalho

- **Código novo:** rascunho que funciona (com testes cobrindo cada linha) → refatore
  IMEDIATAMENTE em passos pequenos, com os testes passando após cada passo (refinamento
  sucessivo). Ninguém escreve limpo de primeira; o erro é parar no rascunho.
- **Code review / refatoração:** percorra `reference/odores.md` como checklist
  sistemático; ao encontrar duplicação, parâmetro-flag, switch repetido ou classe
  "Manager", consulte o reference do tema antes de propor a correção.
- **Bug:** ao corrigir, teste exaustivamente ao redor (bugs se aglomeram) e deixe a
  vizinhança mais limpa do que encontrou.
