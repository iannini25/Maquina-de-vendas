# UI Inventory — Protótipo Sales4U

**Fonte:** `docs/prototype/Sales4U.html` (bundle single-file React, navegado como usuário via Playwright/Chromium headless, viewport 1440×900).
**Screenshots e microcopy extraída:** `docs/prototype-screens/` (101 PNGs + 75 TXTs com `document.body.innerText` de cada estado).
**Data do walk:** 2026-07-10/11.

Convenção de nomes: `<tela>.png` = tela base (full-page); `<tela>--<estado|modal|aba>.png` = subestado.

---

## Estrutura global (shell)

Presente em todas as telas autenticadas:

- **Sidebar fixa (~248px, fundo elevado)** com logo `sales4U`, 4 grupos rotulados em overline:
  - `PRINCIPAL`: Dashboard · Pipeline · Leads · Inbox (badge numérico "7") · Campanhas · Pós-venda
  - `CRESCIMENTO`: Landing Pages · Anúncios · Prospecção · Templates de E-mail
  - `INTELIGÊNCIA`: Contexto · SDR de IA
  - `RESULTADO`: ROI & Finanças
  - Rodapé da sidebar: card do usuário "**Você** / Workspace · Liderança IA" → abre menu com "**Credenciais & Integrações**" e "**Sair**" (vermelho).
  - Item ativo: pílula com fundo elevado + barra/realce roxo; cada item tem ícone SVG de 17px.
- **Topbar** por tela: título da tela + subtítulo contextual; busca central "Buscar leads, conversas, campanhas…" com atalho `⌘K` (decorativa — ver Observações); botão-ícone de sino com ponto de notificação; **CTA primário em pílula gradiente roxo** que muda por tela (Criar com IA / Novo lead / Nova conversa / Nova campanha / Criar / Nova landing page / Gerar anúncios / Buscar leads / Novo template / Adicionar contexto / Salvar configuração / Lançar / Re-verificar tudo / Abrir Pipeline / Ver templates / Entrar).
- Em Pipeline e Inbox a topbar tem também um **seletor de produto/pipeline** ("● Curso · IA na Liderança ˅").
- **Toasts**: pílula flutuante centralizada na base ("Ambiente pronto. Bora vender.", "Ação realizada.", etc.), com ponto roxo à esquerda.

---

## 1. Login

**Slug/screenshots:** `login.png`, `login--preenchido.png`, `login--apos-entrar.png`, `login--esqueci-senha.png`
**Como chegar:** menu do usuário (sidebar) → "Sair".

**Layout:** split-screen 50/50.
- Coluna esquerda (fundo escuro liso): logo sales4U, título **"Entrar na sua máquina"**, subtítulo "Bem-vindo de volta. Cada login abre um ambiente isolado.", formulário, CTA largo.
- Coluna direita (painel de marketing com glow roxo): badge "● Sua máquina de vendas com IA", headline grande **"Transforme atenção em venda, no automático."** (palavra "venda" em roxo), parágrafo "Um SDR de IA cuida dos seus leads 24/7 — do primeiro oi ao fechamento. O pipeline é o seu painel de controle.", régua de 3 estatísticas separadas por divisores: `24/7 IA cuidando` · `+38% conversão` · `100% seu ambiente`, rodapé "© 2026 sales4U · CRM self-host com IA".

**Componentes:** inputs com ícone (envelope/cadeado), toggle de visibilidade de senha (olho), checkbox custom roxo, link, botão primário gradiente full-width.

**Campos:**
- E-mail* (pré-preenchido `voce@lideranca.ia`)
- Senha* (mascarada, ícone olho)
- ☑ "Manter conectado" (marcado por padrão) · link "Esqueci minha senha"
- Botão **Entrar**

**Interações:** Entrar → vai direto ao Dashboard (sem repassar pelo Setup Gate se já liberado). "Esqueci minha senha" **não tem ação visível** (nem toast).
**Estados:** sem loading no submit; sem estado de erro de credencial; sem validação visível de e-mail.

---

## 2. Setup Gate — "Configuração inicial do ambiente"

**Slug/screenshots:** `setup-gate.png` (full-page, ~2,9k px de altura), `setup-gate--verificando.png`, `setup-gate--verificado.png`, `setup-gate--configurar-depois.png`
**Como chegar:** primeiro load da página (bloqueia o app inteiro).

**Layout:** página única centralizada (sem sidebar), coluna ~860px:
- Logo + título **"Configuração inicial do ambiente"** + parágrafo "Cada login é um ambiente isolado. Pluga suas próprias chaves e o sistema se auto-configura — o acesso libera quando todas as credenciais obrigatórias ficarem verdes."
- **Barra de progresso** + contador "**0 de 6** obrigatórios verificados" + botão "Verificar todos".
- 10 **cards de credencial** empilhados (6 obrigatórios + 4 opcionais), cada um com: ícone, título, badge `obrigatório`/`opcional`, descrição, badge de status à direita (`Pendente` → `Verificando…` → `Conectado` verde), campos, botão "Verificar" (ou "Verificar DNS"/"Verificar domínio"), nota "Segredos mascarados · guardados criptografados". Opcionais têm também "Configurar depois".
- **Barra fixa inferior**: "**0/6** obrigatórios · 0/4 opcionais" + botão "**Liberar sistema →**" (desabilitado até 6/6; ganha gradiente quando habilita).

**Cards e campos** (asterisco = obrigatório, exibido em roxo):
1. **Núcleo & Segurança** (obrigatório) — "Cifra os segredos e protege o login." — Chave de criptografia do app* (+ botão "Gerar"), Segredo de sessão / JWT* (+ "Gerar").
2. **Banco de dados & Infra** — "Onde ficam seus dados e arquivos." — URL do PostgreSQL*, URL do Redis*, Storage — Endpoint (S3/R2/MinIO)*, Access Key*, Secret Key*, Bucket*.
3. **IA (Claude)** — "Liga o SDR, as copies e a busca de contexto (RAG)." — Anthropic API Key*, "Modelo padrão" (segmented: Sonnet 4.6 / Opus 4.8 / Haiku 4.5), Voyage AI Key (embeddings)*.
4. **WhatsApp (Evolution API)** — "Liga o Inbox e a automação de conversas." — URL da instância*, API Key da Evolution*, bloco "Parear o WhatsApp — Abra o WhatsApp → Aparelhos conectados → leia o QR Code." (placeholder de QR).
5. **E-mail (Resend) + DNS** — "Liga e-mails transacionais e evita o spam." — Resend API Key*, Domínio de envio*, **tabela DNS** (TIPO/HOST/VALOR com botão "Copiar" por linha: TXT spf, CNAME dkim, TXT _dmarc, MX send) e botão "Verificar DNS".
6. **Domínio & DNS do sistema** — "Libera o painel e a publicação das landing pages." — Domínio do app*, Domínio das landing pages*, tabela DNS (A app → 203.0.113.10, CNAME lp → cname.vendaflow.io), nota "TLS/HTTPS automático após apontar o domínio", botão "Verificar domínio".
7. **Prospecção — Vibe Prospecting** (opcional) — "Libera a aba de Prospecção e o chatbot." — Chave / conexão do MCP (Explorium).
8. **Criativos — Higgsfield** (opcional) — "Libera geração de imagem/vídeo nos Anúncios." — Higgsfield API Key.
9. **Checkout / Pagamentos** (opcional) — "Libera vendas em tempo real no ROI." — Provedor (segmented: Hotmart / Kiwify / Eduzz / Stripe), Segredo do webhook.
10. **Rastreamento / Pixels** (opcional) — "Libera rastreio de conversão nas landing pages." — Meta Pixel ID, Token Conversions API, Google tag / Analytics.

