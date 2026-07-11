# Funções

Regras destiladas do tema "Funções" (Código Limpo). Aplique-as a toda função que escrever, alterar ou revisar.

## Tamanho

- Escreva funções pequenas — e depois menores ainda. Raramente passe de ~20 linhas.
- Blocos dentro de `if`, `else` e `while` devem ter 1 linha: uma chamada de função com nome descritivo. Isso documenta o bloco e força a decomposição.
- Mantenha no máximo 1–2 níveis de indentação por função. Indentação profunda é sinal de que falta extrair funções.

## Faça uma coisa

- Cada função deve fazer UMA coisa, fazê-la bem e fazer somente ela.
- "Uma coisa" = todos os passos do corpo estão um nível de abstração abaixo do nome da função.
- Teste prático: se dá para extrair outra função do corpo com um nome que não seja mera reformulação do nome atual, a função fazia mais de uma coisa.
- Função dividida em "seções" (declarações, inicialização, processamento...) faz mais de uma coisa. Extraia cada seção.

## Um nível de abstração por função

- Nunca misture alto nível (regra de negócio) com baixo nível (concatenação de string, índice de array) na mesma função.
- Regra Decrescente: o arquivo deve ler de cima para baixo como uma narrativa — cada função seguida imediatamente pelas funções do nível de abstração logo abaixo dela.

## switch

- `switch` por natureza faz N coisas e tende a crescer a cada novo caso. Tolere-o apenas enterrado em uma ABSTRACT FACTORY, criando objetos polimórficos.
- Cada seleção por tipo deve ter UM único `switch` no sistema inteiro; nunca repita o mesmo `switch` em outros pontos — use polimorfismo.

## Nomes

- Use nomes descritivos. Um nome longo e claro vale mais que um nome curto e enigmático — e mais que um comentário explicando o que a função faz.
- Mantenha fraseologia consistente na família de funções do módulo: `includeSetupPages`, `includeTeardownPages`, `includeSuiteSetupPage` contam a mesma história.

## Parâmetros

- Ideal: 0 parâmetros. Aceitável: 1 e 2. Três exige justificativa forte. Mais de três: não use.
- Formas legítimas de mônade (1 parâmetro): pergunta sobre o argumento (`fileExists(name)`), transformação do argumento (abrir/converter e retornar algo) e evento (altera estado, não retorna nada).
- Flags booleanas são proibidas: passar `true/false` declara que a função faz duas coisas. Divida em duas funções (`render(true)` → `renderForSuite()` e `renderForSingleTest()`).
- Díades custam atenção do leitor (qual a ordem de `expected` e `actual`?). Reduza-as: torne a função método do objeto do primeiro argumento, transforme um parâmetro em campo da classe ou extraia uma nova classe.
- Grupos de parâmetros relacionados viram um objeto: `makeCircle(x, y, radius)` → `makeCircle(center: Point, radius: number)`.
- Lista variádica (`...args`) conta como UM parâmetro se os valores forem tratados de forma idêntica.

```typescript
// Antes: flag booleana — a função faz duas coisas
function render(isSuite: boolean) { /* ... */ }

// Depois: duas funções, cada uma faz uma coisa
function renderForSuite() { /* ... */ }
function renderForSingleTest() { /* ... */ }
```

## Sem efeitos colaterais

- Nunca prometa uma coisa no nome e faça outra escondida no corpo. Um `checkPassword` que também inicializa a sessão cria acoplamento temporal oculto (só pode ser chamado quando é seguro iniciar sessão).
- Se o efeito for inevitável, o nome deve declará-lo: `checkPasswordAndInitializeSession` — mas isso denuncia que a função faz mais de uma coisa; prefira separar.

## Sem parâmetros de saída

- Nunca use um parâmetro para devolver ou modificar estado de fora. Se a função precisa mudar algo, mude o estado do próprio objeto dono dela.

```typescript
// Antes: report é entrada ou saída? O leitor precisa abrir a função
appendFooter(report);

// Depois: intenção óbvia
report.appendFooter();
```

## Separação comando-consulta

- Ou a função FAZ algo (comando), ou RESPONDE algo (consulta) — nunca os dois.
- Um `set()` que retorna boolean força chamadas ambíguas como `if (set("username", "bob"))`. Divida em `attributeExists()` (consulta) + `setAttribute()` (comando).

## Erros

- Prefira exceções a códigos de erro: códigos forçam `if` aninhados no chamador, que precisa tratar o erro imediatamente.
- Não centralize códigos de erro em enum/classe única: ela vira um ímã de dependências — todo o sistema importa e recompila quando um código é adicionado. Novas exceções, ao contrário, são derivadas sem tocar nas existentes.
- Extraia os blocos `try/catch` para funções próprias: tratamento de erro É uma coisa. Na função que trata erro, `try` é a primeira palavra e nada vem depois do `catch`/`finally`.

```java
// Depois: a função de tratamento só trata; a lógica vive em outra função
public void delete(Page page) {
    try {
        deletePageAndAllReferences(page);
    } catch (Exception e) {
        logError(e);
    }
}
```

## DRY

- Nunca duplique lógica. A duplicação é a raiz de quase todo mal no software: multiplica pontos de alteração e oportunidades de erro. Extraia e reutilize.

## Estrutura

- "Um único return por função" só é regra útil em funções grandes. Em funções pequenas, `return`, `break` e `continue` ocasionais são aceitáveis e podem até clarear o código.
- `goto`: nunca. Só faz sentido em funções grandes — que você não deve escrever.

## Como escrever funções

- Ninguém escreve função limpa de primeira. Comece com um rascunho longo, indentado e feio — mas coberto por testes.
- Em seguida refine: divida em funções menores, renomeie, elimine duplicação, reordene — mantendo os testes passando.
- Nunca entregue o rascunho: a versão final deve seguir todas as regras acima.
