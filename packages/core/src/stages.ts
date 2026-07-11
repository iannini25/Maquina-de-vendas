/**
 * Estágios seed do funil e playbooks default.
 * Ordem e chaves de sistema conforme a spec; Ganho/Perdido são fixos.
 */

export type StageSystemKey =
  | "NEW"
  | "WON"
  | "LOST"
  | "POST_SALE"
  | "NO_REPLY"
  | "REACTIVATE";

export type Autonomy = "DRAFT" | "SEMI" | "AUTO";

export interface CadenceConfig {
  /** Minutos após o toque anterior (ex.: [0, 20, 180, 1440, 4320, 10080]). */
  intervals: number[];
  maxTouches: number;
}

export interface StageSeed {
  key: string;
  name: string;
  color: string;
  isFixed: boolean;
  systemKey?: StageSystemKey;
  playbook: PlaybookSeed;
}

export interface PlaybookSeed {
  objective: string;
  instructions: string;
  allowedActions: string[];
  advanceWhen: string;
  regressWhen: string;
  cadence: CadenceConfig;
  handoffTriggers: string[];
  autonomy: Autonomy;
  /** Texto do toast exibido quando um lead entra neste estágio. */
  toastText: string;
}

export const DEFAULT_CADENCE: CadenceConfig = {
  intervals: [0, 20, 180, 1440, 4320, 10080],
  maxTouches: 6,
};

const NO_CADENCE: CadenceConfig = { intervals: [], maxTouches: 0 };

export const ALL_AGENT_ACTIONS = [
  "send_text",
  "send_image",
  "send_link",
  "send_buttons",
  "update_lead",
  "move_stage",
  "schedule_followup",
  "register_objection",
  "escalate_human",
  "register_sale",
  "flag_missing_context",
] as const;

export type AgentAction = (typeof ALL_AGENT_ACTIONS)[number];

