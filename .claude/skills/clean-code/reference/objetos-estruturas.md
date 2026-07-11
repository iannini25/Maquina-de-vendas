# Objetos e Estruturas de Dados

Regras destiladas do tema "Objetos e Estruturas de Dados" (Clean Code). Material de consulta prescritivo: aplique diretamente ao escrever ou revisar código.

## Abstração de dados

- Manter variáveis privadas e depois adicionar getters/setters automáticos para todas elas NÃO é encapsulamento — você continua expondo a implementação, só que com cerimônia extra.
- Exponha interfaces abstratas que manipulem a ESSÊNCIA dos dados, sem revelar como eles são armazenados internamente.
- Prefira operações que expressem intenção e política de acesso: um `Point` deve ler coordenadas independentemente, mas gravá-las como operação atômica (`setCartesian(x, y)`), sem revelar se internamente é cartesiano ou polar.
- Prefira termos abstratos a termos concretos: `vehicle.getPercentFuelRemaining()` é melhor que `vehicle.getGallonsOfGasoline()`, porque não amarra o chamador ao detalhe de implementação (tanque em galões).
- A pior opção é adicionar acessores levianamente: pense em qual abstração realmente serve aos consumidores antes de expor qualquer dado.

```typescript
// ANTES — expõe a representação interna
class Vehicle { getGallonsOfGasoline(): number { return this.gallons; } }

// DEPOIS — expõe a essência, esconde a representação
class Vehicle { getPercentFuelRemaining(): number { /* ... */ } }
```

## Anti-simetria dado/objeto

- Objetos escondem seus dados atrás de abstrações e expõem funções que operam sobre esses dados (comportamento).
- Estruturas de dados expõem seus dados e não possuem comportamento significativo.
- Código procedural (funções operando sobre estruturas de dados) facilita adicionar NOVAS FUNÇÕES sem alterar as estruturas existentes.
- Código orientado a objetos facilita adicionar NOVOS TIPOS sem alterar as funções existentes.
- Escolha pelo eixo de mudança esperado: se o sistema vai ganhar novos tipos, use objetos; se vai ganhar novas funções sobre tipos estáveis, use estruturas de dados e procedimentos.
- "Tudo é objeto" é mito. Às vezes a solução simples e correta é uma estrutura de dados com funções procedurais — saiba reconhecer quando.

## Lei de Demeter

- Um método `f` da classe `C` só deve chamar métodos de: `C` mesma; objetos criados por `f`; objetos passados como parâmetro a `f`; objetos guardados em variáveis de instância de `C`.
- NUNCA chame métodos de objetos retornados por qualquer dessas chamadas. Fale com amigos, não com estranhos.
- Se você precisa de algo que está "dentro" de um colaborador, peça ao colaborador para fazer o trabalho, em vez de extrair o objeto interno e operar nele.

## Carrinhos de trem (train wrecks)

- Cadeias como `a.getB().getC().doX()` são "carrinhos de trem": quebre-as em variáveis explicativas, uma chamada por linha.
- Se `a`, `b` e `c` são OBJETOS, a cadeia viola a Lei de Demeter — você está navegando pela estrutura interna deles.
- A cadeia é aceitável apenas quando os elos são estruturas de dados puras com campos públicos (aí não há estrutura interna sendo escondida para violar).

```typescript
// ANTES — train wreck sobre objetos (viola Demeter)
const dir = ctxt.getOptions().getScratchDir().getAbsolutePath();

// DEPOIS — uma chamada por linha, intenção explícita
const opts = ctxt.getOptions();
const scratchDir = opts.getScratchDir();
const dir = scratchDir.getAbsolutePath();
```

## Híbridos

- Híbrido = metade objeto, metade estrutura de dados: tem funções com comportamento E campos públicos (ou getters/setters que expõem tudo).
- Híbridos somam o pior dos dois mundos: dificultam adicionar novas funções E dificultam adicionar novas estruturas.
- Evite criar híbridos. Eles geralmente indicam que o autor não decidiu se queria um objeto ou uma estrutura de dados — decida.

## Esconder estrutura

- Não pergunte pelas entranhas de um objeto para depois operar nelas: isso obriga o chamador a conhecer a estrutura interna inteira.
- Mande o objeto FAZER a tarefa final. Se o objetivo era criar um arquivo temporário, peça isso diretamente em vez de navegar até o caminho absoluto.

```typescript
// ANTES — chamador conhece options, scratchDir e path
const path = ctxt.getOptions().getScratchDir().getAbsolutePath();
const stream = createStream(path + "/" + name);

// DEPOIS — o objeto faz; estrutura interna fica escondida
const stream = ctxt.createScratchFileStream(name);
```

## DTOs (Data Transfer Objects)

- DTO é a forma pura de estrutura de dados: classe só com dados públicos e nenhuma função.
- Use DTOs nas fronteiras do sistema: comunicação com banco de dados, sockets, parsing de mensagens, payloads de API.
- A variante "bean" (campos privados + getters/setters para tudo) não agrega encapsulamento real — é só um DTO com cerimônia. Não trate isso como orientação a objetos.
- Não adicione comportamento de negócio a um DTO; se precisar de comportamento, crie um objeto de verdade.

## Active Record

- Active Record é uma forma especial de DTO: estrutura de dados com métodos de navegação/persistência como `save` e `find`.
- NUNCA coloque regras de negócio dentro de um Active Record — isso cria um híbrido (estrutura de dados + comportamento).
- Trate o Active Record como estrutura de dados pura e crie objetos separados que contenham as regras de negócio e escondam seus próprios dados internos.