**Interações/estados:** "Verificar todos" dispara estado **Verificando…** em todos os cards (badge roxa) e depois **Conectado** (badge verde com borda), barra de progresso anima até 6/6; "Liberar sistema" fecha o gate e mostra toast "**Ambiente pronto. Bora vender.**" sobre o Dashboard. Estado de erro de verificação **não existe** (verificação sempre passa).

---

## 3. Dashboard

**Slug/screenshots:** `dashboard.png`, `dashboard--grafico-despesas.png`, `dashboard--acao-cobrar.png`, `dashboard--destino-ver-o-que-precisa.png`, `dashboard--destino-resolver-agora.png`, `dashboard--toast-ambiente-pronto.png`
**Topbar:** título "Dashboard", subtítulo "4 leads aguardam você · R$ 51.922 em jogo", CTA "Criar com IA".

**Layout:** grid de 12 col em 3 faixas, coluna direita mais estreita:
1. **Hero card** (gradiente roxo→escuro, borda roxa): overline "SUA MÁQUINA HOJE", h1 "Olá, aqui está sua máquina rodando", linha "26 leads ativos · **R$ 51.922** em jogo · <span âmbar>4 aguardando você</span>", CTA "Ver o que precisa de você ↗". Ao lado, card "● GARGALO DO FUNIL · IA": "**73%** travam entre \"Qualificado\" e \"Em negociação\" — veja as 5 conversas." + botão "Resolver agora".
2. **3 KPI cards**: ícone quadrado colorido + delta (+12% verde / +18% verde / -0,4% rosa) + valor grande (26 / R$ 51.922 / 3,5%) + label (Leads ativos / Receita do mês / Taxa de conversão).
3. **Funil** (card): título "Funil" + hint "conversão entre etapas"; 5 barras roxas com contagem no topo (12 Novos · 9 Conversa · 6 Qualif. · 4 Negoc. · 3 Ganho). Ao lado, card de **gráfico de área** com segmented "Receita | Despesas", valor "R$ 51.922" e "+18% vs. mês anterior" (verde).
4. Faixa inferior com 3 cards-lista:
   - **Conversas pendentes** (badge âmbar "4 aguardando"): linhas com avatar-iniciais coloridas, nome, última mensagem, tempo (João Mendonça "Consegue um desconto? Fecho hoje." 4 min · Camila Souza "Preciso ver com meu sócio." 30 min · Bruno Carvalho "Achei caro pelo que entrega." 1 h).
   - **Follow-ups atrasados**: nome + motivo em rosa ("sem resposta há 2 dias" / "prometeu retorno ontem" / "parou de responder") + botão "Cobrar" por linha (Ricardo Mello, Fernanda Lopes, Tiago Nunes).
   - **Campanhas ativas** (bullets coloridos): Live IA na Liderança 142 leads · Meta · Tráfego frio CPL R$ 9,40 · Remarketing carrinho "pausada". Abaixo, **Landing pages publicadas**: Inscrição Live "Publicada · 38% conv." · Oferta Curso R$ 1.997 "Publicada · 4,2% conv." · VSL Liderança "Rascunho".

**Componentes:** hero-banner, stat cards com delta, bar-funnel custom, area chart, segmented control, list cards com avatar, badges de status, botões secundários pequenos.

**Interações observadas:**
- Segmented "Receita/Despesas" troca o dataset do gráfico.
- "Cobrar" → toast "**Cobrança enviada pela IA pelo WhatsApp.**"
- "Ver o que precisa de você" → navega ao **Pipeline já filtrado por "Aguardando você"**.
- "Resolver agora" → navega ao Pipeline (mesmo filtro).
- `Ctrl/⌘+K` e clique na busca **não abrem** command palette (sem ação).
- Sino de notificações não abre painel.

**Estados:** dados sempre populados; sem loading/empty/erro.

---

## 4. Pipeline (Kanban)

**Slug/screenshots:** `pipeline.png`, `pipeline--colunas-2/3/4.png` (scroll horizontal), `pipeline--seletor-produto.png`, `pipeline--filtro-ia-cuidando.png`, `pipeline--filtro-aguardando-voce.png`, `pipeline--filtro-temperatura.png`, `pipeline--novo-lead.png`, `pipeline--adicionar-lead-coluna.png`, `pipeline--config-estagio.png`, `pipeline--lead-detalhe.png` (+ `--conversa/--notas/--atividade`), `pipeline--drag-em-andamento.png`, `pipeline--drag-resultado.png`
**Topbar:** "Pipeline" + seletor "● Curso · IA na Liderança ˅" + subtítulo "26 leads ativos · 12 estágios" + CTA "Novo lead".

**Layout:** faixa de filtros no topo; abaixo, **kanban com 12 colunas** roláveis horizontalmente (largura total ≈ 3.600px).
- **Filtros (chips):** `Todos os estágios` (ativo por padrão) · `IA cuidando` · `Aguardando você` · `Temperatura` (toggle). À direita, legenda: ● IA cuidando (roxo) · ● Aguardando você (âmbar) · ● Pausado (cinza).
- **Colunas** (bolinha de cor + nome + contagem + engrenagem): cabeçalho com "Em jogo · R$ X" e pílula do playbook "⚿ SDR · <objetivo>":
  1. Novo lead — SDR · Apresentar e criar rapport
  2. Em conversa — SDR · Descobrir a dor
  3. Qualificado — SDR · Mapear objeções
  4. Interessado — SDR · Prova social e valor
  5. Em negociação — SDR · Fechar e enviar pagamento
  6. Compra direta — SDR · Acelerar checkout
  7. Venda concluída — SDR · Onboarding e entrega
  8. Pós-venda — SDR · Reter e fazer upsell
  9. Não respondeu — SDR · Reativar com cadência
  10. Reativar depois — SDR · Nutrição de longo prazo
  11. Ganho — Fixo · Negócio ganho
  12. Perdido — Fixo · Negócio perdido
- **Card de lead:** borda esquerda colorida por status, avatar-iniciais gradiente, nome truncado, origem (Anúncio Meta / Instagram / Live gratuita / Indicação), badge de status (`IA cuidando` roxo / `Aguardando você` âmbar / `Pausado` cinza), resumo/última fala (ex.: "Quanto custa? Tem parcelamento?"), **barra de progresso** (temperatura/score), valor "R$ 1.997", timestamp "há 12 min".
- Fim de cada coluna: botão fantasma tracejado "**+ Adicionar lead**" (funciona como empty state em colunas zeradas: "0 / Em jogo · R$ 0").

