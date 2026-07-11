# Formatação

Regras de formatação destiladas de Código Limpo (Robert C. Martin). Aplique-as a todo arquivo que criar ou alterar.

## Formatação é comunicação

- Trate formatação como prioridade de profissional, não como detalhe estético. Código mal formatado compromete a percepção de qualidade de todo o projeto.
- Formate para legibilidade: ela afeta diretamente toda mudança futura no código.
- Lembre que o estilo e a disciplina de formatação sobrevivem ao código original — eles continuam moldando o sistema mesmo depois que as linhas iniciais foram reescritas.

## Arquivos pequenos

- Mantenha arquivos pequenos: mire em torno de 200 linhas; trate ~500 como teto prático.
- Nunca use "o sistema é grande" como desculpa para arquivos grandes — sistemas grandes se constroem com muitos arquivos pequenos, não com poucos arquivos gigantes.

## Metáfora do jornal

- Escreva cada arquivo como uma matéria de jornal: o nome do arquivo é a manchete — deve ser simples, explicativo e suficiente para o leitor decidir se está no lugar certo.
- Coloque no topo do arquivo os conceitos de mais alto nível, sem detalhes de implementação.
- Aumente o nível de detalhe conforme se desce no arquivo, terminando nas funções e minúcias de mais baixo nível.

## Espaçamento vertical entre conceitos

- Separe pensamentos distintos com linhas em branco: entre o bloco de imports e o código, entre cada função, entre grupos lógicos dentro de uma função.
- Nunca cole tudo sem linhas em branco — a ausência delas transforma o arquivo num bloco ilegível onde os conceitos se misturam.

## Continuidade vertical

- Mantenha linhas intimamente relacionadas verticalmente juntas, sem nada entre elas.
- Nunca quebre um bloco coeso com comentários inúteis — eles afastam linhas que pertencem ao mesmo pensamento.

```typescript
// Antes — comentário separa linhas que formam um único conceito
private tasks: Task[];
/** Filtro aplicado à lista. */
private filter: TaskFilter;

// Depois — bloco coeso, sem ruído
private tasks: Task[];
private filter: TaskFilter;
```

## Distância vertical

- Declare variáveis locais o mais perto possível do seu uso. Em funções curtas, isso significa o topo da função.
- Declare variáveis de controle de laço dentro do próprio `for` sempre que possível.
- Declare variáveis de instância no topo da classe, em um lugar único e conhecido — nunca espalhadas pelo meio do arquivo.
- Posicione a função chamadora ACIMA da função chamada, quando possível; funções dependentes devem ficar verticalmente próximas para a leitura fluir de cima para baixo.
- Agrupe funções com afinidade conceitual: sobrecargas e variações da mesma tarefa ficam lado a lado, mesmo quando uma não chama a outra.

```typescript
// Depois — chamadora acima, dependente logo abaixo, afinidade agrupada
function renderPage(page: Page): string {
  return wrapHtml(page.body);
}

function wrapHtml(body: string): string {
  return `<html><body>${body}</body></html>`;
}

function assertEquals(expected: string, actual: string): void { /* ... */ }
function assertEquals(expected: number, actual: number): void { /* ... */ }
```

## Ordenação vertical descendente

- Ordene o arquivo do nível de abstração mais alto para o mais baixo: políticas primeiro, detalhes depois.
- Garanta que o leitor consiga entender o propósito do arquivo lendo apenas as primeiras funções, sem mergulhar nos detalhes.

## Largura de linha

- Prefira linhas curtas; não force o leitor a varrer linhas longas.
- Aplique um limite duro de ~100–120 colunas. Quebre a linha antes de ultrapassá-lo.
- Jamais escreva código que exija rolagem horizontal para ser lido.

## Espaço horizontal: associar e dissociar

- Use espaço horizontal para mostrar o que está junto e o que está separado.
- Coloque espaços ao redor de atribuições (`x = y`) e dos operadores de menor precedência; omita-os nos de maior precedência para evidenciar a ordem: `b*b - 4*a*c`.
- Nunca coloque espaço entre o nome de uma função e seus parênteses — função e argumentos estão intimamente associados: `calculate(x)`, não `calculate (x)`.

## Não alinhe colunas

- Não alinhe verticalmente declarações, atribuições ou parâmetros em colunas. O alinhamento faz o olho ler a coluna errada (os valores) em vez do que importa (os nomes e tipos).
- Se uma lista de declarações é longa o bastante para "pedir" alinhamento, o problema é o tamanho da lista: divida a classe.

```java
// Antes — alinhamento enfatiza a coisa errada
private   Socket        socket;
private   InputStream   input;
protected long          requestProgress;

// Depois — simples, sem colunas artificiais
private Socket socket;
private InputStream input;
protected long requestProgress;
```

## Indentação sempre

- Indente sempre, refletindo a hierarquia de escopos — o leitor depende da indentação para entender a estrutura.
- Nunca colapse escopos em uma linha só, mesmo em `if`, `while` ou funções de uma linha: mantenha o corpo indentado em linha própria.
- Quando um `while` (ou `for`) tiver corpo vazio, torne o ponto e vírgula visível, indentado em linha própria — nunca escondido no fim da linha da condição.

## Regras de equipe

- A equipe escolhe UM estilo — posição de chaves, tamanho de indentação, nomenclatura — e todos seguem, sem exceção.
- Codifique as regras escolhidas no formatador da IDE/projeto (lint, formatter) e aplique-as automaticamente.
- Consistência do código do time vale mais que preferência pessoal: nunca imponha seu estilo individual contra o padrão acordado.
