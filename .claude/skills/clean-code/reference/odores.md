# Odores e Heurísticas — Checklist Completo

Checklist prescritivo de code review. Cada item tem um código único (C, E, F, G, J, N, T). Use os códigos ao reportar violações.

## Comentários (C)

- **C1 — Informação inapropriada.** Nunca coloque metadados em comentários: changelog, autores, datas, números de ticket pertencem ao controle de versão, não ao código.
- **C2 — Comentário obsoleto.** Comentário que não reflete mais o código mente para o leitor. Atualize-o ou delete-o no momento em que o código mudar.
- **C3 — Comentário redundante.** Não escreva comentário que apenas repete o que o código já diz (`i++; // incrementa i`). Se o código é claro, o comentário sobra.
- **C4 — Comentário mal escrito.** Se vale a pena comentar, capriche: gramática correta, frases curtas, sem divagação. Comentário ruim é pior que nenhum.
- **C5 — Código comentado.** Delete sempre. Código morto em comentário apodrece e ninguém ousa removê-lo depois; o histórico do git guarda tudo.

## Ambiente (E)

- **E1 — Build com mais de um passo.** O build completo deve sair de um único comando. Nunca exija sequências manuais de scripts, checkouts parciais ou configurações à mão.
- **E2 — Testes com mais de um passo.** Todos os testes devem rodar com um único comando (ou um botão na IDE). Se rodar testes dá trabalho, eles deixam de ser rodados.

## Funções (F)

- **F1 — Parâmetros em excesso.** Prefira zero parâmetros; depois um, dois e no máximo três. Mais que três, nunca — agrupe em um objeto ou repense o design.
- **F2 — Parâmetros de saída.** Nunca use parâmetro para devolver resultado mutando o argumento. Se a função muda estado, que mude o estado do próprio objeto.
- **F3 — Parâmetros-flag booleanos.** Um boolean na assinatura grita que a função faz duas coisas. Divida em duas funções com nomes claros.
- **F4 — Função morta.** Função nunca chamada deve ser deletada, não mantida "por via das dúvidas".

## Geral (G)

