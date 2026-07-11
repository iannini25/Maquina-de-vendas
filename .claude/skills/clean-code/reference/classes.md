# Classes

Regras destiladas do tema "Classes" de Código Limpo. Aplique-as ao criar ou refatorar qualquer classe.

## Organização padrão (de cima para baixo)

- Siga esta ordem dentro da classe: constantes públicas estáticas → variáveis estáticas privadas → variáveis de instância privadas → funções públicas.
- Coloque cada função privada utilitária imediatamente após a função pública que a chama (regra decrescente: a classe se lê como um artigo de jornal, do geral para o detalhe).
- Variável pública de instância: raramente existe bom motivo. Trate como exceção a justificar, não como opção normal.

## Encapsulamento

- Mantenha variáveis e funções utilitárias privadas por padrão.
- Afrouxe a visibilidade (para `protected` ou escopo de pacote) somente quando um teste no mesmo pacote precisar acessar o membro — e mesmo assim, só depois de esgotar alternativas. Quebrar encapsulamento é sempre o último recurso.

## Classes pequenas

- Classes devem ser pequenas; depois, devem ser menores ainda.
- A medida de tamanho é RESPONSABILIDADES, não linhas de código. Uma classe com 5 métodos pode ser grande demais se acumular responsabilidades demais.

## O nome denuncia a responsabilidade

- O nome da classe deve descrever sua responsabilidade. Se você não consegue dar um nome conciso, a classe é grande demais.
- Desconfie de nomes vagos ou genéricos como `Manager`, `Processor`, `Super...`: eles denunciam acúmulo de responsabilidades.
- Teste prático: descreva a classe em cerca de 25 palavras sem usar "se", "e", "ou", "mas". Se precisar dessas conjunções, há mais de uma responsabilidade — divida.

## SRP — Princípio da Responsabilidade Única

- Toda classe deve ter um, e apenas um, motivo para mudar. Identifique os motivos de mudança: cada um aponta para uma responsabilidade separada.
- Extraia responsabilidades secundárias para classes próprias; a classe extraída frequentemente vira um componente reutilizável.
- SRP é o princípio mais simples e o mais violado. "Fazer funcionar" e "deixar limpo" são trabalhos diferentes: nunca pare no primeiro.
- Prefira muitas gavetas pequenas e bem rotuladas (muitas classes pequenas) a poucas gavetas com tudo jogado dentro (poucas classes gigantes). A complexidade total é a mesma; a organização não.

```typescript
// Antes: controla a GUI E conhece a versão do produto
class SuperDashboard {
  getMajorVersion(): number { /* ... */ }
  getMinorVersion(): number { /* ... */ }
  getLastFocusedComponent(): Component { /* ... */ }
}

// Depois: Version extraída — reutilizável por outros módulos
class Version {
  getMajorVersion(): number { /* ... */ }
  getMinorVersion(): number { /* ... */ }
}
```

## Coesão

- Mantenha poucas variáveis de instância. Cada método deve manipular o máximo possível delas; quanto mais variáveis um método usa, mais coeso ele é com a classe.
- Quando extrair funções faz sobrar campos usados só por um subconjunto de métodos, há uma classe querendo nascer: extraia esses campos e métodos para uma nova classe.
- Dividir funções grandes em funções pequenas costuma revelar várias classes pequenas e coesas escondidas na original. Faça essa divisão renomeando e refatorando em passos pequenos, com a suíte de testes passando a cada passo.
- Nunca aumente o número de variáveis de instância apenas para "compartilhar estado" entre métodos que não se relacionam — isso é sinal de baixa coesão, não solução.

## Organize para a mudança (OCP)

- Estruture as classes para que recurso novo signifique código novo, não alteração de código existente (aberto para extensão, fechado para modificação).
- Se toda nova funcionalidade exige "abrir" e editar a mesma classe, ela viola SRP e OCP ao mesmo tempo. Quebre-a.
- Exemplo canônico: uma classe `Sql` monolítica com um método por instrução (select, insert, update...) deve virar uma hierarquia — uma subclasse por instrução — com as funções utilitárias compartilhadas movidas para classes privadas auxiliares. Para suportar uma nova instrução, cria-se uma subclasse nova; nada existente é tocado.

```typescript
// Antes: toda nova instrução exige editar esta classe
class Sql {
  createSelect(): string { /* ... */ }
  createInsert(fields: object): string { /* ... */ }
  // + novo método a cada novo caso...
}

// Depois: nova instrução = nova subclasse, zero edição no existente
abstract class Sql { abstract generate(): string; }
class SelectSql extends Sql { generate(): string { /* ... */ } }
class InsertSql extends Sql { generate(): string { /* ... */ } }
```

## Isole das mudanças (DIP)

- Dependa de abstrações (interfaces, classes abstratas), nunca de detalhes concretos. Detalhes concretos mudam; abstrações isolam o cliente dessas mudanças.
- Injete a dependência abstrata em vez de instanciar a implementação concreta dentro da classe.
- Benefícios diretos: a classe fica testável com um stub determinístico, o acoplamento cai ao mínimo, e cada parte ganha flexibilidade e potencial de reuso em outros contextos.

```typescript
// Antes: acoplado à bolsa concreta — impossível testar sem rede
class Portfolio {
  private exchange = new TokyoStockExchange();
}

// Depois: depende da abstração; teste usa um stub com preços fixos
interface StockExchange { currentPrice(symbol: string): number; }
class Portfolio {
  constructor(private exchange: StockExchange) {}
}
```

## Checklist rápido

- A classe segue a ordem padrão de membros e lê de cima para baixo como um jornal?
- Tudo que pode ser privado é privado?
- Consigo descrever a classe em ~25 palavras sem "se", "e", "ou", "mas"?
- Ela tem exatamente um motivo para mudar?
- Cada método usa boa parte das variáveis de instância? Há um grupo de campos pedindo uma classe própria?
- Um recurso novo entraria como código novo, sem editar o existente?
- As dependências voláteis estão atrás de uma abstração injetada?
