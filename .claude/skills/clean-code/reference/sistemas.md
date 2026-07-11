# Sistemas e Emergência

Regras para montar sistemas que crescem sem apodrecer e para deixar um bom design emergir do código.

## Separe a construção do uso

- Construir objetos e usá-los são responsabilidades diferentes. Nunca misture as duas na mesma classe.
- Concentre toda a criação e conexão de objetos no `main` ou em módulos chamados por ele. O resto da aplicação apenas recebe objetos prontos e os usa.
- As setas de dependência devem apontar PARA LONGE do `main`: a aplicação não sabe como nada foi construído, nem que o `main` existe.
- Nunca espalhe inicialização preguiçosa (`new` dentro de getter) pelo código. Ela hardcoda a dependência concreta, mistura lógica de construção com lógica de negócio, impede substituir por mock no teste e fragmenta a estratégia global de construção em mil pontos isolados.

```typescript
// ANTES — lazy init acopla e esconde a dependência
getService(): Service {
  if (!this.service) this.service = new HeavyServiceImpl(42);
  return this.service;
}

// DEPOIS — construção feita fora; a classe só usa
constructor(private readonly service: Service) {}
```

## Use Factories quando o momento da criação pertence à aplicação

- Se a aplicação precisa controlar QUANDO um objeto é criado (ex.: um item por linha de pedido), mas os detalhes de COMO criar devem ficar fora dela, use uma Abstract Factory.
- A aplicação depende só da interface da factory; a implementação concreta vive do lado do `main` e é injetada.
- Nunca deixe a aplicação chamar `new` em classes concretas de outro módulo só porque precisa criar sob demanda — passe uma factory.

## Injeção de Dependência / Inversão de Controle

- A classe deve ser passiva: ela declara o que precisa (via construtor ou setter) e nunca resolve as próprias dependências.
- Quem resolve e conecta é o `main` ou um container de DI, idealmente por configuração declarativa.
- DI é o SRP aplicado ao gerenciamento de dependências: a responsabilidade de "obter dependências" sai da classe e vai para um mecanismo dedicado.
- Prefira injeção por construtor; ela torna as dependências explícitas e o objeto sempre válido após construído.

## Escale gradualmente

- "Fazer o sistema certo de primeira" é mito. Implemente os requisitos de HOJE; refatore e expanda amanhã, quando os requisitos de amanhã existirem.
- A arquitetura pode crescer incrementalmente DESDE QUE as preocupações estejam separadas. Sem separação, mudar arquitetura vira reescrita.
- Não faça BDUF (big design up front): além de inútil, é prejudicial — cria apego psicológico a decisões tomadas com pouca informação e resistência a melhorá-las.
- Mantenha o sistema simples e desacoplado o suficiente para que decisões arquiteturais possam ser revistas a qualquer momento.

## Preocupações transversais

- Mantenha a lógica de domínio em POJOs/objetos puros, sem nenhum conhecimento de persistência, transação, segurança, logging ou container.
- Incorpore preocupações transversais por mecanismos declarativos e não invasivos (aspectos, proxies, decorators, configuração) — nunca entrelaçadas no código de domínio.
- Nunca acople a lógica de negócio à infraestrutura (estilo EJB2: herdar do container, implementar interfaces de framework no domínio). Isso impede teste isolado, reuso e evolução.
- Teste o domínio sem subir banco, servidor ou framework. Se isso não for possível, a arquitetura está invasiva — corrija.

## Teste a arquitetura

- Com o domínio em POJOs desacoplados, você pode começar com arquitetura simples e evoluir para a sofisticada quando (e se) for necessário.
- Prove decisões arquiteturais com código executável, não com slides: implemente o caminho mais simples, meça, e só então adote o mecanismo mais pesado.

## Adie decisões até o último momento responsável

- Não decida cedo o que pode ser decidido tarde. Decisão prematura é decisão com informação subótima — sem feedback de cliente, de projeto e de implementação.
- Use modularidade e separação de preocupações exatamente para PODER decidir tarde: a escolha de banco, framework ou protocolo deve ser um detalhe substituível, não a fundação.

## Padrões e standards com valor demonstrável

- Use padrões de projeto e standards da indústria quando agregarem valor real e demonstrável ao SEU problema — nunca por hype, currículo ou "porque é o padrão".
- Standards facilitam contratação, comunicação e reuso; mas um standard pesado aplicado a um problema que não o exige destrói simplicidade. Avalie caso a caso.

## DSL e linguagem do domínio

- Escreva o código na linguagem do domínio: a distância entre o conceito do especialista e o código que o implementa deve ser mínima.
- Use DSLs (internas ou externas) e APIs fluentes quando elas permitirem expressar políticas de negócio como o especialista as descreveria.
- Todos os níveis de abstração devem ser expressos como POJOs claros: intenção de negócio em cima, detalhe técnico embaixo, nunca misturados.

## Emergência — as 4 regras do Projeto Simples (em ordem de prioridade)

Um design é simples quando segue estas regras, da mais importante para a menos importante:

### 1. Efetua todos os testes

- O sistema deve ser verificável: testável de ponta a ponta, com todos os testes passando o tempo todo.
- Tornar o código testável EMPURRA o design para o lugar certo: classes pequenas com propósito único (SRP), dependência de abstrações (DIP) e baixo acoplamento. Escreva testes primeiro e deixe essa pressão agir.
- Código sem testes não está pronto, por mais "limpo" que pareça.

### 2. Sem duplicação

- Elimine duplicação até o mínimo: linhas iguais, implementações paralelas e duplicação de intenção ("isso já foi resolvido em outro lugar").
- Extraia métodos pequenos agressivamente — extrações mínimas frequentemente revelam reuso e violações de SRP que estavam escondidas.
- Para duplicação de alto nível (mesmo esqueleto de algoritmo, passos diferentes), use Template Method: o fluxo comum fica na base, os passos variáveis em métodos abstratos.

```typescript
abstract class Vacation {
  accrue(): void {           // fluxo comum, escrito uma vez
    this.calculateBase();
    this.applyLegalMinimum(); // passo que varia por país
  }
  protected abstract applyLegalMinimum(): void;
}
```

### 3. Expressa a intenção do autor

- Escreva para o próximo leitor — que provavelmente será você. O custo dominante do software é manutenção, e manutenção exige entendimento.
- Expresse intenção com: bons nomes, funções e classes pequenas, padrões de projeto citados pelo nome (ex.: `OrderFactory`, `RetryDecorator`) e testes que documentam o uso por exemplo.
- Capriche. A diferença entre código que expressa e código que confunde é, na maior parte, tentar mais um pouco antes de seguir adiante. Não abandone o código assim que "funciona".

### 4. Minimiza classes e métodos

- Depois de cumprir as três regras acima, mantenha baixa a contagem total de classes e métodos. Pulverizar tudo em micro-unidades também é um excesso.
- Combata regras dogmáticas que inflam o sistema (ex.: "toda classe precisa de interface", "campos sempre separados da classe de comportamento") quando não há benefício real.
- Esta é a regra de MENOR prioridade das quatro: nunca sacrifique testes, eliminação de duplicação ou expressividade para reduzir contagem.

## Refatoração contínua faz parte de "Pronto"

- A cada incremento de código, pare e avalie o design antes de seguir: o que você acabou de escrever degradou alguma das 4 regras?
- Refatore imediatamente, com a suíte de testes garantindo que nada quebrou. Não acumule "limpeza para depois" — depois nunca chega.
- "Funciona" não é "pronto". Pronto = funciona + testado + sem duplicação + expressivo + enxuto.