- **G1 — Múltiplas linguagens num arquivo.** Minimize a mistura de linguagens (HTML, SQL, JS embutidos). Um arquivo, idealmente uma linguagem.
- **G2 — Comportamento óbvio não implementado.** Siga o princípio da menor surpresa: a função deve fazer tudo que seu nome leva o leitor a esperar.
- **G3 — Comportamento incorreto nos limites.** Teste TODA condição de limite (vazio, zero, um, máximo, off-by-one). Nunca confie na intuição — prove com testes.
- **G4 — Seguranças anuladas.** Nunca desligue warnings do compilador, ignore testes falhando ou silencie linters para "passar". Cada segurança anulada é um risco assumido às cegas.
- **G5 — Duplicação.** DRY: toda duplicação é oportunidade perdida de abstração. Extraia função; para variações de algoritmo, use polimorfismo, Template Method ou Strategy.
- **G6 — Código no nível errado de abstração.** Detalhes de implementação não pertencem à classe base nem à interface geral. Conceitos de baixo nível ficam nas derivadas.
- **G7 — Classe base depende das derivadas.** A base nunca deve conhecer suas filhas. Se conhece, a hierarquia está invertida.
- **G8 — Informação excessiva.** Interfaces enxutas: exponha o mínimo, esconda tudo que puder. Classes com dezenas de métodos públicos acoplam o mundo a si.
- **G9 — Código morto.** Código inalcançável (branches impossíveis, catches que nunca disparam) deve ser deletado — dê-lhe um funeral digno.
- **G10 — Separação vertical.** Declare variáveis e funções privadas perto do primeiro uso, não a centenas de linhas de distância.
- **G11 — Inconsistência.** Faça coisas similares sempre da mesma maneira. Se chamou de `response` num lugar, não chame de `resp` no outro.
- **G12 — Entulho.** Remova construtores vazios, variáveis sem uso, imports inúteis. Tudo que não agrega só polui.
- **G13 — Acoplamento artificial.** Declare cada coisa no lugar a que ela pertence conceitualmente, não no lugar que era conveniente na hora (ex.: enum genérico dentro de classe específica).
- **G14 — Feature envy.** Método que manipula mais os dados de outra classe do que os da própria deve se mudar para lá — exceto quando mover significaria expor internals.
- **G15 — Parâmetros seletores.** Um `false` pendurado na chamada não diz nada. Divida em funções separadas em vez de selecionar comportamento por argumento (booleano, enum ou int).
- **G16 — Propósito obscuro.** Proíba expressões compactadas, notação húngara e números mágicos. O código deve ser expressivo à primeira leitura.
- **G17 — Responsabilidade mal posicionada.** Coloque o código onde o leitor naturalmente esperaria encontrá-lo; o nome da função/classe deve guiar a decisão, não sua conveniência.
- **G18 — Estático inadequado.** Prefira métodos de instância. Só torne estático o que nunca, em hipótese alguma, precisará de comportamento polimórfico.
- **G19 — Use variáveis explicativas.** Quebre cálculos complexos em passos intermediários com nomes que revelam a intenção de cada parte.
- **G20 — Nomes de função dizem o que ela faz.** Se é preciso ler o corpo para entender a chamada, renomeie. `date.add(5)` é ambíguo; `date.addDaysTo(5)` ou `date.daysLater(5)` não.
- **G21 — Entenda o algoritmo.** Nunca pare no "passa nos testes" obtido por tentativa e erro. Saiba POR QUE a solução funciona antes de considerá-la pronta.
- **G22 — Torne dependências lógicas em físicas.** Módulo que depende de outro deve perguntar explicitamente (ex.: chamar `getMaxPageSize()`), nunca assumir silenciosamente uma constante alheia.
- **G23 — Prefira polimorfismo a if/else e switch/case.** Regra "um switch": no máximo um switch por tipo, criando objetos polimórficos; o resto do sistema despacha por polimorfismo.
- **G24 — Siga convenções padrão.** Adote a convenção da equipe (formatação, nomes, estrutura) mesmo quando discordar; consistência coletiva vale mais que preferência individual.
- **G25 — Substitua números mágicos por constantes nomeadas.** Exceção: valores autoexplicativos em fórmulas consagradas (ex.: `2 * Math.PI * r`).
- **G26 — Seja preciso.** Nunca use float para dinheiro; trate todo retorno que possa ser null; use locks onde há concorrência; declare pelo tipo abstrato (`List`, não `ArrayList`). Ambiguidade no código é preguiça.
- **G27 — Estrutura acima de convenção.** Imponha decisões com estrutura: classe base com métodos abstratos FORÇA as derivadas a cumprir; switch bem nomeado apenas sugere.
- **G28 — Encapsule condicionais.** Extraia a expressão booleana para função nomeada: `if (shouldBeDeleted(timer))` em vez da condição crua.
- **G29 — Evite condicionais negativas.** `if (buffer.shouldCompact())` lê melhor que `if (!buffer.shouldNotCompact())`. Prefira a forma positiva.
- **G30 — Funções fazem uma coisa só.** Função com seções, loops e múltiplas decisões deve ser quebrada em funções menores, cada uma com um único propósito.
- **G31 — Acoplamentos temporais ocultos.** Quando a ordem de chamada importa, torne-a impossível de violar: encadeie passando o resultado de um passo como argumento do próximo (bucket brigade).
- **G32 — Não seja arbitrário.** Estruture o código com razão consistente e comunicável; estrutura justificada é respeitada e seguida pelos próximos, arbitrária é desfeita.
- **G33 — Encapsule condições de limite.** Centralize cada `+1`/`-1` de fronteira num só lugar: `const nextLevel = level + 1` e use `nextLevel` em todo lugar.
- **G34 — Funções descem só um nível de abstração.** Tudo dentro de uma função deve estar exatamente um nível abaixo do nome dela; não misture política de alto nível com detalhe de sintaxe.
- **G35 — Dados configuráveis em níveis altos.** Constantes e defaults de configuração vivem no topo da aplicação e são passados para baixo — nunca enterrados em função de baixo nível.
- **G36 — Evite navegação transitiva.** Nunca escreva `a.getB().getC().fazAlgo()` (Lei de Demeter). Cada módulo fala apenas com seus colaboradores imediatos.

