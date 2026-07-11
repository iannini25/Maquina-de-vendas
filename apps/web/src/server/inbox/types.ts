/**
 * DTOs serializáveis do Inbox (datas em ISO string) — compartilhados entre
 * Server Components, Server Actions e Client Components.
 */

export type ChannelDto = "WHATSAPP" | "INSTAGRAM" | "EMAIL";
export type ConversationStateDto = "BOT" | "HUMAN";
export type AiStatusDto = "RUNNING" | "WAITING_HUMAN" | "PAUSED";
export type MessageStatusDto = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type AuthorTypeDto = "LEAD" | "AI" | "HUMAN" | "SYSTEM";

export interface ConversationItemDto {
  id: string;
  leadId: string;
  leadName: string;
  stageName: string;
  aiStatus: AiStatusDto;
  state: ConversationStateDto;
  channel: ChannelDto;
  unreadCount: number;
  /** ISO string ou null quando a conversa ainda não tem mensagens. */
  lastMessageAt: string | null;
  preview: string;
}

export interface MessageDto {
  id: string;
  direction: "IN" | "OUT";
  authorType: AuthorTypeDto;
  text: string;
  status: MessageStatusDto;
  /** ISO string. */
  createdAt: string;
}

export interface ActiveConversationDto {
  id: string;
  leadId: string;
  leadName: string;
  channel: ChannelDto;
  state: ConversationStateDto;
  aiStatus: AiStatusDto;
  stageId: string;
  stageName: string;
  valueCents: number | null;
  score: number;
  nextActionText: string | null;
  messages: MessageDto[];
}

export interface StageOptionDto {
  id: string;
  name: string;
}

export interface LeadOptionDto {
  id: string;
  name: string;
  stageName: string;
}

export interface InboxData {
  /** Nome do produto exibido no seletor do topo (apenas exibição). */
  productName: string | null;
  conversations: ConversationItemDto[];
  active: ActiveConversationDto | null;
  stages: StageOptionDto[];
  leadOptions: LeadOptionDto[];
  /** ?lead= apontando para lead sem conversa: abre o modal pré-selecionado. */
  pendingLeadId: string | null;
}

export function channelLabel(channel: ChannelDto): string {
  if (channel === "INSTAGRAM") return "Instagram";
  if (channel === "EMAIL") return "E-mail";
  return "WhatsApp";
}
