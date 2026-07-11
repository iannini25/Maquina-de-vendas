import type { FlowDefinition } from "./flow-types.js";

/**
 * Biblioteca de flows seed (PT-BR), prontos para semear AutomationFlow.
 *
 * Variáveis entre chaves são resolvidas pelo chamador na hora do envio:
 * {nome}, {produto}, {origem}, {link_acesso}, {primeiro_passo},
 * {oferta_upsell}, {novidade}, {nome_live}, {hora_live}, {link_live}.
 */

/** Boas-vindas genérica para lead novo (qualquer origem). */
export const flowBoasVindasLeadNovo: FlowDefinition = {
  name: "Boas-vindas: lead novo",
  trigger: { kind: "lead_created" },
  steps: [
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Oi, {nome}! Que bom ter você por aqui. Eu cuido do atendimento do {produto} e estou aqui para te ajudar de verdade. Me conta: o que te fez buscar a gente hoje?",
    },
    { kind: "wait", minutes: 20 },
    {
      kind: "branch_replied",
      ifReplied: [{ kind: "end" }],
      ifNot: [
        {
          kind: "send_message",
          channel: "WHATSAPP",
          template:
            "{nome}, sei que a correria é grande. Se preferir, me diz em uma palavra o que você procura no {produto} e eu já te trago o caminho mais curto.",
        },
        { kind: "wait", minutes: 1440 },
        {
          kind: "send_message",
          channel: "WHATSAPP",
          template:
            "Não quero encher sua caixa, {nome} — só garantir que você não fique com dúvida sem resposta. Quando quiser retomar, manda um oi que eu continuo de onde paramos.",
        },
      ],
    },
    { kind: "end" },
  ],
};

/**
 * Boas-vindas personalizada por origem do lead (ex.: "Instagram",
 * "indicação", "página de captura"). A origem entra no trigger (para o
 * roteador escolher o flow certo) e na primeira mensagem.
 */
export function flowBoasVindasPorOrigem(origem: string): FlowDefinition {
  return {
    name: `Boas-vindas: lead novo (${origem})`,
    trigger: { kind: "lead_created", source: origem },
    steps: [
      {
        kind: "send_message",
        channel: "WHATSAPP",
        template: `Oi, {nome}! Vi que você chegou até o {produto} pelo ${origem} — obrigado pela confiança. Para eu te ajudar do jeito certo: o que você quer resolver primeiro?`,
      },
      { kind: "wait", minutes: 20 },
      {
        kind: "branch_replied",
        ifReplied: [{ kind: "end" }],
        ifNot: [
          {
            kind: "send_message",
            channel: "WHATSAPP",
            template:
              "{nome}, ainda estou por aqui. Se estiver sem tempo agora, me diz só o assunto que eu já deixo tudo pronto para quando você voltar.",
          },
          { kind: "wait", minutes: 1440 },
          {
            kind: "send_message",
            channel: "WHATSAPP",
            template:
              "Última mensagem por hoje, {nome}: se o {produto} ainda fizer sentido para você, é só responder qualquer coisa que eu retomo na hora.",
          },
        ],
      },
      { kind: "end" },
    ],
  };
}

/** Pós-venda para quem JÁ ativou o acesso: celebra, acompanha e colhe NPS. */
export const flowPosVendaUsouAcesso: FlowDefinition = {
  name: "Pós-venda: cliente ativou o acesso",
  trigger: { kind: "access_active" },
  steps: [
    { kind: "wait_until", hour: 10 },
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Oi, {nome}! Vi que você já entrou no {produto} — excelente começo. Como está sendo até agora? Se travar em qualquer ponto, me chama que eu resolvo com você.",
    },
    { kind: "wait", minutes: 4320 },
    {
      kind: "branch_replied",
      ifReplied: [{ kind: "end" }],
      ifNot: [
        {
          kind: "send_message",
          channel: "WHATSAPP",
          template:
            "{nome}, de 0 a 10, quanto o {produto} está te ajudando até aqui? Sua resposta ajusta o que eu te envio daqui para frente.",
        },
      ],
    },
    { kind: "end" },
  ],
};

