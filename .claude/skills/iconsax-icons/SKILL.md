---
name: iconsax-icons
description: Sistema oficial de ícones do projeto (Iconsax — app.iconsax.io). Use esta skill SEMPRE que for adicionar, trocar ou estilizar qualquer ícone na interface — navegação, botões, badges, cards, empty states, indicadores de mercado/estatística, toggles, toasts ou ícones animados. Dispare em qualquer menção a "ícone", "icon", "iconsax", "ícone animado", e também ao criar QUALQUER componente novo de UI que precise de iconografia, mesmo que o usuário não cite ícones explicitamente. Nunca use lucide-react, heroicons, react-icons, font-awesome ou emoji como ícone neste projeto.
---

# Iconsax — Sistema de ícones do projeto

Iconsax (app.iconsax.io) é a ÚNICA fonte de ícones deste projeto. São ~1.000 ícones base
em 6 estilos (Linear, Outline, Bold, Bulk, Broken, TwoTone). O site também tem ícones
novos (V2) e **ícones animados** (premium, em Lottie JSON) — caminhos diferentes abaixo.

## Caminho 1 — Ícones estáticos (padrão): pacote npm

```bash
npm i iconsax-reactjs
```

```tsx
import { Cup, Timer1, Flag } from 'iconsax-reactjs';

<Cup size={24} variant="Bulk" color="currentColor" />
```

Props: `size` (number|string, default 24), `color` (default currentColor),
`variant` ("Linear" | "Outline" | "TwoTone" | "Bulk" | "Broken" | "Bold", default Linear).

Nomes em PascalCase do nome kebab-case do site (`shield-tick` → `ShieldTick`).
Se o import falhar, o ícone provavelmente é V2/novo e não existe no pacote → use o Caminho 2.

### Convenções do projeto (EXEMPLO — adapte ao seu projeto)

- Variant padrão: **Linear**. Item ativo de navegação: **Bold**. Destaques/feature cards: **Bulk**.
- Cor SEMPRE via `currentColor` + classe de texto do Tailwind (ex.: `text-violet-400`).
  Nunca hardcode de hex no prop `color`.
- Tamanhos permitidos: 16 (inline/badges), 20 (botões/nav), 24 (padrão), 32 (heros/empty states).
- Acessibilidade: ícone decorativo → `aria-hidden="true"` no wrapper; botão só-ícone →
  `aria-label` descritivo no botão.

### Mapa de ícones do projeto (EXEMPLO — troque pelos ícones do seu projeto, mantendo a consistência)

| Contexto | Ícone |
|---|---|
| Nav: Início | `Home2` |
| Nav: Explorar | `Discover` |
| Nav: Mensagens | `MessageText1` |
| Nav: Dashboard | `Diagram` |
| Nav: Conta | `Profile` |
| Tempo real / ao vivo | `Timer1` |
| Conquistas / destaques | `Cup` |
| Marcos / metas | `Flag` |
| Cartão / cobrança | `Card` |
| Moderação / regras | `Judge` (se não existir: `UserOctagon`) |
| Métricas / stats | `Chart2`, `Activity` |
| Tendência / ranking | `Ranking` ou `TrendUp` |
| Notificações | `Notification` |
| Pagamento / carteira | `Wallet2`, copiar código: `Copy` |
| Sucesso / pago | `TickCircle` |
| Erro / falha | `CloseCircle` |
| Info / disclaimer | `InfoCircle` |
| Configurações | `Setting2` |
| Sair | `LogoutCurve` |
| Excluir (danger) | `Trash` |

Se precisar de um ícone fora do mapa, escolha no app.iconsax.io mantendo o mesmo estilo
e ADICIONE a linha nova nesta tabela (edite esta skill) para o time manter consistência.

## Caminho 2 — Ícones V2/novos que não existem no npm: SVG local

1. O usuário baixa o SVG no app.iconsax.io e coloca em `src/components/icons/custom/`.
   Se o arquivo ainda não estiver lá, PEÇA para ele baixar (o site exige conta; você não
   consegue baixar sozinho).
2. Ao importar o SVG, substitua qualquer `fill="#292D32"` / stroke hardcoded por
   `currentColor` para herdar a cor do texto.
3. Exponha como componente React com as mesmas props do Caminho 1 (size, color)
   para a API ficar idêntica em todo o codebase.

## Caminho 3 — Ícones ANIMADOS (Lottie JSON, premium)

Os animados do Iconsax são exportados em **JSON (Lottie)** e exigem plano premium.
Você não tem acesso à conta — o fluxo é:

1. Verifique se o JSON já existe em `public/icons/animated/`. Convenção de nome:
   `kebab-case` igual ao site (ex.: `wallet-check.json`).
2. Se NÃO existir, pare e peça: "Baixa o ícone animado X em JSON (Lottie) no
   app.iconsax.io e salva em public/icons/animated/x.json" — então continue.
3. Renderize com o componente `AnimatedIcon` (template em `assets/AnimatedIcon.tsx`
   desta skill — copie para `src/components/icons/AnimatedIcon.tsx` na primeira vez
   e instale a dependência):

```bash
npm i lottie-react
```

```tsx
<AnimatedIcon src="/icons/animated/wallet-check.json" size={48} trigger="once" />
<AnimatedIcon src="/icons/animated/live-pulse.json" size={20} trigger="loop" />
<AnimatedIcon src="/icons/animated/search.json" size={24} trigger="hover" />
```

### Regras de uso de animados (performance e bom gosto)

- Animado APENAS em momentos-chave: sucesso de pagamento, empty states, indicador LIVE,
  onboarding. NUNCA na navegação inteira ou em listas longas.
- Máximo de 2 ícones animados visíveis simultaneamente por tela.
- Sempre lazy: o `AnimatedIcon` já carrega o JSON sob demanda — não importe JSON
  estaticamente no bundle.
- `prefers-reduced-motion: reduce` → o componente exibe o primeiro frame parado
  (já tratado no template). Não remova esse comportamento.
- Fallback: se o JSON não carregar, renderize o ícone estático equivalente do Caminho 1.

## Checklist antes de finalizar qualquer tarefa com ícones

- [ ] Nenhum emoji, lucide, heroicons ou react-icons foi introduzido.
- [ ] Variants seguem a convenção (Linear / Bold ativo / Bulk destaque).
- [ ] Cores via currentColor + Tailwind.
- [ ] Animados só onde a regra permite, com reduced-motion respeitado.
- [ ] Ícones novos adicionados ao mapa desta skill.