**Modais/overlays:**
- **Novo lead** (modal central, `pipeline--novo-lead.png`): Nome* · WhatsApp* (placeholder "+55 (11) 99999-9999") · E-mail (opcional) · Origem (select: Anúncio Meta / Live gratuita / Indicação) · Valor potencial (opcional, placeholder "R$ 1.997") · "Estágio inicial" (chips: Novo lead / Em conversa / Qualificado) · link "Importar em massa" · botões Cancelar / **Adicionar lead**. Fecha por X ou Cancelar (Esc não fecha).
- **Config do estágio / playbook** (slide-over direito, `pipeline--config-estagio.png`, via engrenagem): overline "SDR DE IA · ESTE ESTÁGIO", título = nome do estágio, "Defina como o vendedor de IA age com leads neste estágio."; segmented "Como configurar": **Configurar manual | Anexar markdown**; campos: Objetivo neste estágio* · Instruções e tom (textarea; ex.: "Apresente o curso com clareza, crie rapport e descubra a dor de liderança. Não fale de preço sem ser perguntado.") · "Ações liberadas" (3 toggles: Enviar link de pagamento ✓ · Enviar prova social / cases ✓ · Oferecer desconto — requer aprovação ✗) · Critério para avançar* · Critério para regredir* · "Nível de autonomia*" (segmented: Rascunho / **Semiauto** / Auto) com hint "A IA envia sozinha, mas pede aprovação para ações sensíveis (desconto, pagamento)." e nota fixa "Guardrails sempre ativos: nunca inventa preço/prazo/promessa; se faltar contexto, marca pendente."; rodapé Cancelar / **Salvar playbook**.
- **Detalhe do lead** (slide-over direito largo, `pipeline--lead-detalhe*.png`, via clique no card): header com avatar, nome, badges (`Frio`/`Quente` + `IA cuidando`), X; CTA full-width "**Abrir conversa**"; **abas: Visão geral | Conversa | Notas | Atividade**; rodapé "Assumir conversa" + botão "⋯".
  - *Visão geral:* "DADOS DO LEAD" (WhatsApp, E-mail, Origem, Campanha, Estágio, Valor potencial) + card "PRÓXIMA AÇÃO RECOMENDADA (IA)" + card "Score 24" com barra e "Fatores: engajou na live · respondeu em <5min · cargo de liderança · objeção de preço pendente."
  - *Conversa:* mini-thread de chat (balões lead/IA) + "IA respondeu · há 4 min".
  - *Notas:* nota "Mencionou que decide junto com o sócio. Bom mandar material de ROI." — "Você · ontem".
  - *Atividade:* timeline ("Entrou pela landing de inscrição da live · há 3 dias" → "IA respondeu a primeira dúvida" → "Mudou para Novo lead" → "Recebeu a primeira mensagem de boas-vindas da IA. · há 12 min").
  - "Assumir conversa" muda badge do card para `Pausado` + toast "**Você assumiu a conversa — a IA foi pausada para este lead.**"
- **Seletor de produto** (dropdown na topbar): Curso · IA na Liderança / Mentoria 1:1 / Comunidade Anual / "+ Novo pipeline". Trocar o produto troca todo o dataset do kanban.

**Interações:** filtros re-renderizam colunas (contagens mudam); scroll horizontal do kanban; hover eleva cards. **Drag & drop de card não foi reproduzível via automação** (mouse down/move/up não move o card — ver Observações; pode ser HTML5 DnD ou não implementado).
**Estados:** colunas vazias com "+ Adicionar lead"; sem loading; sem erro.

---

## 5. Leads

**Slug/screenshots:** `leads.png`, `leads--clique-linha.png`
**Topbar:** "Leads" + "Visão de leitura · espelho do Pipeline" + CTA "**Abrir Pipeline**".

**Layout:**
- Banner informativo azul: "ⓘ Esta é uma cópia do Pipeline, só para visualizar todos os leads em lista. Para agir (mover estágio, conversar, configurar IA), use o Pipeline."
- 4 stat cards: **10** total de leads · **2** novos · **2** em negociação · **5** quentes (número rosa).
- **Tabela** com colunas: NOME ↕ (avatar + nome; ordenável) · ESTÁGIO · TEMP. (Quente rosa / Morno âmbar / Frio azul) · CANAL (WhatsApp/Instagram) · SCORE ↕ (roxo) · STATUS IA (badge pill: IA cuidando / Aguardando você / Pausado).
- 10 linhas (Bruno Carvalho, Camila Souza, Eduardo Pinheiro, João Mendonça, Juliana Costa, Larissa Dias, Marcos Tavares, Patrícia Lemes, Rafael Andrade, Sérgio Almeida).

**Interações:** clique na linha abre o mesmo **slide-over de detalhe do lead** do Pipeline (`leads--clique-linha.png`); "Abrir Pipeline" navega.
**Estados:** sem empty/loading/erro; ordenação indicada mas não testada.

---

## 6. Inbox

**Slug/screenshots:** `inbox.png`, `inbox--conversa-camila.png`, `inbox--assumido.png`, `inbox--sugestao-ia.png`, `inbox--mensagem-enviada.png`, `inbox--mover-estagio.png`, `inbox--nova-conversa.png`, `inbox--filtro-ia-cuidando.png`
**Topbar:** "Inbox" + seletor de produto + "7 conversas não lidas" + CTA "Nova conversa".

**Layout — 3 colunas:**
1. **Lista de conversas** (esq.): busca "Buscar conversa…"; chips de filtro `Todas` / `IA cuidando` / `Aguardando você` (com scroll horizontal); itens com avatar, nome, tempo, preview da última mensagem, badge de status, canal (WhatsApp/Instagram), contador de não lidas (verde). Conversa ativa com fundo elevado + borda roxa.
2. **Thread central:** header com avatar, nome, "WhatsApp · Em negociação", badge `Aguardando você` + botão "**Assumir**" (após assumir vira badge `Pausado` + botão "**Devolver pra IA**"); divisor de data "Hoje"; balões — lead à esquerda (cinza), IA/você à direita (gradiente roxo, com selo "IA" no rodapé do balão); composer com botão "**✦ Sugestão da IA**", input "Escreva uma mensagem…", botão de envio circular roxo (ícone avião).
3. **Painel de contexto** (dir.): "CONTEXTO DO LEAD" (Estágio "Em negociação" · Valor "R$ 1.997" · Score "88" roxo); card "PRÓXIMA AÇÃO (IA)": "Responder a dúvida sobre garantia e oferecer o link de pagamento com o bônus de hoje."; botão "**Mover estágio**".

**Microcopy do thread demo:** "Oi! Vi a apresentação. Consegue um desconto? Fecho hoje." / "Que bom que curtiu! O investimento é R$ 1.997. Não trabalho com desconto, mas fechando hoje libero a mentoria em grupo de bônus. Topa?" / "Hmm, deixa eu pensar. Tem garantia?"

**Modal Nova conversa** (`inbox--nova-conversa.png`): Destinatário* (segmented **Lead existente** | Novo número) · Lead (select: "Eduardo Pinheiro · Qualificado", "Camila Souza · Qualificado", "Rafael Andrade · Em conversa") · Canal (select: WhatsApp / Instagram) · Primeira mensagem* (textarea "Escreva a primeira mensagem…" + botão "✦ Sugestão da IA") · toggle "**Deixar a IA conduzir a partir daqui**" (on) · Cancelar / **Iniciar conversa**.

**Interações:**
- Trocar de conversa atualiza thread + painel de contexto.
- "Assumir" → badge muda p/ `Pausado`, botão vira "Devolver pra IA", toast "**Você assumiu a conversa — a IA foi pausada.**"
- "Sugestão da IA" preenche o composer com texto sugerido.
- **Enviar mensagem (Enter) não insere balão no thread** (envio não implementado no protótipo).
- "**Mover estágio**" **navega para o Pipeline** (não abre dropdown).
- Filtro `IA cuidando` reduz a lista.

**Estados:** contadores de não lidas; badge por status; sem estado de conversa vazia/sem conversas; sem loading.

---

## 7. Campanhas

