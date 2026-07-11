# Testes de Unidade

Regras destiladas do tema "Testes de Unidade" de Código Limpo. Aplique-as a todo código de teste do projeto.

## As 3 Leis do TDD

- **1ª Lei:** não escreva nenhum código de produção antes de ter um teste de unidade que falha.
- **2ª Lei:** não escreva mais teste do que o suficiente para falhar — código que não compila já conta como falha. Pare aí e vá para a produção.
- **3ª Lei:** não escreva mais código de produção do que o suficiente para fazer passar o teste que está falhando agora.
- O ciclo teste → produção → teste dura segundos, não horas. Dezenas de iterações por dia.
- Consequência direta: seguindo as 3 leis, os testes cobrem praticamente todo o código de produção. Essa cobertura é o objetivo — não a abandone.

## Testes são código de primeira classe

- Trate o código de teste com o MESMO cuidado do código de produção: nomes bons, funções pequenas, sem duplicação, refatorado continuamente.
- Nunca escreva testes "rápidos e porcos". Testes sujos são piores que nenhum teste:
  - O código de produção evolui; testes sujos degradam junto e ficam cada vez mais caros de manter.
  - A equipe passa a vê-los como passivo, abandona a suíte e perde a rede de segurança.
  - Sem rede de segurança, todos temem mudar o código — e o código apodrece.
- Se você não tem tempo para escrever o teste direito, não tem tempo para escrever o código.

## Testes habilitam as -idades

- Flexibilidade, manutenibilidade e reutilização nascem da cobertura de testes — não de arquitetura no papel.
- Com testes confiáveis, mudar deixa de dar medo: qualquer refatoração ou melhoria pode ser feita sem hesitar.
- Sem testes, toda mudança é um bug em potencial e o design congela. Mantenha a suíte sempre verde e sempre confiável.

## O que torna um teste limpo

- Legibilidade, legibilidade e legibilidade. Em teste, ela importa ainda mais que na produção.
- Busque clareza, simplicidade e densidade de expressão: diga o máximo com o mínimo de código.
- O leitor deve entender o que o teste verifica sem mergulhar em detalhes de infraestrutura.

## Padrão CONSTRUIR-OPERAR-VERIFICAR (given-when-then)

- Estruture cada teste em três partes claras: **construa** os dados/estado, **opere** sobre eles, **verifique** o resultado.
- Esconda detalhes irrelevantes (setup verboso, parsing, chamadas de API crua) atrás de uma **API de teste específica do domínio** — funções utilitárias como `makePages()`, `submitRequest()`, `assertResponseContains()`.
- Essa API de teste não nasce pronta: ela surge e evolui por refatoração contínua dos próprios testes.

```typescript
// Antes: detalhes de infraestrutura poluem a intenção
it("retorna odds da partida", async () => {
  await db.insert(matches).values({ id: 1, home: "A", away: "B" });
  const res = await request(app).get("/api/matches/1/odds").set("Accept", "application/json");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.text).odds.home).toBeGreaterThan(1);
});

// Depois: construir-operar-verificar, em linguagem do domínio
it("retorna odds da partida", async () => {
  await makeMatch({ id: 1 });
  const response = await getOdds(1);
  assertOddsValid(response);
});
```

## Padrão duplo: eficiência sim, clareza nunca

- Em código de teste você PODE relaxar **eficiência** (memória, CPU): o ambiente de teste não é o de produção e tem recursos limitados de forma diferente.
- Você NUNCA pode relaxar **clareza**. Limpeza e expressividade seguem o padrão de produção — ou mais alto.
- Exemplo da regra: usar um `StringBuilder`/concatenação ingênua ou estruturas ineficientes é aceitável no teste se isso deixar a intenção mais legível.

## Asserts: um conceito por teste

- "Uma confirmação (assert) por teste" é boa orientação, não dogma. Minimize o número de asserts por teste, mas não a qualquer custo.
- A regra melhor: **um único CONCEITO por função de teste**. Cada teste verifica um comportamento, não uma sequência de comportamentos.
- Se um teste verifica vários comportamentos em sequência, divida-o em testes separados, cada um com nome que descreve seu conceito.

```typescript
// Antes: três conceitos misturados em um teste
it("gerencia aposta", () => {
  const bet = placeBet(user, 50);
  expect(bet.status).toBe("open");
  settleBet(bet, "won");
  expect(bet.status).toBe("won");
  expect(user.balance).toBe(150);
});

// Depois: um conceito por teste
it("aposta criada nasce aberta", () => { /* ... */ });
it("liquidar como ganha muda o status", () => { /* ... */ });
it("liquidar como ganha credita o saldo", () => { /* ... */ });
```

## F.I.R.S.T.

- **Fast (rápido):** testes devem rodar rápido. Teste lento não é executado com frequência, problemas aparecem tarde e o código degrada.
- **Independent (independente):** nenhum teste pode depender de outro nem da ordem de execução. Cada teste prepara seu próprio estado; testes encadeados fazem uma falha esconder as seguintes.
- **Repeatable (repetível):** o teste passa em qualquer ambiente — máquina do dev, CI, sem rede. Se só passa em um ambiente específico, conserte o teste.
- **Self-validating (autovalidável):** o resultado é booleano — passou ou falhou. Nunca exija inspeção manual de logs, arquivos ou saídas para decidir o resultado.
- **Timely (pontual):** escreva o teste imediatamente ANTES do código de produção que o faz passar. Testes escritos depois encontram produção difícil de testar — e acabam não escritos.

## Checklist rápido

- Existe um teste falhando antes de cada trecho novo de produção?
- O teste lê como given-when-then em linguagem do domínio?
- Cada teste verifica um único conceito?
- A suíte é rápida, independente de ordem, roda offline e responde só passou/falhou?
- O código de teste está tão limpo quanto o de produção?
