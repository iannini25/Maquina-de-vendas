# Limites (código de terceiros)

Regras para integrar bibliotecas, frameworks e APIs externas sem deixar que eles contaminem o seu sistema.

## Encapsule interfaces de terceiros

- Interfaces de terceiros sempre oferecem mais do que você precisa: um `Map` expõe `clear()`, aceita qualquer tipo e permite que qualquer cliente apague ou corrompa dados. Nunca exponha esse poder excessivo ao resto do sistema.
- Não passe a interface de limite (a do terceiro) de mão em mão pelo sistema. Envolva-a numa classe sua, com uma API mínima que expressa o que o domínio realmente precisa.
- A classe encapsuladora esconde casts e parâmetros genéricos, impõe as regras de negócio no acesso e concentra em UM único lugar o impacto de qualquer mudança na API externa.
- Se a assinatura da biblioteca mudar, apenas a sua classe encapsuladora muda — o resto do sistema nem percebe.

```typescript
// Antes: o Map vaza para todo o sistema
const sensors = new Map<string, Sensor>();
const s = sensors.get(id); // qualquer um pode dar sensors.clear()

// Depois: limite encapsulado numa classe sua
class Sensors {
  private sensors = new Map<string, Sensor>();
  getById(id: string): Sensor { return this.sensors.get(id)!; }
}
```

- Isso não significa embrulhar todo `Map` do código. Significa: não deixe instâncias de tipos de limite circularem entre módulos, nem se tornarem parte do vocabulário público do sistema.

## Nunca exponha tipos de limite em APIs públicas

- Nunca retorne uma interface de limite (`Map`, `ResultSet`, cliente HTTP, tipo gerado por ORM/SDK etc.) de uma API pública de um módulo seu.
- Nunca aceite uma interface de limite como parâmetro de uma API pública sua. Receba e devolva tipos do SEU domínio.
- Se um tipo externo aparece na assinatura pública de um módulo, todo chamador fica acoplado à biblioteca — uma troca de fornecedor vira uma reescrita do sistema.

## Testes de aprendizagem

- Ao adotar uma biblioteca nova, não se limite a ler a documentação: escreva testes que exercitam a API exatamente do jeito que você pretende usá-la em produção.
- Esses testes custam "de graça": você precisaria aprender a API de qualquer forma — aprender escrevendo testes é mais preciso do que aprender por tentativa e erro dentro do código de produção.
- Mantenha os testes de aprendizagem no repositório. A cada upgrade da biblioteca, rode-os: eles revelam mudanças de comportamento da nova versão ANTES de quebrarem produção.
- Sem esses testes, o medo de atualizar faz o time congelar em versões antigas. Com eles, migrar de versão vira rotina barata.

```typescript
// Teste de aprendizagem: documenta o comportamento que você depende
test("date-lib soma meses sem estourar o dia", () => {
  const result = addMonths(new Date("2026-01-31"), 1);
  expect(result.getDate()).toBe(28); // se a v2 mudar isso, o teste avisa
});
```

## Código que ainda não existe

- Quando você depende de uma API que outro time ainda não entregou, não bloqueie nem espere: defina a interface que VOCÊ gostaria de ter e programe contra ela.
- Escreva essa interface do ponto de vista do seu código, com o vocabulário do seu domínio — ex.: `transmitter.transmit(frequencia, fluxo)` — e não tentando adivinhar a forma da API futura.
- Quando a API real chegar, escreva um ADAPTER que implementa a sua interface delegando para ela. O Adapter é o ÚNICO ponto de conversão entre o seu mundo e o deles.
- Bônus: a interface que você definiu é um seam natural de testes — implemente um fake/stub dela e teste o seu código sem depender do sistema externo.

```typescript
// Sua interface ideal, definida antes da API real existir
interface Transmitter {
  transmit(frequency: number, stream: DataStream): void;
}

// Quando a API real chega: Adapter como único ponto de conversão
class VendorTransmitterAdapter implements Transmitter {
  constructor(private vendor: VendorRadioApi) {}
  transmit(f: number, s: DataStream) { this.vendor.send(f, s.toBytes()); }
}
```

## Limites limpos

- Minimize os pontos de contato com código externo: quanto menos lugares do sistema conhecem a biblioteca, mais barata é qualquer mudança nela.
- É melhor depender de algo que você controla (sua interface, seu wrapper) do que ser controlado por algo que você não controla (a API do fornecedor, que muda quando quiser).
- Acomode mudanças no limite com Wrapper (encapsular o tipo do terceiro) ou Adapter (converter a API deles para a interface que você queria ter).
- Mantenha testes de limite (testes de aprendizagem) cobrindo os comportamentos externos dos quais você depende — eles suavizam migrações e upgrades.
- O código do seu sistema deve falar a SUA linguagem; o vocabulário do terceiro deve ficar confinado atrás do limite.

## Checklist rápido

- Algum `Map`, `ResultSet`, cliente de SDK ou tipo gerado aparece em assinatura pública de módulo? Encapsule.
- Quantos arquivos importam diretamente a biblioteca externa? Se for mais de um punhado, concentre atrás de um wrapper.
- Existe teste de aprendizagem para cada comportamento externo crítico? Se não, escreva antes do próximo upgrade.
- A API ainda não existe? Defina a interface ideal, programe contra ela, e planeje o Adapter.
- A troca dessa biblioteca por outra exigiria mexer em quantos lugares? A resposta certa é: um.
