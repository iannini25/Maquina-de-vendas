# Nomes Significativos

Regras de nomenclatura destiladas de *Código Limpo* (Robert C. Martin). Aplique em todo código novo e em toda refatoração.

## Revele o propósito

- O nome deve responder sozinho: por que existe, o que faz e como usar. Se você precisa de um comentário para explicar a variável, o nome falhou.
- Nunca use nomes opacos como `int d`. Prefira `elapsedTimeInDays`, `daysSinceCreation`, `fileAgeInDays`.
- Elimine números mágicos e estruturas anônimas dando nome a cada conceito: extraia constantes, depois classes com métodos que expressam a intenção.

```typescript
// Antes
function getThem(theList: number[][]): number[][] {
  return theList.filter((x) => x[0] === 4);
}
// Depois
function getFlaggedCells(gameBoard: Cell[]): Cell[] {
  return gameBoard.filter((cell) => cell.isFlagged());
}
```

## Evite desinformação

- Não use abreviações que já têm outro significado consagrado (`hp`, `aix`, `sco`).
- Só inclua o tipo no nome se for verdade: `accountList` apenas se for de fato uma `List`. Prefira `accounts` ou `accountGroup` — o nome não mente se a estrutura mudar.
- Evite nomes longos quase idênticos entre si (`XYZControllerForEfficientHandlingOfStrings` vs `XYZControllerForEfficientStorageOfStrings`): forçam comparação caractere a caractere.
- Nunca use `l` minúsculo ou `O` maiúsculo como nome de variável — confundem-se com `1` e `0`.

## Faça distinções significativas

- Nunca diferencie nomes só para o compilador aceitar: nada de `a1, a2, ..., aN` nem de mudar grafia (`klass` porque `class` é reservada).
- Palavras-ruído não distinguem nada: `Info`, `Data`, `Object`, prefixo `the`, sufixo `String`. `ProductInfo` e `ProductData` são indistinguíveis — escolha um conceito e nomeie-o.
- Em parâmetros, diga o papel de cada um: `copyChars(a1, a2)` deve ser `copyChars(source, destination)`.
- Se dois nomes são diferentes, o leitor deve conseguir saber qual usar sem abrir o código.

## Use nomes pronunciáveis

- Código é discutido em voz alta. Nomes impronunciáveis como `genymdhms` travam a conversa — use `generationTimestamp`.
- Se você não consegue falar o nome numa reunião, renomeie.

## Use nomes buscáveis

- Números soltos e nomes de uma letra são impossíveis de buscar: `5` aparece em todo lugar; `WORK_DAYS_PER_WEEK` aparece só onde importa. Sempre nomeie constantes.
- Nome de uma letra só é aceitável como variável local de método muito curto.
- Regra geral: o tamanho do nome deve ser proporcional ao tamanho do escopo. Escopo grande exige nome longo e buscável; escopo de três linhas tolera nome curto.

## Evite codificações

- Não embuta tipo ou escopo no nome. Notação húngara (`strName`, `iCount`) e prefixos de membro (`m_descricao`) são obsoletos — IDEs e tipagem já dão essa informação.
- Não prefixe interfaces com `I`. Deixe a interface limpa (`ShapeFactory`) e codifique a implementação se necessário (`ShapeFactoryImp`).

## Evite mapeamento mental

- O leitor não deve traduzir mentalmente um nome para outro conceito. Se `r` "significa" a URL sem o host, chame de `urlWithoutHost`.
- `i`, `j`, `k` só em loops minúsculos por tradição — e nunca `l`.
- Clareza vale mais que esperteza: escreva para quem lê, não para mostrar que você entende seu próprio truque.

## Nomes de classes

- Classes e objetos recebem substantivos ou frases nominais: `Customer`, `Account`, `WikiPage`, `AddressParser`.
- Evite palavras vagas como `Manager`, `Processor`, `Data`, `Info` no nome da classe.
- Nome de classe nunca é verbo.

## Nomes de métodos

- Métodos recebem verbos ou frases verbais: `postPayment`, `deletePage`, `save`.
- Acessores, mutadores e predicados seguem a convenção `get`/`set`/`is`.
- Quando construtores são sobrecarregados, prefira factory methods estáticos com nome descritivo e torne o construtor privado.

```java
// Antes
Complex point = new Complex(23.0);
// Depois
Complex point = Complex.fromRealNumber(23.0);
```

## Sem gracinhas

- Nada de piadas, gírias, referências culturais ou coloquialismos como nome (`holyHandGrenade`, `whack()`, `eatMyShorts()`).
- Diga o que quer dizer: `deleteItems`, `kill()`, `abort()`.

## Uma palavra por conceito

- Escolha uma palavra para cada conceito abstrato e use-a no código inteiro. Não misture `fetch`, `retrieve` e `get` para a mesma operação em classes diferentes.
- O mesmo vale para sufixos de classe: não conviva com `Controller`, `Manager` e `Driver` significando a mesma coisa — escolha um.

## Sem trocadilhos

- Não use a mesma palavra para semânticas diferentes. Se `add` significa somar/concatenar em um lugar, não use `add` para inserir em coleção em outro — use `insert` ou `append`.
- Consistência de vocabulário é com o significado, não só com a grafia.

## Domínio da solução e do problema

- Prefira termos técnicos que outro programador conhece — ciência da computação, padrões de projeto, algoritmos: `JobQueue`, `AccountVisitor`, `bubbleSort`.
- Quando não houver termo técnico adequado, use o vocabulário do domínio do problema (negócio); o especialista do domínio poderá explicar.

## Adicione contexto significativo

- Poucos nomes são claros sozinhos. Dê contexto agrupando-os em classes, funções ou namespaces — `firstName` dentro de uma classe `Address` — em vez de prefixar tudo (`addrFirstName`, só em último caso).
- Variáveis soltas que só fazem sentido juntas pedem uma classe: `number`, `verb`, `pluralModifier` espalhadas numa função viram campos de `GuessStatisticsMessage`, e a função gigante vira métodos pequenos e claros.

```typescript
// Antes: três variáveis soltas sem contexto numa função longa
let number: string, verb: string, pluralModifier: string;
// Depois: contexto explícito
class GuessStatisticsMessage {
  private number!: string;
  private verb!: string;
  private pluralModifier!: string;
}
```

## Não adicione contexto desnecessário

- Não prefixe tudo com o nome da aplicação ou do módulo (`GSDAccountAddress`): polui a busca e o autocomplete sem informar nada.
- Nomes curtos e claros vencem nomes longos e redundantes — desde que o curto continue inequívoco.
- Use o contexto certo no lugar certo: `accountAddress` é bom nome para uma instância; a classe se chama apenas `Address`. Se precisar distinguir tipos, seja específico (`PostalAddress`, `MacAddress`, `Uri`).
