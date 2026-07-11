# Concorrência

## O que a concorrência é (e o que ela não é)

- Concorrência desacopla **o que** é executado de **quando** é executado. Use-a para melhorar estrutura (sistemas que parecem muitos computadores pequenos cooperando) e vazão em cargas limitadas por E/S.
- Não assuma que concorrência sempre melhora desempenho — só melhora quando há espera real (E/S, múltiplos processadores ociosos) a aproveitar. Meça antes de adotar.
- Concorrência **sempre** muda o design. Não dá para "adicionar threads" a um design single-thread e esperar que ele continue correto.
- Concorrência tem custo: mais complexidade, mais código, bugs novos. Aceite esse custo conscientemente.
- Bugs concorrentes são raros e não reproduzíveis. NUNCA descarte uma falha esporádica como "caso isolado", "cosmic ray" ou "problema de ambiente" — trate como bug de threading até provar o contrário.

## SRP da concorrência

- Separe o código que gerencia threads/concorrência do restante da lógica de negócio. Concorrência é uma razão de mudança por si só.
- Concentre a lógica concorrente em poucas classes pequenas, bem controladas, cuja única responsabilidade é gerenciar concorrência.
- Nunca espalhe `synchronized`, locks ou criação de threads pelo código de domínio.

## Limite os dados compartilhados

- Restrinja ao mínimo o escopo dos dados compartilhados entre threads. Cada ponto adicional que muta dado compartilhado é mais um lugar para errar e mais proteção duplicada para manter.
- Mantenha as seções críticas (`synchronized`, locks) as menores e as menos numerosas possível.
- Proteja TODOS os caminhos que tocam o dado compartilhado — esquecer um único ponto quebra todos os outros.

## Prefira cópias e independência

- Quando possível, trabalhe com cópias dos dados: copie, processe em paralelo, consolide no final. O custo de copiar costuma ser menor que o custo de sincronizar (e de errar a sincronização).
- Faça cada thread o mais independente possível: dados locais, sem estado compartilhado, recebendo tudo o que precisa como parâmetro — como o modelo de servlets.
- Cuidado com dependências escondidas: campos `static`, caches e conexões compartilhadas reintroduzem estado compartilhado silenciosamente.

## Conheça a sua biblioteca

- Use as coleções thread-safe prontas (`ConcurrentHashMap` e afins) em vez de sincronizar coleções comuns à mão — elas são mais corretas e mais rápidas.
- Use o framework `Executor` para pools de threads em vez de criar threads manualmente.
- Prefira soluções non-blocking quando aplicável: classes `Atomic*` e operações compare-and-swap superam locks na maioria dos cenários de baixa contenção.
- Saiba o que NÃO é thread-safe: `SimpleDateFormat`, conexões de banco, os contêineres de `java.util` (`HashMap`, `ArrayList`...). Não compartilhe essas instâncias entre threads.
- Operações COMPOSTAS sobre uma coleção thread-safe NÃO são seguras: cada chamada é atômica, a sequência não é.

```java
// ANTES — check-then-act com janela de corrida entre as chamadas
if (!map.containsKey(key)) {
    map.put(key, value);
}

// DEPOIS — operação atômica única
map.putIfAbsent(key, value);
// (alternativas: lock englobando a sequência, ou um Adapter que encapsula e sincroniza)
```

## Conheça os conceitos e modelos de execução

- Domine o vocabulário: recursos limitados, exclusão mútua, starvation (thread nunca obtém o recurso), deadlock (espera circular eterna), livelock (threads ativas que nunca progridem).
- Conheça os três modelos clássicos: produtor-consumidor (fila limitada com sinalização), leitores-escritores (equilibrar vazão de leitura com atualização sem starvation), jantar dos filósofos (competição por recursos compartilhados).
- A maioria dos problemas concorrentes reais é variação de um desses três. Reconheça o padrão e aplique a solução canônica em vez de inventar uma.

## Dependências entre métodos sincronizados

- Dois métodos individualmente sincronizados podem quebrar quando o cliente os chama em sequência: outra thread pode agir entre as chamadas (ex.: `hasNext()` retorna true e outra thread consome o último elemento antes do `next()`).
- Evite expor mais de um método que opera sobre o mesmo objeto compartilhado. Quando inevitável, prefira **bloqueio no servidor**: o próprio objeto expõe uma operação única que faz a sequência inteira sob lock.
- Se não puder mudar o servidor (código de terceiro), crie um Adapter que encapsula o objeto e faz o bloqueio — ainda é bloqueio "no servidor" do ponto de vista do cliente.
- Bloqueio no cliente é o último recurso: todo cliente precisa lembrar de travar, o código de lock se repete, e é fácil esquecer um. Bloqueio no servidor elimina a repetição e esconde o escopo das variáveis compartilhadas.

```java
// ANTES — bloqueio no cliente: cada chamador precisa lembrar disso
synchronized (list) {
    if (!list.contains(item)) list.add(item);
}

// DEPOIS — bloqueio no servidor: a operação composta vive em um só lugar
class GuardedList<T> {
    private final List<T> list = new ArrayList<>();
    public synchronized void addIfAbsent(T item) {
        if (!list.contains(item)) list.add(item);
    }
}
```

## Deadlock

- Deadlock exige QUATRO condições simultâneas: exclusão mútua, bloqueio e espera (segurar um recurso enquanto espera outro), sem preempção (ninguém pode tomar o recurso de quem o detém) e espera circular.
- Para eliminar deadlock, quebre qualquer UMA das quatro condições.
- A tática mais comum e robusta: defina uma **ordem global de aquisição** de recursos e faça todas as threads adquirirem locks sempre nessa ordem — isso elimina a espera circular.
- Alternativas: liberar tudo e tentar de novo se não conseguir todos os recursos (quebra bloqueio-e-espera, mas pode causar starvation/livelock), ou usar locks com timeout (quebra a "sem preempção").

## Desligamento gracioso

- Encerrar um sistema multithread corretamente é difícil: threads bloqueadas esperando um sinal que nunca chegará (produtor encerrado, consumidor preso) impedem o shutdown.
- Pense no desligamento desde o início do design, não no fim — adicioná-lo depois é muito mais caro.
- Garanta que todo ponto de espera tenha um caminho de saída no shutdown (interrupção, poison pill, timeout) e que threads-filhas sejam encerradas antes das threads que elas alimentam ou consomem.

## Testando código com threads

- Trate toda falha espúria de teste como um possível bug de threading. Não reexecute "até passar" e siga em frente.
- Faça o código funcionar SEM threads primeiro. Não depure simultaneamente lógica de negócio e concorrência — garanta que o código não-concorrente esteja correto e testado isoladamente, fora do contexto de threads.
- Torne o código com threads plugável e ajustável: número de threads configurável, possibilidade de rodar com 1, várias ou um número variável de threads, com dublês ou implementações reais.
- Rode os testes com mais threads do que núcleos/processadores para forçar trocas de contexto e expor condições de corrida.
- Rode em todas as plataformas-alvo, repetidamente — schedulers diferentes produzem entrelaçamentos diferentes e revelam bugs distintos.
- Instrumente o código para "sacudir" (jiggle) os entrelaçamentos: insira chamadas a `wait`/`sleep`/`yield` em pontos estratégicos (manualmente em builds de teste, ou com ferramenta automática de instrumentação) para forçar caminhos de execução raros.
- Um teste que falha uma vez sob jiggling provou a existência do bug. Milhares de passagens sem jiggling não provam a ausência dele.