```typescript
// G19 + G28 — antes
if (user.age >= 18 && user.country === "BR" && !user.blocked) process(order);
// depois
const isEligibleBuyer = user.age >= 18 && user.country === "BR" && !user.blocked;
if (isEligibleBuyer) process(order);
```

```typescript
// G31 — antes: ordem exigida fica oculta
gradient.calculate(); splines.generate();
// depois: a ordem é imposta pelos tipos (bucket brigade)
const gradient = calculateGradient();
const splines = generateSplines(gradient);
```

## Java (J)

- **J1 — Evite listas longas de import.** Ao usar duas ou mais classes do mesmo pacote, importe com wildcard (`import package.*`) em vez de listar uma a uma.
- **J2 — Não herde constantes de interfaces.** Implementar interface só para enxergar constantes esconde a origem delas. Use `import static`.
- **J3 — Prefira enums a constantes int.** Enums têm nome forte, métodos e campos; `public static final int` não tem tipo nem comportamento.

```java
// J3 — antes
public static final int HOURLY = 0, SALARIED = 1;
// depois
public enum PayType { HOURLY, SALARIED;
  public boolean isOvertimeEligible() { return this == HOURLY; }
}
```

## Nomes (N)

- **N1 — Escolha nomes descritivos.** Nomes carregam 90% da legibilidade. Reserve tempo para nomear e renomeie assim que entender melhor o conceito.
- **N2 — Nomes no nível de abstração certo.** Nomeie pelo conceito, não pela implementação: numa abstração geral, `connect(connectionLocator)`, nunca `dial(phoneNumber)`.
- **N3 — Use nomenclatura padrão quando existir.** Inclua o padrão de projeto no nome (`Decorator`, `Visitor`), siga convenções da linguagem (`toString`) e a linguagem ubíqua do projeto.
- **N4 — Nomes não ambíguos.** Se o nome admite duas interpretações, troque-o, mesmo que fique mais longo. Clareza vence brevidade.
- **N5 — Nomes longos para escopos longos.** Escopo de cinco linhas aceita `i`; variável visível em todo o módulo exige nome completo e descritivo.
- **N6 — Evite codificações.** Nada de `m_`, notação húngara ou prefixo do sistema no nome. Codificação é ruído que as ferramentas modernas tornaram inútil.
- **N7 — Nomes descrevem efeitos colaterais.** Se a função faz mais que retornar, o nome deve dizer: `createOrReturnOos`, não `getOos` que cria por baixo dos panos.

## Testes (T)

- **T1 — Testes insuficientes.** Teste tudo que pode quebrar. A suíte só está completa quando cobre toda condição que pode falhar, não quando "parece suficiente".
- **T2 — Use ferramenta de cobertura.** Cobertura mostra visualmente os buracos da suíte. Rode-a regularmente e investigue todo trecho não exercitado.
- **T3 — Não pule testes triviais.** São rápidos de escrever e seu valor documental supera o custo: mostram como a unidade se comporta nos casos simples.
- **T4 — Teste ignorado é uma pergunta.** Um `skip`/`@Ignore` sinaliza ambiguidade de requisito. Resolva a dúvida com quem define o requisito, não deixe o teste apodrecer.
- **T5 — Teste condições de limite.** Acertamos o meio e erramos as bordas: teste vazio, zero, um, máximo, limites inclusivos/exclusivos sempre.
- **T6 — Teste exaustivamente perto de bugs.** Bugs se aglomeram. Ao encontrar um, varra a vizinhança com testes adicionais — provavelmente há outros.
- **T7 — Padrões de falha são reveladores.** Organize os casos de teste de forma completa e ordenada; o padrão dos que falham frequentemente aponta a causa do defeito.
- **T8 — Padrões de cobertura são reveladores.** Olhe o que os testes que falham executam (e o que os que passam não executam) para localizar o código defeituoso.
- **T9 — Testes devem ser rápidos.** Teste lento é teste que ninguém roda. Faça o necessário para manter a suíte veloz, especialmente sob pressão de prazo.

## Como usar em review

Em todo code review, percorra esta lista categoria por categoria (C, E, F, G, J, N, T) e reporte cada violação encontrada no formato: **código do item + trecho de código violador + correção proposta**.