/** Pós-venda para quem NÃO ativou o acesso: remove fricção e escala se preciso. */
export const flowPosVendaSemUso: FlowDefinition = {
  name: "Pós-venda: cliente não ativou o acesso",
  trigger: { kind: "access_idle" },
  steps: [
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Oi, {nome}! Notei que você ainda não entrou no {produto}. Aconteceu alguma coisa? Seu acesso está aqui: {link_acesso}. O primeiro passo leva menos de 10 minutos: {primeiro_passo}",
    },
    { kind: "wait", minutes: 2880 },
    {
      kind: "branch_replied",
      ifReplied: [{ kind: "end" }],
      ifNot: [
        {
          kind: "send_message",
          channel: "WHATSAPP",
          template:
            "{nome}, sem cobrança — só não quero que o {produto} fique parado sendo que ele já podia estar te dando resultado. Topa reservar 10 minutos hoje? Eu te guio pelo começo.",
        },
        { kind: "wait", minutes: 4320 },
        { kind: "add_tag", tag: "pos-venda-sem-uso" },
        {
          kind: "notify_human",
          message:
            "Cliente {nome} segue sem ativar o acesso ao {produto} após dois lembretes — vale um contato pessoal.",
        },
      ],
    },
    { kind: "end" },
  ],
};

/** Upsell dentro da janela de cliente novo (7 dias após o pagamento). */
export const flowUpsellJanela: FlowDefinition = {
  name: "Upsell: janela de 7 dias pós-compra",
  trigger: { kind: "order_paid" },
  steps: [
    { kind: "wait", minutes: 10080 },
    { kind: "wait_until", hour: 10 },
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Oi, {nome}! Faz uma semana que você está com o {produto} — e é exatamente nesse ponto que os resultados aceleram. Por isso liberamos para você: {oferta_upsell}. Essa condição vale só durante a janela de cliente novo. Quer que eu te explique em 2 minutos como funciona?",
    },
    { kind: "wait", minutes: 1440 },
    {
      kind: "branch_replied",
      ifReplied: [{ kind: "end" }],
      ifNot: [
        {
          kind: "send_message",
          channel: "WHATSAPP",
          template:
            "{nome}, a condição especial de {oferta_upsell} fecha em breve. Se não fizer sentido agora, tudo bem — eu só não queria que você perdesse por não ter visto a mensagem.",
        },
        { kind: "add_tag", tag: "upsell-janela-sem-resposta" },
      ],
    },
    { kind: "end" },
  ],
};

/** Reativação de lead hibernado (30 dias em "Reativar depois"). */
export const flowReativacao: FlowDefinition = {
  name: "Reativação: lead hibernado (30 dias)",
  trigger: { kind: "stage_entered", stageKey: "reativar-depois" },
  steps: [
    { kind: "wait", minutes: 43200 },
    { kind: "wait_until", hour: 10 },
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Oi, {nome}! Aqui é do {produto}. Lembrei de você porque temos novidade: {novidade}. Da última vez nossa conversa ficou no meio — faz sentido retomar agora?",
    },
    { kind: "wait", minutes: 2880 },
    {
      kind: "branch_replied",
      ifReplied: [{ kind: "end" }],
      ifNot: [
        { kind: "add_tag", tag: "reativacao-sem-resposta" },
        {
          kind: "notify_human",
          message:
            "Lead {nome} não respondeu à reativação de 30 dias — avaliar descarte ou nova janela.",
        },
      ],
    },
    { kind: "end" },
  ],
};

/**
 * Lembretes de live: D-1, 3h antes, 15min antes e ao vivo.
 * IMPORTANTE: o run deve ser iniciado exatamente 24h antes da live (D-1) —
 * os waits são relativos a esse instante (21h → 3h antes; +165min → 15min
 * antes; +15min → início).
 */
export const flowLembretesLive: FlowDefinition = {
  name: "Live: lembretes D-1, 3h, 15min e ao vivo",
  trigger: { kind: "campaign_reminder" },
  steps: [
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Oi, {nome}! Amanhã, às {hora_live}, tem {nome_live}. Vou te mostrar na prática o que muda no seu resultado — e tem material exclusivo para quem estiver ao vivo. Guarda este link: {link_live}",
    },
    { kind: "wait", minutes: 1260 },
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "É hoje, {nome}! Daqui a 3 horas começa {nome_live}. Separa papel e caneta: a primeira parte já resolve a dúvida mais comum de quem está começando. Link: {link_live}",
    },
    { kind: "wait", minutes: 165 },
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template:
        "Faltam 15 minutos, {nome}. Já deixa o link aberto para pegar o início — é onde eu entrego o mapa completo: {link_live}",
    },
    { kind: "wait", minutes: 15 },
    {
      kind: "send_message",
      channel: "WHATSAPP",
      template: "Começou, {nome}! Estamos ao vivo em {nome_live}. Entra agora: {link_live}",
    },
    { kind: "end" },
  ],
};

/** Todos os flows seed da biblioteca. */
export const FLOW_LIBRARY: FlowDefinition[] = [
  flowBoasVindasLeadNovo,
  flowPosVendaUsouAcesso,
  flowPosVendaSemUso,
  flowUpsellJanela,
  flowReativacao,
  flowLembretesLive,
];