**Slug/screenshots:** `campanhas.png`, `campanhas--filtro-pausadas.png`, `campanhas--filtro-rascunhos.png`, `campanhas--nova-campanha.png`, `campanhas--detalhe.png`, `campanhas--detalhe-anuncios.png`, `campanhas--detalhe-leads.png`, `campanhas--detalhe-automacao.png`, `campanhas--detalhe-landing.png`
**Topbar:** "Campanhas" + "3 ativas · CPL médio R$ 9,40" + CTA "Nova campanha".

**Lista:** chips `Todas` / `Ativas` / `Pausadas` / `Rascunhos`; grid 2-col de **cards de campanha**: título, badge de tipo (`Lançamento/Live` roxo / `Padrão` azul), canal ("Meta + Orgânico", "Meta", "Google"), status com bolinha (● Ativa verde / ● Pausada âmbar / ● Rascunho cinza) e 4 métricas: leads · conversões · CPL · receita (verde). Campanhas demo: Live IA na Liderança (142 · 18 · R$ 6,80 · R$ 35.946), Tráfego frio · Curso (96 · 7 · R$ 9,40 · R$ 13.979), Remarketing carrinho (38 · 2 · R$ 4,10 · R$ 3.994), Google Search · Marca (0 · 0 · — · —).

**Modal Nova campanha:** Tipo* (segmented **Padrão** | Lançamento (Live)) · Nome* (placeholder "Ex.: Live IA na Liderança") · Produto* (select: Curso IA na Liderança · R$ 1.997 / Mentoria 1:1 · R$ 4.900 / Comunidade Anual · R$ 997) · Objetivo* (Gerar leads / Venda direta / Inscrição na live) · Canal de aquisição* (Meta / Google / Orgânico / Outro) · Landing page (select: "Inscrição Live · vendaflow.io/live-ia", "Oferta Curso · vendaflow.io/curso-ia") · Orçamento previsto (opcional, "R$ 5.000") · CPL alvo (opcional, "R$ 8,00") · Cancelar / **Criar campanha**.

**Detalhe da campanha** (tela própria, via clique no card): breadcrumb "‹ Voltar para campanhas"; h1 "Live IA na Liderança" + badge `Lançamento/Live` + "● Ativa"; sub "Meta + Orgânico · Curso IA na Liderança · usa a LP \"Inscrição Live\""; botões "Editar" e "Pausar"; **abas: Visão geral | Anúncios | Leads | Automação | Landing**:
- *Visão geral:* 4 KPIs (142 leads · 18 conversões · R$ 6,80 CPL · 4,4x ROAS verde) + gráfico "Receita da campanha" + card "● SUGESTÕES DA IA — CPL ótimo, mas a LP converte 38% no mobile e 19% no desktop — teste a variante B no desktop para subir o ROAS."
- *Anúncios:* cards "Liderar virou outra coisa" (Vídeo curto · Meta, CTR 2,4%, CPL R$ 6,80) e "A IA não vai te substituir" (Imagem única · Meta, CTR 1,9%, CPL R$ 7,40).
- *Leads:* tabela LEAD / ESTÁGIO / VALOR / STATUS IA (Eduardo Pinheiro, João Mendonça).
- *Automação:* texto "A cadência da IA para leads desta campanha segue o playbook de cada estágio do Pipeline. Sequência de aquecimento da live: T+0 confirmação · T-1d lembrete · T-1h \"estamos começando\"."
- *Landing:* card "Inscrição Live — vendaflow.io/live-ia" + "Copiar link" + nota "É este link que a IA e os anúncios usam para vender."

**Estados:** filtros funcionam (Pausadas/Rascunhos mostram só os respectivos); card Rascunho com métricas zeradas "—"; sem loading/erro.

---

## 8. Pós-venda

**Slug/screenshots:** `pos-venda.png` (aba Clientes), `pos-venda--fluxos.png`, `pos-venda--acessos-uso.png`, `pos-venda--criar.png`
**Topbar:** título "Sales4U" (ver Observações) + CTA "Criar".

**Abas: Clientes | Fluxos de pós-venda | Acessos & uso** (tab underline).
Banner âmbar em todas: "● 3 clientes não usaram o acesso — a IA já está cuidando da reativação."

- **Clientes:** tabela CLIENTE / USO (Ativo verde · Logou âmbar · Nunca usou rosa) / NPS (9 / — / —) / PRÓXIMA AÇÃO (IA) ("Pedir depoimento" · "Enviar guia do dia 2" · "\"Aconteceu algo? Posso ajudar?\"") — Sérgio Almeida, Ana Beatriz, Marcelo Reis.
- **Fluxos de pós-venda:** grid 2-col de cards com **toggle** on/off + botão "Editar mensagem": Confirmação da compra ✓ · Entrega de instruções ✓ · Pesquisa NPS ✓ · Pedido de depoimento ✗ · **Oferta complementar (upsell)** ✓ com campo extra "Janela de tempo*" (select "7 dias após a compra") · Reativação ✓.
- **Acessos & uso:** botão "Configurar links de acesso" + tabela CLIENTE / LOGOU? / TEMPO ATIVO / ÚLTIMA ATIVIDADE (Sérgio Almeida: Sim · 4h 20min · há 2h; Marcelo Reis: Não · — · —).

**Interações:** CTA "Criar" apenas dispara toast "**Ação realizada.**" (sem modal).
**Estados:** sem empty state; toggles interativos.

---

## 9. Landing Pages

**Slug/screenshots:** `landing-pages.png`, `landing-pages--nova.png`, `landing-pages--toast-copiar.png`, `landing-pages--detalhe.png`
**Topbar:** "Landing Pages" + "2 publicadas · 1 rascunho · links usados pela IA" + CTA "Nova landing page".

**Layout:** banner roxo "🔗 Os links cadastrados aqui são os que o SDR de IA e as campanhas usam para vender."; grid 3-col de **cards de LP**: thumbnail placeholder (ícone), título, link roxo (`vendaflow.io/live-ia`) + botão "Copiar", rodapé "Publicada · conv. 38% · 2 variantes" / "Rascunho · conv. — · 1 variantes". Cards: Inscrição Live, Oferta Curso R$ 1.997, VSL Liderança.

**Modal Nova landing page:** "Como começar" (segmented: **Por blocos** | Anexar link | Anexar arquivo) + hint "Por blocos: monte do zero no editor. Anexar link: cole a URL e o sistema emula a página dentro do VendaFlow. Anexar arquivo: suba HTML/zip e edite no emulador." · Nome* (placeholder "Ex.: Oferta Curso R$ 1.997") · Produto* (select) · Objetivo* (WhatsApp / Compra direta / Inscrição live) · Cancelar / **Criar**.

**Interações:** "Copiar" → toast "**Link copiado — disponível para o SDR e campanhas.**"; clique no card dispara toast "Ação realizada." (não há editor/preview de LP).
**Estados:** status Publicada/Rascunho; sem loading/erro.

---

## 10. Anúncios & Tráfego

**Slug/screenshots:** `anuncios.png` (Gerador), `anuncios--resultado.png`, `anuncios--gerando.png`, `anuncios--onde-achar-criativos.png`, `anuncios--biblioteca.png`, `anuncios--sugestoes-trafego.png`
**Topbar:** "Anúncios & Tráfego" + "Gerador de criativos com IA" + CTA "Gerar anúncios".

**Abas: Gerador | Onde achar criativos | Biblioteca | Sugestões de tráfego**

