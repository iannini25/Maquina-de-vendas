/**
 * DTOs serializáveis e helpers puros do módulo Pipeline/Leads.
 * Compartilhados entre Server Components, Server Actions e Client Components.
 */

export type TemperatureDto = "COLD" | "WARM" | "HOT";
export type AiStatusDto = "RUNNING" | "WAITING_HUMAN" | "PAUSED";
export type AutonomyDto = "DRAFT" | "SEMI" | "AUTO";

export interface PipelineStageDto {
  id: string;
  name: string;
  color: string;
  order: number;
  isFixed: boolean;
  systemKey: string | null;
  playbookObjective: string;
}

export interface PipelineLeadDto {
  id: string;
  name: string;
  sourceLabel: string;
  stageId: string;
  temperature: TemperatureDto;
  aiStatus: AiStatusDto;
  score: number;
  valueCents: number | null;
  summary: string;
  lastInteractionAt: string | null;
}

export interface ProductOptionDto {
  id: string;
  name: string;
}

export interface LeadRowDto {
  id: string;
  name: string;
  stageName: string;
  temperature: TemperatureDto;
  channel: string;
  score: number;
  aiStatus: AiStatusDto;
}

export interface LeadsStatsDto {
  total: number;
  novos: number;
  emNegociacao: number;
  quentes: number;
}

export interface LeadDetailMessageDto {
  id: string;
  direction: "IN" | "OUT";
  authorType: "LEAD" | "AI" | "HUMAN" | "SYSTEM";
  text: string;
  createdAt: string;
}

export interface LeadDetailNoteDto {
  id: string;
  text: string;
  authorName: string;
  isYou: boolean;
  createdAt: string;
}

export interface LeadDetailEventDto {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface LeadDetailDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  sourceLabel: string;
  campaignName: string | null;
  stageName: string;
  valueCents: number | null;
  temperature: TemperatureDto;
  aiStatus: AiStatusDto;
  score: number;
  nextActionText: string | null;
  tags: string[];
  messages: LeadDetailMessageDto[];
  lastAiReplyAt: string | null;
  notes: LeadDetailNoteDto[];
  events: LeadDetailEventDto[];
}

export interface PlaybookDto {
  stageId: string;
  stageName: string;
  source: "PLATFORM" | "MARKDOWN";
  objective: string;
  instructions: string;
  allowedActions: string[];
  advanceWhen: string;
  regressWhen: string;
  autonomy: AutonomyDto;
}

export interface CsvImportRowInput {
  linha: number;
  nome: string;
  whatsapp: string;
  email?: string;
  origem?: string;
  valor?: string;
}

export interface CsvImportError {
  linha: number;
  motivo: string;
}

// ── Resultados tipados das actions ────────────────────────────────────────

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface MoveLeadResult extends ActionResult {
  toastText?: string;
}

export interface CreateLeadResult extends ActionResult {
  leadId?: string;
}

export interface ImportLeadsResult extends ActionResult {
  criados?: number;
  erros?: CsvImportError[];
}

export interface PlaybookSaveResult extends ActionResult {
  errors?: string[];
}

export interface PlaybookLoadResult extends ActionResult {
  playbook?: PlaybookDto;
}

export interface LeadDetailResult extends ActionResult {
  detail?: LeadDetailDto;
}

export interface AddNoteResult extends ActionResult {
  note?: LeadDetailNoteDto;
}

// ── Helpers puros ─────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  landing: "Landing page",
  prospeccao: "Prospecção",
  manual: "Manual",
  csv: "Importação CSV",
};

/** Origem legível: mapeia chaves internas do seed; rótulos livres passam direto. */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** "5511912345678" → "+55 (11) 91234-5678" (melhor esforço; devolve cru se não reconhecer). */
export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return digits ? `+${digits}` : "—";
}

/** Traduz tipos de evento do EventLog para a timeline de atividade do lead. */
export function translateLeadEvent(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case "lead.created": {
      const source = typeof data["source"] === "string" ? sourceLabel(data["source"]) : null;
      return source ? `Lead criado · origem ${source}` : "Lead criado";
    }
    case "lead.stage_changed": {
      const to = typeof data["toStageName"] === "string" ? data["toStageName"] : null;
      return to ? `Mudou para ${to}` : "Mudou de estágio";
    }
    case "lead.score_changed":
      return "Score atualizado pela IA";
    case "lead.opted_out":
      return "Lead pediu para não receber mensagens";
    case "conversation.human_takeover":
      return "Você assumiu a conversa — IA pausada";
    case "conversation.handback":
      return "Conversa devolvida para a IA";
    case "message.received":
      return "Lead enviou uma mensagem";
    case "message.sent":
      return "Mensagem enviada ao lead";
    case "note.added":
      return "Nota interna adicionada";
    case "deal.won":
      return "Negócio ganho";
    case "deal.lost":
      return "Negócio perdido";
    case "order.paid":
      return "Pagamento confirmado — venda registrada";
    case "access.granted":
      return "Acesso ao produto liberado";
    case "lead.deleted":
      return "Lead excluído";
    case "playbook.updated":
      return "Playbook do estágio atualizado";
    default:
      return type;
  }
}