export const STAGE_SEEDS: StageSeed[] = [
  {
    key: "novo-lead",
    name: "Novo lead",
    color: "#38BDF8",
    isFixed: false,
    systemKey: "NEW",
    playbook: {
      objective: "dar boas-vindas e iniciar a conversa em menos de 1 minuto",
      instructions:
        "Apresente-se conforme a persona, agradeça o interesse e faça UMA pergunta aberta para entender o momento do lead. Não fale de preço ainda.",
      allowedActions: [
        "send_text",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "escalate_human",
        "flag_missing_context",
      ],
      advanceWhen: "o lead responde qualquer mensagem",
      regressWhen: "",
      cadence: DEFAULT_CADENCE,
      handoffTriggers: ["pedido explícito de falar com humano"],
      autonomy: "AUTO",
      toastText: "a IA agora vai dar boas-vindas e puxar a primeira conversa",
    },
  },
  {
    key: "em-conversa",
    name: "Em conversa",
    color: "#B388FF",
    isFixed: false,
    playbook: {
      objective: "entender a dor e o contexto do lead",
      instructions:
        "Conduza com perguntas curtas, uma por vez. Identifique dor, urgência e orçamento implícito. Registre objeções.",
      allowedActions: [
        "send_text",
        "send_link",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "register_objection",
        "escalate_human",
        "flag_missing_context",
      ],
      advanceWhen: "dor e contexto identificados (score >= 40)",
      regressWhen: "lead para de responder após cadência completa",
      cadence: DEFAULT_CADENCE,
      handoffTriggers: ["objeção jurídica", "pedido de humano"],
      autonomy: "AUTO",
      toastText: "a IA agora vai aprofundar a conversa e mapear a dor",
    },
  },
  {
    key: "qualificado",
    name: "Qualificado",
    color: "#A855F7",
    isFixed: false,
    playbook: {
      objective: "confirmar fit e gerar desejo pela solução",
      instructions:
        "Conecte a dor do lead às promessas registradas do produto. Use provas e casos do contexto. Nunca invente números.",
      allowedActions: [
        "send_text",
        "send_image",
        "send_link",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "register_objection",
        "escalate_human",
        "flag_missing_context",
      ],
      advanceWhen: "lead demonstra interesse explícito na oferta",
      regressWhen: "lead esfria ou some",
      cadence: DEFAULT_CADENCE,
      handoffTriggers: ["pedido de desconto acima da alçada"],
      autonomy: "AUTO",
      toastText: "a IA agora vai conectar a dor do lead à oferta",
    },
  },
  {
    key: "interessado",
    name: "Interessado",
    color: "#FBBF24",
    isFixed: false,
    playbook: {
      objective: "apresentar a oferta completa e quebrar objeções",
      instructions:
        "Apresente preço, bônus e garantia EXATAMENTE como registrados. Quebre objeções com o contexto. Crie urgência honesta.",
      allowedActions: [
        "send_text",
        "send_image",
        "send_link",
        "send_buttons",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "register_objection",
        "escalate_human",
        "flag_missing_context",
      ],
      advanceWhen: "lead pede link de pagamento ou negocia condições",
      regressWhen: "lead diz que não é o momento",
      cadence: DEFAULT_CADENCE,
      handoffTriggers: ["negociação de condições fora do padrão"],
      autonomy: "SEMI",
      toastText: "a IA agora vai apresentar a oferta e quebrar objeções",
    },
  },
  {
    key: "em-negociacao",
    name: "Em negociação",
    color: "#FB7185",
    isFixed: false,
    playbook: {
      objective: "fechar a venda com as condições aprovadas",
      instructions:
        "Feche com clareza: recapitule oferta, envie link de pagamento (com aprovação) e confirme próximos passos. Desconto só dentro da alçada.",
      allowedActions: [
        "send_text",
        "send_link",
        "send_buttons",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "register_objection",
        "escalate_human",
        "register_sale",
        "flag_missing_context",
      ],
      advanceWhen: "pagamento confirmado",
      regressWhen: "lead recua da negociação",
      cadence: { intervals: [0, 60, 1440, 2880], maxTouches: 4 },
      handoffTriggers: ["pedido de desconto", "condição especial de pagamento"],
      autonomy: "SEMI",
      toastText: "a IA agora vai conduzir o fechamento — ações sensíveis pedem sua aprovação",
    },
  },
  {
    key: "compra-direta",
    name: "Compra direta",
    color: "#34D399",
    isFixed: false,
    playbook: {
      objective: "acompanhar quem foi direto ao checkout",
      instructions:
        "Lead veio com intenção de compra: confirme se conseguiu finalizar, remova fricção (link certo, dúvida de pagamento).",
      allowedActions: [
        "send_text",
        "send_link",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "escalate_human",
        "register_sale",
        "flag_missing_context",
      ],
      advanceWhen: "pagamento confirmado",
      regressWhen: "lead abandona o checkout e esfria",
      cadence: { intervals: [0, 30, 360, 1440], maxTouches: 4 },
      handoffTriggers: ["erro de pagamento reportado"],
      autonomy: "AUTO",
      toastText: "a IA agora vai remover fricção do checkout",
    },
  },
  {
    key: "venda-concluida",
    name: "Venda concluída",
    color: "#34D399",
    isFixed: false,
    playbook: {
      objective: "entregar acesso e garantir primeira experiência",
      instructions:
        "Confirme a compra, entregue o link de acesso registrado e explique o primeiro passo. Tom de celebração, sem vender nada.",
      allowedActions: [
        "send_text",
        "send_link",
        "update_lead",
        "move_stage",
        "escalate_human",
        "flag_missing_context",
      ],
      advanceWhen: "acesso entregue e confirmado",
      regressWhen: "",
      cadence: { intervals: [0], maxTouches: 1 },
      handoffTriggers: ["problema com acesso"],
      autonomy: "AUTO",
      toastText: "a IA agora vai entregar o acesso e dar as boas-vindas",
    },
  },
  {
    key: "pos-venda",
    name: "Pós-venda",
    color: "#8B5CF6",
    isFixed: false,
    systemKey: "POST_SALE",
    playbook: {
      objective: "acompanhar uso, colher NPS e abrir porta de upsell",
      instructions:
        "Acompanhe o uso real (monitor de acesso). Se não usou: ofereça ajuda. Se usou: colha feedback e, dentro da janela, apresente upsell.",
      allowedActions: [
        "send_text",
        "send_link",
        "update_lead",
        "schedule_followup",
        "escalate_human",
        "flag_missing_context",
      ],
      advanceWhen: "",
      regressWhen: "",
      cadence: { intervals: [1440, 4320, 10080], maxTouches: 3 },
      handoffTriggers: ["reclamação", "pedido de reembolso"],
      autonomy: "SEMI",
      toastText: "a IA agora vai cuidar do pós-venda e do relacionamento",
    },
  },
  {
    key: "nao-respondeu",
    name: "Não respondeu",
    color: "#6B6B76",
    isFixed: false,
    systemKey: "NO_REPLY",
    playbook: {
      objective: "última tentativa de reengajar com ângulo novo",
      instructions:
        "Uma única mensagem de quebra de padrão (curta, humana, sem pressão). Se não responder, mover para Reativar depois.",
      allowedActions: [
        "send_text",
        "update_lead",
        "move_stage",
        "schedule_followup",
        "flag_missing_context",
      ],
      advanceWhen: "lead responde",
      regressWhen: "sem resposta após o toque final",
      cadence: { intervals: [2880], maxTouches: 1 },
      handoffTriggers: [],
      autonomy: "AUTO",
      toastText: "a IA vai fazer uma última tentativa de reengajar",
    },
  },
  {
    key: "reativar-depois",
    name: "Reativar depois",
    color: "#38BDF8",
    isFixed: false,
    systemKey: "REACTIVATE",
    playbook: {
      objective: "hibernar e reativar na janela certa",
      instructions:
        "Sem toques até a janela de reativação (30 dias). Na reativação, abordar com novidade real (turma nova, bônus, conteúdo).",
      allowedActions: ["send_text", "update_lead", "move_stage", "schedule_followup"],
      advanceWhen: "lead responde à reativação",
      regressWhen: "",
      cadence: { intervals: [43200], maxTouches: 1 },
      handoffTriggers: [],
      autonomy: "SEMI",
      toastText: "lead hibernado — a IA volta a falar com ele na janela de reativação",
    },
  },
  {
    key: "ganho",
    name: "Ganho",
    color: "#34D399",
    isFixed: true,
    systemKey: "WON",
    playbook: {
      objective: "registrar a vitória e disparar o fluxo de venda",
      instructions:
        "Estágio terminal de vitória: registra Order, cria AccessGrant e dispara pós-venda automaticamente.",
      allowedActions: [],
      advanceWhen: "",
      regressWhen: "",
      cadence: NO_CADENCE,
      handoffTriggers: [],
      autonomy: "AUTO",
      toastText: "venda registrada — acesso e pós-venda disparados",
    },
  },
  {
    key: "perdido",
    name: "Perdido",
    color: "#FB7185",
    isFixed: true,
    systemKey: "LOST",
    playbook: {
      objective: "encerrar com elegância e registrar o motivo",
      instructions:
        "Sem cadência. Registrar motivo da perda para o analista de funil.",
      allowedActions: [],
      advanceWhen: "",
      regressWhen: "",
      cadence: NO_CADENCE,
      handoffTriggers: [],
      autonomy: "AUTO",
      toastText: "lead marcado como perdido — motivo registrado para análise",
    },
  },
];

export function stageSeedByKey(key: string): StageSeed | undefined {
  return STAGE_SEEDS.find((s) => s.key === key);
}