- **Gerador** (2 colunas): formulário à esquerda — Produto* (select) · Objetivo* (Geração de leads / Consciência / Venda) · Dor ou desejo central (placeholder "Falta de tempo do líder") · Canal* (Meta (Instagram/Facebook) / Google / TikTok) · "Framework de copy" (chips: AIDA · PAS · FAB · 4 Ps · Hook-Story-Offer) · botão gradiente "✦ Gerar anúncios". Painel direito (empty state tracejado): ícone ✦, "**A grande ideia primeiro**", "A IA cria 1 conceito central no espírito da boa publicidade + 3 ângulos com hook, headline, corpo e cena."
- **Resultado da geração:** card destacado "A GRANDE IDEIA — Você não tem falta de tempo. Tem excesso de decisão manual — a IA resolve isso." + 3 cards de ângulo ("Ângulo: tempo", "Ângulo: medo de ficar pra trás", "Ângulo: prova"), cada um com HOOK, headline, corpo AIDA/PAS/Story, "Cena: …" em itálico, CTA-pílula (ex. "Quero participar da live") e ações "Copiar / Salvar na biblioteca / Gerar criativo". Toast "**A Grande Ideia + 3 ângulos gerados.**" (geração instantânea, sem spinner).
- **Onde achar criativos:** intro "Onde achar referências que já vendem: anúncio rodando há semanas costuma ser um vencedor. Estude o raciocínio, não copie o texto."; cards-link: Meta Ad Library ("Espie anúncios ativos de concorrentes."), TikTok Creative Center ("Top Ads por nicho e região + tendências."), Pinterest Trends ("O que está subindo em busca visual."); card "**Cofre de anúncios vencedores** — Seu swipe file — organiza por hook, nicho e CTA. Alimenta a IA ao gerar." + botão "+ Salvar referência" + chips "Hook: pergunta provocativa (4)", "Nicho: liderança (7)", "CTA: urgência (3)".
- **Biblioteca:** cards de criativo: "Liderar virou outra coisa" (Meta · vinculado a "Live IA", CTR 2,4%, CPL R$ 6,80) e "Seu time precisa de você" (Meta · não vinculado, `rascunho`).
- **Sugestões de tráfego:** cards com recomendação + botão "Usar na campanha": "Líderes 30-45 · Meta — Cargos de gestão, interesse em produtividade. Verba sugerida R$ 80/dia." e "Busca Google · \"curso liderança IA\" — Intenção alta. Verba sugerida R$ 50/dia. Configure conversão de WhatsApp."

**Estados:** empty state do painel de resultado; resultado populado; sem erro/loading real.

---

## 11. Prospecção Ativa

**Slug/screenshots:** `prospeccao.png` (Fontes), `prospeccao--conectar-vibe.png`, `prospeccao--configurar-icp.png`, `prospeccao--buscar-leads.png`, `prospeccao--leads-nao-contatados.png`, `prospeccao--gerar-abordagem.png`, `prospeccao--listas.png`, `prospeccao--abordagens.png`
**Topbar:** "Prospecção Ativa" + "Encha o topo do funil com controle humano" + CTA "Buscar leads".

**Abas: Fontes | Leads não contatados | Listas | Abordagens**

- **Fontes:** banner "✦ **Vibe Prospecting** `Desconectado` — Converse com o assistente e ele encontra leads pra você dentro da plataforma. Consome créditos." + botão "**Conectar ao Vibe Prospecting**". Ao conectar: badge vira `Conectado`, toast "Conectado ao Vibe Prospecting." e aparece **chat inline do assistente**: "Oi! Sou o assistente do Vibe Prospecting. Descreva quem você procura — ex.: \"diretores de RH em São Paulo, empresas de 50 a 200 funcionários\"."
  4 cards de fonte: **Contatos que não se manifestaram** ("312 contatos receberam mensagem e nunca responderam." + "Buscar leads") · **Leads que sumiram** ("87 leads pararam de responder no meio da conversa." + "Buscar leads") · **Varredura no LinkedIn** ("Encontre líderes pelo cargo via Vibe Prospecting (consome créditos)." + "Configurar ICP") · **Importar base** ("Suba um CSV e mapeie as colunas." + "Configurar").
- **Leads não contatados:** intro "Estes leads ainda não foram contatados. Gere uma abordagem e aprove antes de disparar." + botões "**Gerar abordagem com IA**" / "Enviar para o Pipeline" + tabela NOME / EMPRESA·CARGO / ORIGEM (Vibe · LinkedIn · Importação) / DATA (Marina Rocha, Paulo Esteves, Carlos Dias, Sandra Melo). "Gerar abordagem com IA" leva à aba Abordagens.
- **Listas:** cards "Líderes RH · São Paulo — LinkedIn · 48 prospects — `Pronta`" e "Leads sumidos · Q2 — CRM · 87 prospects — `Em abordagem`".
- **Abordagens:** aviso "Disparos em massa exigem sua aprovação. Revise cada mensagem abaixo." + nota "A abordagem usa a mesma persona e contexto do SDR. Ao aprovar: o prospect vira lead, entra no Pipeline (origem Prospecção) e a IA continua a conversa a partir desta mensagem, no Inbox."; cards por prospect (avatar, nome, cargo · empresa · via Vibe, mensagem editável) + rodapé "Aprovar selecionados" / "**Aprovar e enviar**".

**Interações:** botões "Buscar leads"/"Configurar ICP" disparam toasts ("Ação realizada." / "Varredura via Vibe Prospecting — defina o ICP (consome créditos).") — sem modal de busca.
**Estados:** estado Desconectado → Conectado do Vibe; sem loading/erro.

---

## 12. Templates de E-mail

**Slug/screenshots:** `templates-email.png` (galeria), `templates-email--detalhe.png` (editor), `templates-email--novo.png`
**Topbar:** "Templates de E-mail" + "Conteúdo por IA · estrutura e marca configuráveis" + CTA "Novo template".

**Galeria:** banner verde "✓ Usando o Design System cadastrado — a IA segue marca, cores e tom ao gerar o corpo dos e-mails."; grid 3-col de cards (thumb + título + status): Confirmação de compra (● Ativo · Pós-venda) · Entrega de acesso (● Ativo · Pós-venda) · Boas-vindas (● Ativo · Automação) · Pesquisa NPS (● Ativo · Pós-venda) · Oferta complementar (upsell) (● Rascunho · Pós-venda) · Reativação (● Ativo · Automação) · Recuperação de senha (● Ativo · Sistema) · Lembrete de live (● Rascunho · Campanha).

**Editor** (tela própria; abre por card OU por "Novo template"): 
- Coluna esquerda "‹ Templates / ESTRUTURA & BRANDING": **Cabeçalho** (dropzone "Upload do logo", "Cor do header" color-swatch) · **Corpo (conteúdo por IA)** (textarea "Olá {nome}! Seu acesso ao {produto} está pronto…" + botão "✦ Gerar com IA" + chips de variáveis `{nome}` `{produto}` `{link_acesso}` `{valor}`) · **Botão / CTA** (texto "Acessar o curso", link `{link_acesso}`) · **Rodapé** (nota "Nome da empresa, endereço, redes sociais e link de descadastro* (obrigatório para não cair em spam).") · **Estilo** ("Cor primária" swatch, "Largura 600px").
- Barra superior do preview: segmented **Desktop | Mobile** · "✓ Seguindo o Design System" (verde) · botões "Testar envio" / "Salvar" / "**Ativar**".
- Preview renderizado do e-mail (header roxo "Liderança IA", título "Seu acesso está pronto 🎯", corpo com Olá **Sérgio**…, botão roxo "Acessar o curso", rodapé "Liderança IA · São Paulo, BR / Não quer mais receber? Descadastrar").

