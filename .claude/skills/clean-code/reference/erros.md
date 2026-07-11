# Tratamento de Erro

Regras destiladas do tema "Tratamento de Erro" (Clean Code). Material de consulta prescritivo: aplique ao escrever, revisar ou refatorar qualquer código do projeto.

## Regra de ouro: erro não pode esconder a lógica

- O tratamento de erro é importante, mas é coisa à parte: se ele domina visualmente o módulo e você precisa "caçar" a lógica de negócio no meio de checagens, o código está errado.
- Mantenha o algoritmo principal limpo e legível; o tratamento de erro fica isolado em volta dele, nunca entrelaçado com ele.

## Use exceções, nunca códigos de erro de retorno

- Nunca retorne códigos/flags de erro: eles obrigam o chamador a verificar o resultado imediatamente após cada chamada, poluindo todo o fluxo.
- Lance exceções. Assim o algoritmo (caminho feliz) fica separado do tratamento da falha, e cada um pode ser lido e entendido isoladamente.

```typescript
// Antes
const status = device.shutdown();
if (status === DeviceStatus.ERROR) { logger.error("shutdown failed"); return; }
registry.remove(device);

// Depois
try {
  device.shutdown();
  registry.remove(device);
} catch (e) { logger.error("shutdown failed", e); }
```

## Escreva primeiro o try-catch-finally

- Ao escrever código que pode lançar exceção, comece pela estrutura `try-catch-finally`, antes do corpo. Ela define um escopo transacional: aconteça o que acontecer dentro do `try`, o `catch` deve deixar o programa em estado consistente.
- Escreva um teste que force a exceção primeiro, faça o handler passar, e só então adicione o restante do comportamento dentro do `try`. Isso preserva a natureza transacional do bloco.

## Prefira exceções NÃO verificadas (unchecked)

- Use exceções não verificadas como padrão. Não declare checked exceptions nas suas APIs.
- Checked exceptions violam o princípio Aberto-Fechado: uma mudança num método de nível baixo força uma cascata de `throws` em todas as assinaturas acima dele até quem trata — todos esses módulos precisam ser recompilados/alterados.
- Essa cascata também quebra encapsulamento: níveis altos passam a conhecer detalhes de falha de níveis baixos pelos quais não são responsáveis.
- O custo só se justifica em casos raros, como bibliotecas críticas onde o chamador é obrigado a se recuperar. Em aplicação comum, nunca.

## Forneça contexto com cada exceção

- Toda exceção lançada deve carregar uma mensagem informativa: qual operação falhou e qual o tipo da falha.
- Não confie no stack trace: ele mostra onde o código quebrou, mas não conta a intenção da operação que falhou. Inclua isso na mensagem (e em log, se houver logging).

## Defina classes de exceção pelas necessidades do CHAMADOR

- Classifique exceções pensando em como serão capturadas, não em sua origem ou tipo técnico. Se o chamador trata todas da mesma forma, defina UMA única classe de exceção — não crie hierarquias que ninguém diferencia.
- Empacote (wrapper) APIs de terceiros: crie uma classe sua em volta da API e traduza as exceções dela para uma exceção sua. Isso minimiza a dependência do fornecedor, facilita trocar de biblioteca, simplifica testes (mock do wrapper) e deixa você definir a API que prefere usar, em vez de aceitar a do vendor.

```typescript
// Antes: chamador conhece 3 exceções do vendor
try { port.open(); }
catch (e) { /* DeviceResponseError | ATM1212Error | GMXError... */ }

// Depois: wrapper traduz tudo para UMA exceção sua
class LocalPort {
  open(): void {
    try { this.innerPort.open(); }
    catch (e) { throw new PortDeviceFailure(e); }
  }
}
```

## Defina o fluxo normal: padrão SPECIAL CASE

- Quando o "erro" é na verdade um caso especial previsível do negócio, não use exceção para controlar fluxo: crie um objeto Special Case que encapsula esse caso e devolve o comportamento padrão.
- Exemplo clássico: se não há refeições lançadas, o objeto de despesas retorna o valor per diem — o `catch` desaparece da lógica de negócio e o código vira uma linha do caminho feliz.
- Faça a classe (ou fábrica) sempre devolver um objeto válido; o chamador nunca precisa saber que o caso especial existe.

## Não retorne null

- Nunca retorne `null`/`undefined`: cada verificação `if (x !== null)` esquecida no chamador é um NullPointerException esperando para explodir em produção.
- Em vez disso: lance uma exceção, ou retorne um objeto Special Case.
- Para coleções, retorne sempre a coleção vazia (`[]`, `Collections.emptyList()`), nunca `null` — o chamador itera direto, sem checagem.

```typescript
// Antes
const items = getItems(); // pode ser null
if (items !== null) { for (const i of items) total += i.price; }

// Depois
const items = getItems(); // sempre retorna lista (vazia se não houver)
for (const i of items) total += i.price;
```

## Não passe null

- Passar `null` como argumento é pior que retornar `null`: a falha explode dentro de um método que não tem como se defender de forma razoável.
- Asserts e checagens de argumento (`if (arg == null) throw ...`) apenas documentam o problema mais cedo — não o resolvem.
- A política do projeto é: proibido passar `null` por padrão em qualquer assinatura. Trate parâmetro nulo como erro de programação do chamador, não como caso a suportar.
