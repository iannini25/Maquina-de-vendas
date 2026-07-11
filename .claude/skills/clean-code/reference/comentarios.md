# Comentários

## Princípio central

- Não comente código ruim — reescreva-o. Comentário é, no máximo, um mal necessário: existe para compensar seu fracasso em se expressar pelo código.
- Comentários mentem com o tempo: o código evolui e o comentário fica para trás, apontando para algo que não existe mais. A única fonte de verdade é o código.
- Antes de escrever qualquer comentário, pergunte-se: "consigo dizer isso no próprio código?" Quase sempre a resposta é sim.

## Expresse no código, não no comentário

- Extraia uma função ou variável cujo nome diga exatamente o que o comentário diria. Depois disso, apague o comentário.
- Uma condição crua com comentário explicativo deve virar um método com nome de domínio.

```typescript
// Antes
// verifica se o funcionário tem direito a todos os benefícios
if (employee.flags & HOURLY_FLAG && employee.age > 65) { ... }

// Depois
if (employee.isEligibleForFullBenefits()) { ... }
```

## Comentários bons (raros — use com parcimônia)

- **Legais/copyright**: cabeçalhos exigidos por licença são aceitáveis. Mantenha-os curtos e referencie a licença externa em vez de colar o texto inteiro.
- **Informativos pontuais**: um comentário que explica um valor de retorno ou um formato pode ser útil — mas é melhor ainda criar um nome ou uma classe que torne o comentário supérfluo.
- **Explicação de intenção**: quando uma decisão não óbvia foi tomada de propósito, registre o PORQUÊ. O código mostra o "o quê"; a intenção por trás pode merecer um comentário.
- **Esclarecimento de API de terceiros**: se você não pode mudar o código (biblioteca externa, retorno obscuro), um comentário traduzindo o significado é válido. Cuidado: você assume o risco de o esclarecimento estar errado — verifique antes de escrever.
- **Alerta de consequências**: avise sobre efeitos que custam caro descobrir na prática — "este teste demora minutos", "esta classe não é thread-safe; crie uma instância por thread".
- **TODO justificado**: aceitável para trabalho que deve ser feito mas não pode ser feito agora. Varra os TODOs regularmente e elimine os que não fazem mais sentido — não deixe acumular.
- **Destaque de importância**: chame atenção para algo que parece irrelevante mas é crítico (ex.: um `trim()` que evita bug sutil).
- **Javadoc/doc de API pública**: documente APIs públicas que outros consumirão. Não estenda essa exigência a código interno.

```typescript
// BOM: intenção + alerta de consequência
// Forçamos timeout alto de propósito: a API do banco parceiro
// responde em até 40s em horário de fechamento. Não reduza.
const TIMEOUT_MS = 45_000;
```

## Comentários ruins (nunca escreva)

- **Murmúrio enigmático**: nunca escreva um comentário que obrigue o leitor a investigar outro módulo para entender o que você quis dizer. Se não ficou claro, não valeu o esforço.
- **Redundante**: nunca comente o que o código já diz. Um comentário mais lento de ler que o próprio código é ruído puro.
- **Enganador**: imprecisão sutil é pior que ausência de comentário — o leitor confia no comentário e debuga em cima de uma mentira.
- **Imperativo/obrigatório**: nunca adote regra do tipo "todo método deve ter doc". Isso só gera lixo documental que ninguém lê e ninguém atualiza.
- **Diário/changelog**: nunca mantenha histórico de alterações no topo do arquivo. O controle de versão faz isso melhor.
- **Ruído**: nunca comente o óbvio ("construtor padrão", "retorna o nome"). Ruído treina o leitor a ignorar todos os comentários, inclusive os importantes.
- **Marcadores de posição/banners**: nunca use faixas tipo `// ===== AÇÕES =====` para organizar arquivo. Se precisa de banner, o arquivo está grande demais — divida-o.
- **Comentário em chave de fechamento**: nunca escreva `} // fim do if`. Se a função é longa a ponto de precisar disso, encurte a função.
- **Créditos e autoria**: nunca assine código com `// Adicionado por Fulano`. O git lembra quem fez o quê, e melhor que você.
- **Informação não-local**: nunca escreva comentário que descreve outra parte do sistema. Ele não será atualizado quando aquela outra parte mudar.
- **Excesso de informação histórica**: nunca despeje discussões, RFCs antigas ou detalhes irrelevantes em comentário. Vá direto ao ponto ou não escreva.
- **Conexão não óbvia**: a relação entre o comentário e o código deve ser evidente. Um comentário que precisa de explicação falhou em sua única função.
- **Cabeçalho de função**: nunca escreva um bloco descrevendo o que a função faz. Um nome bom em uma função curta substitui o cabeçalho.
- **HTML em comentário**: nunca embuta markup HTML em comentários — torna-os ilegíveis exatamente onde são lidos: no editor.

## Código comentado: abominação

- NUNCA deixe código comentado no repositório. Delete sempre. O controle de versão lembra; você pode recuperar quando quiser.
- Código comentado apodrece: ninguém tem coragem de apagar ("deve ser importante") e ninguém sabe mais por que está ali. Quem deleta é você, agora.

```typescript
// Antes — abominação
// const legacyRate = computeLegacyRate(user);
// applyDiscount(legacyRate);
applyDiscount(currentRate);

// Depois — apenas
applyDiscount(currentRate);
```

## Regra final

- O único comentário verdadeiramente bom é aquele que você encontrou um jeito de não escrever.
- Checklist antes de comentar: (1) dá para renomear algo? (2) dá para extrair função/variável? (3) o comentário explica intenção, alerta consequência ou documenta API pública? Se nenhum dos três, não escreva.