**Interações:** cards e ações disparam toast "Ação realizada."; segmented desktop/mobile.
**Estados:** Ativo/Rascunho na galeria; sem loading/erro.

---

## 13. Contexto (Arquivos de Contexto)

**Slug/screenshots:** `contexto.png`, `contexto--adicionar.png`, `contexto--chip-persona.png`, `contexto--toast-copiar.png`
**Topbar:** "Arquivos de Contexto" + "A base de conhecimento da sua IA" + CTA "Adicionar contexto".

**Layout:**
- Banner "🛡 A IA nunca inventa preço, prazo ou promessa. Se faltar contexto, ela marca como pendente e te avisa."
- **Card destaque "Design System (.md)"** (borda roxa) com badge "lido pela IA": "A IA lê este arquivo sempre que gera templates de e-mail e outras saídas visuais — para seguir sua marca, cores, tipografia e tom." + botões "**Enviar .md**" / "Baixar exemplo .md" / "Copiar template" + status "✓ design-system.md · indexado" + bloco de código com o template (`# Design System — {Projeto}` / Marca / Cores / Tipografia / Tom de voz / Componentes / Do-Don't — todos "(obrigatório)").
- 6 **cards de categoria**: Persona (tom de voz) · Oferta e preço · Objeções comuns · FAQ · Cliente ideal (ICP) · Regras comerciais.
- **Tabela de arquivos**: ARQUIVO / TIPO / VÍNCULO / STATUS — Oferta_Curso_1997.pdf (Preços · Curso IA · ● Indexado verde) · Objeções e respostas (Objeções · ● Indexado) · Tom_de_voz_Nina.txt (Tom · — · ● **Processando** âmbar) · ICP_Lideres.docx (ICP · ● **Pendente** cinza).

**Modal Adicionar contexto:** Tipo* (select: Design System (.md) / Texto livre / PDF / FAQ / Tabela de preços / Objeções / Tom de voz / ICP / Scripts) · "Vincular a (opcional)" (select: Curso IA na Liderança / Live IA na Liderança) · Conteúdo* (textarea "Cole o texto do contexto aqui, ou arraste um PDF…") · dropzone "⬆ ou arraste um PDF / arquivo de texto" · Cancelar / **Salvar e indexar**.

**Interações:** "Copiar template" → toast "**Template do Design System copiado.**"; clique em card de categoria dispara toast.
**Estados:** status de indexação em 3 níveis (Indexado / Processando / Pendente) — melhor exemplo de estados no protótipo.

---

## 14. SDR de IA

**Slug/screenshots:** `sdr-ia.png` (Persona), `sdr-ia--modos.png`, `sdr-ia--playbooks.png`, `sdr-ia--guardrails.png`, `sdr-ia--cadencias.png`, `sdr-ia--toast-salvar.png`
**Topbar:** "SDR de IA" + "Configure seu vendedor de IA" + CTA "**Salvar configuração**".

**Abas: Persona | Modos do agente | Playbooks por estágio | Guardrails | Cadências**

- **Persona:** Nome do assistente* (valor "Nina") · "Fala como" (select: Você (o dono) / O Mentor / A Equipe) · "Tom" (segmented 3: Formal / **Equilibrado** / Informal) · "Tamanho das mensagens" (segmented: **Curtas** / Médias) · toggle "Usa emojis" (off) · toggle "Ativa 24/7" (on) com hint "Desligue para limitar a uma janela de horário.". Painel direito "PRÉVIA DA MENSAGEM": balão do lead "Oi! Quanto custa o curso?" + resposta simulada "Oi! O curso \"IA na Liderança\" é R$ 1.997, em até 12x. Quer que eu te mostre o que está incluso antes?" — "Nina · IA".
- **Modos do agente:** banner "O agente pode ter até 3 modos de atuação (o \"sentimento\" e o jeito de conduzir a conversa). Configure cada modo aqui na plataforma OU anexe um arquivo markdown. Escolha qual modo fica ativo por padrão."; 3 cards: **Consultivo** (badge `Ativo`), **Direto**, **Acolhedor** — cada um com segmented "Plataforma | Markdown", inputs "Sentimento / tom" e "Como conduzir a conversa…", botão "Definir como ativo"; card Acolhedor em modo Markdown mostra arquivo "persona-modo.md · 2,4 KB · Substituir / Remover". Nota "Limite: **máximo 3 arquivos markdown** somando todos os modos."; card "Como montar o arquivo markdown" com botões "Copiar template" / "Baixar .md" + estrutura recomendada em código (`# Persona do agente…`).
- **Playbooks por estágio:** lista dos 12 estágios (bolinha de cor + nome + "SDR · objetivo" + chevron) — clique abre o mesmo slide-over de playbook do Pipeline.
- **Guardrails:** 6 linhas com toggle (todos on): Nunca inventar preço, prazo ou promessa · Só falar do produto e da oferta · Não comparar com concorrente · Não insistir com quem pediu pra parar · Respeitar teto de toques e janela de 24h · Escalar reembolso, cancelamento ou jurídico. Abaixo, "**Palavras que disparam handoff para humano**": tag-input com chips removíveis `cancelar ×` `reembolso ×` `advogado ×` + placeholder "Adicionar palavra…".
- **Cadências:** intro "Sequência de toques antes de marcar como \"Não respondeu\". Cada toque pode ser gerado com IA."; timeline de 6 toques (T+0 imediato · T+20min · T+3h · T+1d · T+3d canal E-mail · T+7d — demais WhatsApp), cada linha com botão "Gerar texto com IA"; campo "**Máximo de toques***" (valor 6).

**Interações:** "Salvar configuração" → toast "**Configuração do SDR salva.**"; segmented/toggles interativos; prévia é estática.
**Estados:** sem loading/erro; upload markdown com estado preenchido.

---

## 15. ROI & Finanças

**Slug/screenshots:** `roi-financas.png` (Visão geral), `roi-financas--despesas.png`, `roi-financas--vendas.png`, `roi-financas--lancar.png`
**Topbar:** "ROI & Finanças" + "Quanto entra, quanto sai e se dá lucro" + CTA "Lançar".

**Abas: Visão geral (ROI) | Despesas | Vendas**

- **Visão geral:** 8 stat cards em 2 linhas — INVESTIDO R$ 12.929 · FATURADO R$ 9.985 · LUCRO **R$ -2.944** (card verde-escuro, valor verde) · ROI **-23%** (card roxo) · ROAS 3,9x · CAC R$ 312 · TICKET MÉDIO R$ 1.997 · MARGEM 74%. Gráfico "Receita × Gasto" (área roxa + linha tracejada rosa, legenda "— Receita — Gasto"). Card destacado "**PREVISÃO DO MÊS** — R$ 84.300 — ROI projetado: +220% — Estimativa com base na tendência + R$ 51.922 em jogo no pipeline × taxa de conversão histórica. Não é garantia." Tabela "**ROI por campanha**": CAMPANHA / GASTO / RECEITA / ROI (verde) / ROAS — Live IA na Liderança (+338% · 4,4x), Tráfego frio · Curso (+241% · 3,4x), Remarketing carrinho (+344% · 4,4x).
- **Despesas:** botão local "Lançar despesa"; card "total gasto R$ 12.929"; 6 cards de categoria com % (Tráfego pago 63% R$ 8.200 · Software & Assinaturas 4% R$ 480 · Criativos & Conteúdo 12% R$ 1.500 · Ferramentas 5% R$ 600 · Equipe & Freelas 14% R$ 1.800 · APIs & IA 3% R$ 349); tabela DATA / CATEGORIA / DESCRIÇÃO / QUEM PAGOU / VALOR — inclui linhas automáticas "mês / APIs & IA / Claude · Anthropic (1,24M tokens) / API / R$ 99", "WhatsApp · Evolution (3.420 msgs) R$ 92", "Vibe Prospecting (140 créditos) R$ 151", "Resend (1.180 e-mails) R$ 6", "Voyage AI + Storage R2 R$ 1".
- **Vendas:** botão "Lançar venda"; cards TOTAL FATURADO R$ 9.985 · TICKET MÉDIO R$ 1.997 · card "**CONECTAR CHECKOUT** — Hotmart · Kiwify · Stripe — vendas entram sozinhas."; nota "3 formas de registrar vendas: manual · automática (todo \"Ganho\" no Pipeline vira venda) · integração (checkout)."; tabela DATA / PRODUTO / VALOR / QTD / ORIGEM (Pipeline (Ganho) · Checkout · Kiwify · Manual).

**Modal Lançar venda** (CTA "Lançar" na topbar, na aba Vendas): Produto* (select) · Valor* ("R$ 1.997") · Qtd (1) · Data* ("22/06") · Canal / origem (select: Pipeline (Ganho) / Checkout · Kiwify / Manual) · Cancelar / **Lançar**. (Na aba Despesas o CTA corresponde a "Lançar despesa".)

**Estados:** valores negativos com cor própria; sem loading/erro; sem empty.

---

## 16. Criar com IA

**Slug/screenshots:** `criar-com-ia.png`, `criar-com-ia--copy-de-anuncio.png`, `criar-com-ia--landing-completa.png`, `criar-com-ia--adicionar-template.png`, `criar-com-ia--ver-templates.png`
**Como chegar:** CTA global "Criar com IA" na topbar do Dashboard (não fica na sidebar).

**Hub:** hero card roxo: overline "CRIAR COM IA", h1 "**O que vamos criar hoje?**", sub "Tudo puxa do seu produto, contexto e templates — e o resultado vai direto pro módulo certo.", badge verde "✓ Usando o Design System cadastrado". Grid 3×2 de **cards de ação** (ícone colorido + título + descrição): Copy de anúncio ("Grande ideia + ângulos por framework.") · Seção de landing ("Headline, oferta, prova social, FAQ…") · Landing completa ("A partir de um template (obrigatório).") · Mensagem de WhatsApp ("No tom do SDR, por estágio.") · Campanha completa ("Ângulos + landing + cadência.") · E-mail de pós-venda ("Confirmação, NPS, upsell…"). Seção "**Biblioteca de templates**" + botão "Adicionar template": thumbs VSL Centralizada · Webinar / Live · Oferta direta · card tracejado "+ Adicionar template".

**Fluxo interno (ex.: Copy de anúncio):** breadcrumb "‹ Todos os tipos", h2 do tipo; "Fonte de contexto" (segmented **Usar existente** | Criar novo); Produto* (select); "Arquivos de contexto" (chips selecionáveis: "Oferta e preço ✓" "Objeções ✓" "FAQ"); Objetivo (select); Dor ou desejo; Framework (chips AIDA/PAS/FAB/4 Ps/Hook-Story-Offer); botão "✦ **Gerar**". Painel direito com empty state "**Preencha e gere** — O resultado usa seu produto e contexto reais."
**Variante Landing completa:** adiciona aviso "Selecionar um template é obrigatório. A IA só reformula conteúdo, imagens e cores — mantém a estrutura." + seletor "Template*" (VSL Centralizada / Webinar / Live / Oferta direta / + Inserir outro).

**Interações:** "Adicionar template" → toast "**Adicione um template por upload ou link.**"; "Ver templates" rola/permanece no hub.
**Estados:** empty state do painel de resultado; geração não executada neste fluxo (botão Gerar não produziu saída no walk).

---

## 17. Configurações (Credenciais & Integrações / Uso & Custos)

**Slug/screenshots:** `credenciais-integracoes.png`, `credenciais--uso-custos.png`, `menu-workspace.png`
**Como chegar:** menu do usuário na sidebar → "Credenciais & Integrações".

**Topbar:** título "**Configurações**" + "Suas chaves, segredos e domínio — o sistema se auto-configura" + CTA "Re-verificar tudo".
**Layout:** sub-navegação lateral própria (2 itens): **Credenciais & Integrações** | **Uso & Custos das APIs**.

- **Credenciais & Integrações:** banner de status "● **Tudo funcionando** — Cada login é um ambiente isolado · as chaves se auto-aplicam ao validar." + botão "Re-verificar tudo"; grade de 10 chips de status (um por grupo de credencial, bolinha verde/cinza); banner "🛡 Chaves guardadas criptografadas; nunca expostas no front. Use Mostrar / Substituir / Rotacionar em cada segredo."; mesmos 10 cards do Setup Gate, agora com status `Conectado`/`Pendente`, campos mascarados (••••) e ações por card: "**Verificar / Testar**" + links "Mostrar · Substituir · Rotacionar".
- **Uso & Custos das APIs:** banner "📈 Você usa suas próprias chaves — estes são os tokens, créditos e custos das APIs ativas neste ambiente, no mês atual." + "CUSTO ESTIMADO DO MÊS **US$ 64,82**"; **tabela de consumo** API / USO (barra de progresso colorida) / PREÇO / CUSTO · MÊS + status ● Ativo/Inativo:
  - Claude · Anthropic (IA · geração) — 1,24M / 3M tokens — US$ 3,00/1M in · US$ 15,00/1M out — **US$ 18,40**
  - Voyage AI (Embeddings · RAG) — 820K / 2M tokens — US$ 0,12/1M — US$ 0,10
  - WhatsApp · Evolution (Mensagens) — 3.420 / 10.000 msgs — US$ 0,005/msg — US$ 17,10
  - Resend (E-mail) — 1.180 / 3.000 e-mails — US$ 0,001/e-mail — US$ 1,18
  - Vibe Prospecting (Prospecção) — 140 / 500 créditos — US$ 0,20/crédito — US$ 28,00
  - Higgsfield (Criativos · imagem/vídeo) — 0 / 200 créditos — US$ 0,10/crédito — US$ 0,00 (● Inativo)
  - Storage · R2 (Arquivos) — 2,4 / 50 GB — US$ 0,015/GB·mês — US$ 0,04
  - Rodapé: "Os preços são os das próprias APIs (pago direto ao provedor). O VendaFlow não cobra markup — é self-host."

**Estados:** Conectado/Pendente por card; Ativo/Inativo por API; sem loading/erro.

---

## Tela "Design System"

Não existe como item de navegação próprio. O Design System vive como **card destacado dentro de Contexto** ("Design System (.md)", lido pela IA via RAG) e é referenciado por badges "Usando o Design System cadastrado" (Criar com IA, Templates de E-mail) e "Seguindo o Design System" (editor de e-mail).

---

## Tokens observados (extraídos por getComputedStyle no Dashboard)

Arquivo bruto: `docs/prototype-screens/dashboard-computed-styles.json`.

**Tipografia**
- Títulos/display: **Space Grotesk** — título de página 21px/600/ls -0.21px; heading do hero 27px/600; headline do login maior (~44px visual).
- Corpo/UI: **Plus Jakarta Sans** — títulos de card 14px/600; botão primário 13px/600; overline 13px/600/ls +0.52px (cor lavanda `rgb(179,136,255)`).
- Números grandes de KPI em Space Grotesk (visual); valores de tabela em Plus Jakarta Sans.
- `body` sem font própria (default Times New Roman) — as fontes são aplicadas por componente.

**Cores**
- Fundo do app: `#08080B` (`rgb(8,8,11)`), com glows radiais roxos decorativos.
- Superfície de card: `rgba(255,255,255,0.03)` + borda `1px solid rgba(255,255,255,0.08)` + inner highlight `inset 0 1px 0 rgba(255,255,255,0.06)`.
- Card hero: gradiente `linear-gradient(140deg, #1A1330, #0D0D13 60%)`.
- Sidebar/realce ativo: `rgba(139,92,246,0.14)`.
- Primário (botões/gradientes): `linear-gradient(135deg, #7C3AED, #A855F7)`; glow `0 12px 40px -12px rgba(139,92,246,0.7)` + ring `0 0 0 1px rgba(139,92,246,0.25)`.
- Texto principal: `rgb(244,244,247)`; texto secundário/placeholder: `rgb(107,107,118)`.
- Positivo/sucesso: `rgb(52,211,153)` (verde-menta); negativo: `rgb(251,113,133)` (rosa); alerta/aguardando: `rgb(251,191,36)` (âmbar, badge com fundo `rgba(251,191,36,0.12)`); acento IA/lavanda: `rgb(179,136,255)`; azul info nos banners; verde nos badges "Conectado" com borda.

**Radius**
- Cards: 15–16px; inputs/busca: ~11px; botões primários, chips, badges e pills: `999px` (full-round); modais ~16–20px.

**Sombras/efeitos**
- Botão primário com dupla sombra (ring + glow roxo).
- Cards praticamente sem drop-shadow (profundidade por borda + inner highlight).
- Modais/slide-overs sobre backdrop escurecido com leve blur do conteúdo atrás.
- Toasts em pílula com borda roxa suave.

---

## Mapa de navegação

```
Login ("Entrar na sua máquina")
 └─ Entrar → App

Setup Gate (1º acesso; bloqueia o app)
 ├─ Verificar todos → estados Pendente→Verificando…→Conectado (6/6)
 └─ Liberar sistema → Dashboard (+ toast)

Sidebar
├─ PRINCIPAL
│  ├─ Dashboard
│  │   ├─ [Receita|Despesas] (toggle gráfico)
│  │   ├─ "Ver o que precisa de você" → Pipeline (filtro Aguardando você)
│  │   ├─ "Resolver agora" → Pipeline
│  │   └─ "Cobrar" → toast
│  ├─ Pipeline
│  │   ├─ Seletor de produto (Curso/Mentoria/Comunidade/+ Novo pipeline)
│  │   ├─ Filtros: Todos | IA cuidando | Aguardando você | Temperatura
│  │   ├─ [Novo lead] / [+ Adicionar lead] → modal Novo lead (⤷ Importar em massa)
│  │   ├─ ⚙ da coluna → slide-over Playbook do estágio
│  │   └─ Card de lead → slide-over Detalhe (abas Visão geral|Conversa|Notas|Atividade;
│  │        Abrir conversa → Inbox · Assumir conversa → status Pausado)
│  ├─ Leads (somente leitura)
│  │   ├─ linha → slide-over Detalhe do lead
│  │   └─ [Abrir Pipeline] → Pipeline
│  ├─ Inbox
│  │   ├─ Filtros: Todas | IA cuidando | Aguardando você
│  │   ├─ [Nova conversa] → modal
│  │   ├─ Assumir ⇄ Devolver pra IA
│  │   ├─ ✦ Sugestão da IA → preenche composer
│  │   └─ [Mover estágio] → Pipeline
│  ├─ Campanhas
│  │   ├─ Filtros: Todas | Ativas | Pausadas | Rascunhos
│  │   ├─ [Nova campanha] → modal
│  │   └─ Card → Detalhe (abas Visão geral|Anúncios|Leads|Automação|Landing; Editar·Pausar)
│  └─ Pós-venda (abas Clientes | Fluxos de pós-venda | Acessos & uso; [Criar] → toast)
├─ CRESCIMENTO
│  ├─ Landing Pages ([Nova landing page] → modal; Copiar → toast)
│  ├─ Anúncios (abas Gerador | Onde achar criativos | Biblioteca | Sugestões de tráfego;
│  │    Gerar anúncios → Grande Ideia + 3 ângulos)
│  ├─ Prospecção (abas Fontes | Leads não contatados | Listas | Abordagens;
│  │    Conectar ao Vibe → chat inline)
│  └─ Templates de E-mail (galeria → Editor com preview Desktop|Mobile)
├─ INTELIGÊNCIA
│  ├─ Contexto (card Design System .md; [Adicionar contexto] → modal)
│  └─ SDR de IA (abas Persona | Modos do agente | Playbooks | Guardrails | Cadências)
├─ RESULTADO
│  └─ ROI & Finanças (abas Visão geral | Despesas | Vendas; [Lançar] → modal Lançar venda/despesa)
├─ Topbar global: busca ⌘K (inerte) · sino (inerte) · CTA contextual ("Criar com IA" → hub
│    com 6 fluxos + Biblioteca de templates)
└─ Card "Você / Workspace"
    ├─ Credenciais & Integrações → Configurações (subabas Credenciais | Uso & Custos das APIs)
    └─ Sair → Login
```

---

## Observações (problemas e lacunas encontrados no walk)

1. **Busca/⌘K e sino de notificações são decorativos** — nem clique nem `Ctrl/⌘+K` abrem qualquer painel.
2. **Drag & drop no kanban não foi reproduzível via automação** (mouse down→move→up não move o card; `pipeline--drag-em-andamento/resultado.png`). Não dá para confirmar se há DnD implementado para usuário real.
3. **Slide-overs não fecham com Esc** — só pelo X ou botão Cancelar (o walk travou nisso a primeira vez; corrigido fechando pelo X/backdrop).
4. **Dropdown do seletor de produto não fecha sozinho** ao interagir com outros elementos (ficou aberto sobre a tela em alguns screenshots, ex.: `pipeline--filtro-temperatura.png`, fundo de `pipeline--novo-lead.png`).
5. **Envio de mensagem no Inbox não insere o balão** no thread (composer mantém o texto).
6. **"Mover estágio" (Inbox) navega para o Pipeline** em vez de abrir um seletor de estágio.
7. Vários CTAs são **stubs com toast genérico "Ação realizada."** (Pós-venda "Criar", clique em card de LP, categorias do Contexto, "Buscar leads"/"Configurar" da Prospecção, ações do editor de e-mail).
8. **Título da topbar em Pós-venda é "Sales4U"** (inconsistente com o padrão de título da tela).
9. **Estados ausentes de forma geral:** não há loading real (exceto "Verificando…" no gate), nenhum estado de erro (verificações sempre passam, formulários sem validação visível) e quase nenhum empty state (dados demo sempre populados; exceções: colunas vazias do kanban, painel "Preencha e gere" do Criar com IA e "A grande ideia primeiro" nos Anúncios).
10. **"Esqueci minha senha" não tem ação**; login aceita qualquer credencial.
11. A tela **"Design System" não existe** como módulo próprio — é um card dentro de Contexto (ver seção dedicada).
12. `busca-command-palette.png`, `topbar-icone.png` e `dashboard--ctrl-k.png` registram justamente a ausência de resposta desses controles; `apos-liberar.png` é o Dashboard logo após liberar o gate.
13. O toast global persiste alguns segundos e aparece em screenshots subsequentes (ex.: "Ambiente pronto. Bora vender." no `login.png`) — comportamento do protótipo, não erro do walk.
