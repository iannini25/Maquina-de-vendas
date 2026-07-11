import type { PrismaClient } from "@prisma/client";

/**
 * Dados de demonstração do workspace "Liderança IA":
 * produto R$ 1.997, 10 leads com conversas coerentes, campanhas, landing
 * com variantes, despesas, vendas, persona, contexto e templates.
 */

interface SeedContext {
  workspaceId: string;
  userId: string;
  stageIdByKey: Map<string, string>;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

function daysAgo(days: number, offsetMs = 0): Date {
  return new Date(Date.now() - days * DAY + offsetMs);
}

export async function seedDemoData(prisma: PrismaClient, ctx: SeedContext): Promise<void> {
  const { workspaceId, userId, stageIdByKey } = ctx;
  const stage = (key: string): string => {
    const id = stageIdByKey.get(key);
    if (!id) throw new Error(`Estágio seed não encontrado: ${key}`);
    return id;
  };

  // ── Produto ────────────────────────────────────────────────────────────
  const offer = await prisma.productOffer.create({
    data: {
      workspaceId,
      name: "Curso IA na Liderança",
      priceCents: 199_700,
      currency: "BRL",
      bonuses: [
        "Comunidade fechada de líderes",
        "Biblioteca de prompts executivos",
        "2 encontros ao vivo de mentoria",
      ],
      guarantee: "7 dias de garantia incondicional",
      promises: [
        "Domine IA aplicada à gestão em 6 semanas",
        "Ganhe 5h por semana automatizando decisões operacionais",
      ],
      restrictions: ["Não prometemos resultado financeiro específico"],
      accessLinks: [{ label: "Área de membros", url: "https://membros.liderancaia.com.br" }],
      upsellWindowDays: 14,
    },
  });

  // ── Persona + modos ────────────────────────────────────────────────────
  await prisma.agentPersona.create({
    data: {
      workspaceId,
      name: "Sofia",
      speaksAs: "Sofia, consultora do time Liderança IA",
      tone: "Calorosa, direta e consultiva. Fala como gente, não como robô.",
      emojis: true,
      msgLength: "short",
      activeHours: { start: "08:00", end: "21:00", days: [1, 2, 3, 4, 5, 6] },
      icpText:
        "Gestores e líderes (coordenação a diretoria) de empresas de 10-500 pessoas, pressionados a fazer mais com menos, curiosos sobre IA mas sem tempo para aprender sozinhos.",
      commercialRules:
        "Preço fechado R$ 1.997 à vista ou 12x de R$ 197. Desconto máximo autorizado: 10% (somente com aprovação). Nunca prometer resultado financeiro.",
    },
  });

  await prisma.agentMode.createMany({
    data: [
      {
        workspaceId,
        slot: 1,
        name: "Vendedor consultivo",
        source: "PLATFORM",
        isActive: true,
        configJson: {
          style: "consultivo",
          description: "Diagnóstico antes de oferta; conduz por perguntas.",
        },
      },
      {
        workspaceId,
        slot: 2,
        name: "Lançamento (live)",
        source: "PLATFORM",
        isActive: false,
        configJson: {
          style: "lancamento",
          description: "Foco em levar para a live e converter no pitch.",
        },
      },
    ],
  });

  // ── Landing page com variantes ─────────────────────────────────────────
  const landing = await prisma.landingPage.create({
    data: {
      workspaceId,
      name: "IA na Liderança — Página principal",
      slug: "ia-na-lideranca",
      goal: "WHATSAPP",
      kind: "BUILDER",
      productOfferId: offer.id,
      status: "PUBLISHED",
      publishedAt: daysAgo(21),
    },
  });

  await prisma.landingVariant.createMany({
    data: [
      {
        landingPageId: landing.id,
        name: "A — Dor do líder",
        deviceTarget: "ANY",
        weight: 50,
        metrics: { views: 1240, ctaClicks: 186, signups: 92 },
        blocks: [
          {
            kind: "hero",
            headline: "Seu time usa IA. E você, líder?",
            sub: "O método prático para gestores dominarem IA aplicada — sem virar programador.",
            cta: "Quero falar no WhatsApp",
          },
          {
            kind: "pain",
            items: [
              "Decisões operacionais comem sua agenda",
              "Relatórios que ninguém lê",
              "Time esperando resposta sua para tudo",
            ],
          },
          { kind: "offer", priceCents: 199_700, guarantee: "7 dias de garantia" },
        ],
      },
      {
        landingPageId: landing.id,
        name: "B — Promessa de tempo",
        deviceTarget: "MOBILE",
        weight: 50,
        metrics: { views: 830, ctaClicks: 141, signups: 71 },
        blocks: [
          {
            kind: "hero",
            headline: "5 horas por semana de volta na sua agenda",
            sub: "IA na Liderança: automatize o operacional e lidere o estratégico.",
            cta: "Começar pelo WhatsApp",
          },
          { kind: "offer", priceCents: 199_700, guarantee: "7 dias de garantia" },
        ],
      },
    ],
  });

  // ── Campanhas ──────────────────────────────────────────────────────────
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId,
      name: "Sempre-on Meta — IA na Liderança",
      type: "STANDARD",
      objective: "Gerar conversas qualificadas no WhatsApp",
      channel: "Meta Ads",
      audience: "Gestores 28-55, interesses: gestão, produtividade, IA",
      budgetCents: 300_000,
      cplTargetCents: 1_200,
      status: "ACTIVE",
      startsAt: daysAgo(30),
      productOfferId: offer.id,
      landingPageId: landing.id,
    },
  });

  await prisma.campaign.create({
    data: {
      workspaceId,
      name: "Lançamento — Live 'O Líder do Futuro'",
      type: "LAUNCH_LIVE",
      objective: "Captação para live gratuita + pitch",
      channel: "Meta Ads + E-mail",
      audience: "Base + lookalike de compradores",
      budgetCents: 150_000,
      status: "DRAFT",
      liveAt: new Date(Date.now() + 12 * DAY),
      warmupEnabled: true,
      remindersEnabled: true,
      productOfferId: offer.id,
      landingPageId: landing.id,
    },
  });

  await prisma.ad.createMany({
    data: [
      {
        workspaceId,
        campaignId: campaign.id,
        angle: "Dor de agenda",
        hook: "Sua agenda virou um call center?",
        headline: "Líderes estão recuperando 5h/semana com IA",
        body: "Enquanto você aprova tarefa por tarefa, líderes treinados em IA automatizam o operacional e focam no estratégico. O método IA na Liderança mostra o caminho em 6 semanas.",
        cta: "Quero meu diagnóstico",
        framework: "PAS",
        channel: "Meta",
        status: "ACTIVE",
        savedToLibrary: true,
        metrics: { impressions: 48200, clicks: 1310, cplCents: 980 },
      },
      {
        workspaceId,
        campaignId: campaign.id,
        angle: "Autoridade",
        hook: "O que separa líderes que usam IA dos que só falam dela",
        headline: "IA aplicada à gestão, sem jargão técnico",
        body: "Método passo a passo para transformar IA em decisões melhores, reuniões mais curtas e time mais autônomo.",
        cta: "Conhecer o método",
        framework: "AIDA",
        channel: "Meta",
        status: "PAUSED",
        savedToLibrary: true,
        metrics: { impressions: 21500, clicks: 402, cplCents: 1650 },
      },
    ],
  });

  // ── Leads (10) + conversas ─────────────────────────────────────────────
  const leads: Array<{
    name: string;
    phone: string;
    email?: string;
    stageKey: string;
    temperature: "COLD" | "WARM" | "HOT";
    score: number;
    valueCents?: number;
    source: string;
    nextActionText?: string;
    aiStatus?: "RUNNING" | "WAITING_HUMAN" | "PAUSED";
    lastDays: number;
    messages: Array<{ dir: "IN" | "OUT"; author: "LEAD" | "AI" | "HUMAN"; text: string; minAgo: number }>;
  }> = [
    {
      name: "Marcos Tavares",
      phone: "5511987654321",
      email: "marcos.tavares@empresa.com.br",
      stageKey: "em-negociacao",
      temperature: "HOT",
      score: 86,
      valueCents: 199_700,
      source: "landing",
      nextActionText: "Aguardando aprovação do link de pagamento com 10% off",
      aiStatus: "WAITING_HUMAN",
      lastDays: 0,
      messages: [
        { dir: "IN", author: "LEAD", text: "Oi! Vi a página de vocês, queria entender como funciona o curso", minAgo: 200 },
        { dir: "OUT", author: "AI", text: "Oi Marcos! Sou a Sofia, do time Liderança IA 😊 Que bom te ver por aqui. Me conta: hoje você lidera um time de quantas pessoas?", minAgo: 197 },
        { dir: "IN", author: "LEAD", text: "Lidero 18 pessoas numa operação de logística. Meu problema é tempo, vivo apagando incêndio", minAgo: 180 },
        { dir: "OUT", author: "AI", text: "Te entendo demais — operação puxa a gente pro operacional o dia todo. É exatamente o perfil que mais destrava com o método: a gente te ensina a montar assistentes de IA pros rituais repetitivos (relatório, follow-up, triagem). Quer que eu te mostre como funciona na prática?", minAgo: 176 },
        { dir: "IN", author: "LEAD", text: "Quero sim. Quanto custa?", minAgo: 90 },
        { dir: "OUT", author: "AI", text: "O IA na Liderança completo é R$ 1.997 (ou 12x de R$ 197), com 7 dias de garantia incondicional. Inclui a comunidade de líderes e 2 mentorias ao vivo. Faz sentido pra você começar essa semana?", minAgo: 87 },
        { dir: "IN", author: "LEAD", text: "Fechado o valor consigo sim. Tem algum desconto à vista?", minAgo: 25 },
      ],
    },
    {
      name: "Patrícia Lemes",
      phone: "5511976543210",
      email: "patricia.lemes@gmail.com",
      stageKey: "interessado",
      temperature: "HOT",
      score: 74,
      valueCents: 199_700,
      source: "landing",
      nextActionText: "Enviar caso de cliente de RH (objeção: 'será que funciona pra minha área?')",
      lastDays: 0,
      messages: [
        { dir: "IN", author: "LEAD", text: "Olá, me cadastrei na página. Sou gerente de RH, isso serve pra minha área?", minAgo: 300 },
        { dir: "OUT", author: "AI", text: "Oi Patrícia! Serve — e RH é das áreas que mais aproveita: triagem de currículo, análise de clima, comunicação interna… Me conta o que mais toma seu tempo hoje?", minAgo: 296 },
        { dir: "IN", author: "LEAD", text: "Recrutamento com certeza. E os relatórios pro board", minAgo: 240 },
        { dir: "OUT", author: "AI", text: "Perfeito. No módulo 3 você monta um copiloto de recrutamento e no 5 um gerador de relatório executivo. Com a garantia de 7 dias dá pra testar sem risco. Quer o link pra garantir sua vaga?", minAgo: 236 },
        { dir: "IN", author: "LEAD", text: "Deixa eu ver com meu financeiro e te falo, ok?", minAgo: 120 },
      ],
    },
    {
      name: "Rafael Andrade",
      phone: "5521998877665",
      stageKey: "qualificado",
      temperature: "WARM",
      score: 58,
      source: "prospeccao",
      nextActionText: "Cadência T+3h: mandar prova social de operação",
      lastDays: 1,
      messages: [
        { dir: "OUT", author: "AI", text: "Oi Rafael! Sou a Sofia, da Liderança IA. Vi que você lidera a operação da TransLog — muitos gestores de logística estão usando IA pra cortar 30% do tempo de gestão de rotina. Vale uma conversa rápida?", minAgo: 2000 },
        { dir: "IN", author: "LEAD", text: "Oi Sofia. Pode falar mais? Como assim IA na rotina?", minAgo: 1600 },
        { dir: "OUT", author: "AI", text: "Claro! Pensa nos seus rituais: passagem de turno, relatório de ocorrência, cobrança de indicador. A gente ensina o líder a montar assistentes que fazem o rascunho de tudo isso. Você revisa e decide. Hoje quanto tempo você gasta nisso por dia?", minAgo: 1590 },
        { dir: "IN", author: "LEAD", text: "Umas 3h fácil", minAgo: 1500 },
      ],
    },
    {
      name: "Juliana Costa",
      phone: "5531988776655",
      email: "juliana.costa@tech.io",
      stageKey: "pos-venda",
      temperature: "HOT",
      score: 95,
      valueCents: 199_700,
      source: "landing",
      nextActionText: "Monitor de uso: acessou 2x esta semana — enviar guia do dia 2",
      lastDays: 2,
      messages: [
        { dir: "IN", author: "LEAD", text: "Consegui acessar! Já comecei o módulo 1 🎉", minAgo: 3000 },
        { dir: "OUT", author: "AI", text: "Aeee Juliana! 🎉 O módulo 1 termina com o mapa da sua semana — faz ele com calma que os próximos módulos usam. Qualquer dúvida me chama por aqui!", minAgo: 2995 },
      ],
    },
    {
      name: "Eduardo Pinheiro",
      phone: "5541977665544",
      stageKey: "em-conversa",
      temperature: "WARM",
      score: 45,
      source: "landing",
      nextActionText: "Perguntou de tempo de dedicação — respondido; aguardando retorno",
      lastDays: 0,
      messages: [
        { dir: "IN", author: "LEAD", text: "Quantas horas por semana precisa dedicar?", minAgo: 400 },
        { dir: "OUT", author: "AI", text: "Oi Eduardo! O método foi desenhado pra agenda de líder: 2h por semana de conteúdo + aplicação direto no seu trabalho (que você já faria de qualquer jeito). Em 6 semanas você fecha o ciclo. Hoje qual sua maior dor de gestão?", minAgo: 396 },
      ],
    },
    {
      name: "Camila Souza",
      phone: "5551966554433",
      email: "camila.souza@varejo.com",
      stageKey: "novo-lead",
      temperature: "COLD",
      score: 15,
      source: "landing",
      nextActionText: "Boas-vindas enviadas; aguardando primeira resposta",
      lastDays: 0,
      messages: [
        { dir: "OUT", author: "AI", text: "Oi Camila! Sou a Sofia, do time Liderança IA 😊 Vi seu cadastro na nossa página. Pra te direcionar melhor: você lidera time hoje ou está chegando lá?", minAgo: 45 },
      ],
    },
    {
      name: "Bruno Carvalho",
      phone: "5561955443322",
      stageKey: "nao-respondeu",
      temperature: "COLD",
      score: 22,
      source: "landing",
      nextActionText: "Última tentativa agendada para amanhã 10h",
      lastDays: 6,
      messages: [
        { dir: "OUT", author: "AI", text: "Oi Bruno! Sofia da Liderança IA — vi seu interesse no curso. Posso te mandar um resumo de 1 minuto de como funciona?", minAgo: 9000 },
        { dir: "OUT", author: "AI", text: "Bruno, sem pressão nenhuma — se IA na gestão ainda for tema pra você, tenho um material rápido que resolve as 3 dúvidas mais comuns. Te mando?", minAgo: 4300 },
      ],
    },
    {
      name: "João Mendonça",
      phone: "5571944332211",
      email: "joao.mendonca@ind.com.br",
      stageKey: "ganho",
      temperature: "HOT",
      score: 100,
      valueCents: 199_700,
      source: "prospeccao",
      nextActionText: "Cliente ativo — janela de upsell abre em 8 dias",
      lastDays: 6,
      messages: [
        { dir: "IN", author: "LEAD", text: "Pagamento feito! Recebi o acesso por email, obrigado Sofia", minAgo: 8700 },
        { dir: "OUT", author: "AI", text: "Bem-vindo a bordo, João! 🚀 Seu acesso: https://membros.liderancaia.com.br — começa pelo módulo 1 que em 40min você já sai com seu primeiro assistente montado. Estou por aqui!", minAgo: 8695 },
      ],
    },
    {
      name: "Larissa Dias",
      phone: "5581933221100",
      stageKey: "reativar-depois",
      temperature: "COLD",
      score: 30,
      source: "landing",
      nextActionText: "Reativação automática em 24 dias (pediu contato em agosto)",
      aiStatus: "PAUSED",
      lastDays: 12,
      messages: [
        { dir: "IN", author: "LEAD", text: "Gente, adorei a proposta mas estou fechando trimestre. Me procurem em agosto?", minAgo: 17300 },
        { dir: "OUT", author: "AI", text: "Combinado, Larissa! Te procuro em agosto com calma. Boa reta final de trimestre 💪", minAgo: 17295 },
      ],
    },
    {
      name: "Sérgio Almeida",
      phone: "5511922110099",
      email: "sergio.almeida@consultoria.com",
      stageKey: "perdido",
      temperature: "COLD",
      score: 35,
      source: "prospeccao",
      nextActionText: undefined,
      lastDays: 9,
      messages: [
        { dir: "IN", author: "LEAD", text: "Olhei aqui e vou seguir com um treinamento interno que a empresa já contratou. Obrigado!", minAgo: 13000 },
        { dir: "OUT", author: "AI", text: "Entendido, Sérgio — obrigado por avisar! Se em algum momento quiser comparar abordagens, estou por aqui. Sucesso com o treinamento! 🙌", minAgo: 12995 },
      ],
    },
  ];

  const leadIdByPhone = new Map<string, string>();

  for (const item of leads) {
    const lastInteraction = daysAgo(item.lastDays, -(item.messages[item.messages.length - 1]?.minAgo ?? 0) * 0);
    const lead = await prisma.lead.create({
      data: {
        workspaceId,
        name: item.name,
        phone: item.phone,
        email: item.email,
        source: item.source,
        campaignId: item.source === "landing" ? campaign.id : undefined,
        landingPageId: item.source === "landing" ? landing.id : undefined,
        stageId: stage(item.stageKey),
        temperature: item.temperature,
        score: item.score,
        valueCents: item.valueCents,
        ownerId: userId,
        lastInteractionAt: lastInteraction,
        nextActionText: item.nextActionText,
        aiStatus: item.aiStatus ?? "RUNNING",
        lostReason: item.stageKey === "perdido" ? "Escolheu concorrente/treinamento interno" : undefined,
        prospectOrigin: item.source === "prospeccao" ? "Lista LinkedIn — líderes de operação" : undefined,
        tags: item.temperature === "HOT" ? ["prioridade"] : [],
      },
    });
    leadIdByPhone.set(item.phone, lead.id);

    const conversation = await prisma.conversation.create({
      data: {
        workspaceId,
        leadId: lead.id,
        channel: "WHATSAPP",
        externalId: `${item.phone}@s.whatsapp.net`,
        state: item.aiStatus === "WAITING_HUMAN" ? "HUMAN" : "BOT",
        lastMessageAt: new Date(Date.now() - (item.messages[item.messages.length - 1]?.minAgo ?? 60) * MIN),
        unreadCount: item.messages[item.messages.length - 1]?.dir === "IN" ? 1 : 0,
      },
    });

    for (const msg of item.messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: msg.dir,
          authorType: msg.author,
          kind: "TEXT",
          content: { text: msg.text },
          status: msg.dir === "OUT" ? "READ" : "DELIVERED",
          sentAt: new Date(Date.now() - msg.minAgo * MIN),
          createdAt: new Date(Date.now() - msg.minAgo * MIN),
        },
      });
    }

    await prisma.eventLog.create({
      data: {
        workspaceId,
        actorType: "SYSTEM",
        type: "lead.created",
        entity: "Lead",
        entityId: lead.id,
        data: { name: item.name, source: item.source },
        createdAt: daysAgo(item.lastDays + 1),
      },
    });
  }

  // ── Venda do João (Ganho) + acesso ─────────────────────────────────────
  const joaoId = leadIdByPhone.get("5571944332211")!;
  const order = await prisma.order.create({
    data: {
      workspaceId,
      leadId: joaoId,
      productOfferId: offer.id,
      valueCents: 199_700,
      qty: 1,
      channel: "whatsapp",
      source: "PIPELINE",
      status: "PAID",
      paidAt: daysAgo(6),
    },
  });
  await prisma.accessGrant.create({
    data: {
      workspaceId,
      orderId: order.id,
      leadId: joaoId,
      url: "https://membros.liderancaia.com.br",
      trackedToken: "demo-joao-a1b2c3d4",
      firstAccessAt: daysAgo(5),
      lastActivityAt: daysAgo(1),
      totalActiveSeconds: 7_800,
      status: "ACTIVE",
      idleThresholdDays: 5,
    },
  });

  // Venda da Juliana (webhook Hotmart)
  const julianaId = leadIdByPhone.get("5531988776655")!;
  const orderJuliana = await prisma.order.create({
    data: {
      workspaceId,
      leadId: julianaId,
      productOfferId: offer.id,
      valueCents: 199_700,
      qty: 1,
      channel: "hotmart",
      source: "WEBHOOK",
      provider: "HOTMART",
      externalId: "HP1723456789",
      status: "PAID",
      paidAt: daysAgo(3),
    },
  });
  await prisma.accessGrant.create({
    data: {
      workspaceId,
      orderId: orderJuliana.id,
      leadId: julianaId,
      url: "https://membros.liderancaia.com.br",
      trackedToken: "demo-juliana-e5f6g7h8",
      firstAccessAt: daysAgo(2),
      lastActivityAt: daysAgo(2, 4 * HOUR),
      totalActiveSeconds: 3_200,
      status: "ACTIVE",
      idleThresholdDays: 5,
    },
  });

  // ── Despesas ───────────────────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        workspaceId,
        category: "PAID_TRAFFIC",
        valueCents: 184_500,
        description: "Meta Ads — sempre-on junho/julho",
        paidBy: "Cartão da empresa",
        date: daysAgo(8),
        campaignId: campaign.id,
      },
      {
        workspaceId,
        category: "SOFTWARE",
        valueCents: 19_900,
        description: "Ferramenta de edição de criativos",
        paidBy: "Cartão da empresa",
        date: daysAgo(15),
      },
      {
        workspaceId,
        category: "CREATIVE",
        valueCents: 45_000,
        description: "Pacote de criativos com editor freelancer",
        paidBy: "Pix",
        date: daysAgo(20),
      },
      {
        workspaceId,
        category: "TOOLS",
        valueCents: 9_700,
        description: "Créditos de API (IA)",
        paidBy: "Cartão da empresa",
        date: daysAgo(5),
      },
    ],
  });

  // ── Contexto (RAG) ─────────────────────────────────────────────────────
  await prisma.contextFile.createMany({
    data: [
      {
        workspaceId,
        type: "PRICING",
        name: "Preços e condições",
        rawText:
          "Curso IA na Liderança: R$ 1.997 à vista ou 12x de R$ 197 no cartão. Garantia incondicional de 7 dias. Desconto máximo autorizado: 10% à vista, somente com aprovação do gestor. Não parcelamos no boleto.",
        status: "INDEXED",
        productOfferId: offer.id,
      },
      {
        workspaceId,
        type: "FAQ",
        name: "Perguntas frequentes",
        rawText:
          "Quanto tempo preciso dedicar? 2h/semana por 6 semanas. Preciso saber programar? Não — o método é para líderes, sem código. Serve para minha área? Funciona para qualquer área de gestão: operações, RH, comercial, financeiro. Tem certificado? Sim, certificado de conclusão de 40h. Como acesso? Área de membros com acesso por 12 meses.",
        status: "INDEXED",
        productOfferId: offer.id,
      },
      {
        workspaceId,
        type: "OBJECTIONS",
        name: "Quebra de objeções",
        rawText:
          "'Não tenho tempo': o curso existe exatamente para devolver tempo; 2h/semana com aplicação imediata. 'Está caro': compare com o custo de 5h/semana do seu salário de líder perdidas em operacional. 'Será que funciona pra mim?': garantia de 7 dias — teste o módulo 1 sem risco. 'Vou esperar': cada mês sem automatizar custa horas de agenda; a turma fecha e o preço sobe na próxima.",
        status: "INDEXED",
        productOfferId: offer.id,
      },
      {
        workspaceId,
        type: "DESIGN_SYSTEM",
        name: "Design System da marca (.md)",
        rawText:
          "# Design System — Liderança IA\n\n## Cores\n- Fundo: #08080B\n- Roxo primário: #7C3AED → #A855F7 (gradiente)\n- Acento: #B388FF\n- Sucesso: #34D399\n\n## Tipografia\n- Títulos: Space Grotesk (semibold)\n- Corpo: Plus Jakarta Sans\n\n## Tom de voz\n- Direto, caloroso, sem jargão técnico\n- Frases curtas. Benefício antes de recurso.\n- Nunca prometer resultado financeiro específico.",
        status: "INDEXED",
      },
    ],
  });

  // ── Templates de e-mail seed ───────────────────────────────────────────
  const emailTemplates: Array<{ name: string; purpose: "PURCHASE_CONFIRM" | "ACCESS" | "WELCOME" | "NPS" | "UPSELL" | "REACTIVATION" | "PASSWORD" | "LIVE_REMINDER"; bodyText: string }> = [
    {
      name: "Confirmação de compra",
      purpose: "PURCHASE_CONFIRM",
      bodyText:
        "Olá {nome}!\n\nSua compra do **{produto}** foi confirmada. 🎉\n\nValor: {valor}\nData: {data}\n\nSeu acesso chega em instantes no próximo e-mail. Qualquer coisa, é só responder aqui.",
    },
    {
      name: "Entrega de acesso",
      purpose: "ACCESS",
      bodyText:
        "Olá {nome}!\n\nSeu acesso ao **{produto}** está liberado.\n\nComece pelo módulo 1 — em 40 minutos você já sai com o primeiro assistente montado.",
    },
    {
      name: "Boas-vindas",
      purpose: "WELCOME",
      bodyText:
        "Que bom ter você aqui, {nome}!\n\nNos próximos dias vou te mandar o essencial para aproveitar o **{produto}** desde o primeiro módulo. Sem spam — só o que ajuda.",
    },
    {
      name: "Pesquisa NPS",
      purpose: "NPS",
      bodyText:
        "Oi {nome},\n\nUma pergunta rápida: de 0 a 10, quanto você recomendaria o **{produto}** para outro líder?\n\nResponda este e-mail com a nota — leva 5 segundos e melhora o curso para todo mundo.",
    },
    {
      name: "Upsell — mentoria",
      purpose: "UPSELL",
      bodyText:
        "Oi {nome},\n\nVi que você está avançando bem no **{produto}**. Para quem quer acelerar, abrimos vagas da mentoria em grupo — implementação guiada, ao vivo, no seu contexto.\n\nQuer os detalhes?",
    },
    {
      name: "Reativação",
      purpose: "REACTIVATION",
      bodyText:
        "Oi {nome}, tudo bem?\n\nFaz um tempo que conversamos sobre o **{produto}**. Abrimos uma nova turma com bônus de boas-vindas — se o momento agora for melhor, me responde que te conto tudo.",
    },
    {
      name: "Recuperação de senha",
      purpose: "PASSWORD",
      bodyText:
        "Olá {nome},\n\nRecebemos um pedido para redefinir sua senha. Use o botão abaixo — o link vale por 1 hora.\n\nSe não foi você, ignore este e-mail.",
    },
    {
      name: "Lembrete de live",
      purpose: "LIVE_REMINDER",
      bodyText:
        "{nome}, é hoje!\n\nNossa live **{produto}** começa às {data}. Separa 1h, papel e caneta — vai ter método na prática e sessão de perguntas.\n\nTe espero lá!",
    },
  ];

  for (const template of emailTemplates) {
    await prisma.emailTemplate.create({
      data: {
        workspaceId,
        name: template.name,
        purpose: template.purpose,
        bodySource: "MANUAL",
        bodyText: template.bodyText,
        status: "ACTIVE",
        structure: {
          headerTitle: "Liderança IA",
          buttons:
            template.purpose === "ACCESS" || template.purpose === "PASSWORD"
              ? [{ label: template.purpose === "ACCESS" ? "Acessar área de membros" : "Redefinir senha", url: "{link_acesso}" }]
              : [],
          footerText: "Liderança IA — IA aplicada à gestão",
          style: { accentColor: "#8B5CF6", backgroundColor: "#08080B" },
        },
      },
    });
  }

  // ── Templates de landing builtin ───────────────────────────────────────
  await prisma.template.createMany({
    data: [
      {
        workspaceId,
        kind: "LANDING",
        name: "Captura direta (WhatsApp)",
        source: "BUILTIN",
        data: {
          blocks: ["hero", "pain", "method", "proof", "offer", "faq", "cta-whatsapp"],
          description: "Página enxuta focada em iniciar conversa no WhatsApp.",
        },
      },
      {
        workspaceId,
        kind: "LANDING",
        name: "Página de vendas completa",
        source: "BUILTIN",
        data: {
          blocks: ["hero", "pain", "story", "method", "modules", "bonus", "proof", "guarantee", "offer", "faq", "cta-buy"],
          description: "AIDA completa para venda direta com checkout.",
        },
      },
      {
        workspaceId,
        kind: "LANDING",
        name: "Inscrição em live",
        source: "BUILTIN",
        data: {
          blocks: ["hero-event", "what-you-learn", "who", "signup-form", "countdown"],
          description: "Captação para evento ao vivo com formulário.",
        },
      },
    ],
  });

  // ── Prospecção ─────────────────────────────────────────────────────────
  const prospectList = await prisma.prospectList.create({
    data: { workspaceId, name: "Líderes de operação — LinkedIn", source: "LINKEDIN" },
  });
  await prisma.prospect.createMany({
    data: [
      { listId: prospectList.id, name: "Fernanda Rocha", company: "LogPrime", role: "Gerente de Operações", phone: "5511911112222", contacted: false },
      { listId: prospectList.id, name: "Tiago Nunes", company: "Grupo Vetor", role: "Coordenador de PCP", phone: "5519933334444", contacted: false },
      { listId: prospectList.id, name: "Aline Barros", company: "Nexa Retail", role: "Head de CX", email: "aline@nexa.com", contacted: false },
    ],
  });

  // ── Eventos financeiros no log ─────────────────────────────────────────
  await prisma.eventLog.createMany({
    data: [
      {
        workspaceId,
        actorType: "AI",
        type: "deal.won",
        entity: "Lead",
        entityId: joaoId,
        data: { valueCents: 199_700 },
        createdAt: daysAgo(6),
      },
      {
        workspaceId,
        actorType: "WEBHOOK",
        type: "order.paid",
        entity: "Order",
        entityId: orderJuliana.id,
        data: { provider: "HOTMART", valueCents: 199_700 },
        createdAt: daysAgo(3),
      },
    ],
  });
}
