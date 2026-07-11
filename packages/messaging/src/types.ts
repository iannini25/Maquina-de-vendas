/**
 * Contratos de provedores de canal (WhatsApp, Instagram etc.).
 * Toda a camada de envio/recebimento do VendaFlow fala através
 * destas interfaces — o resto do sistema não conhece a Evolution API.
 */

/** Resultado de um envio bem-sucedido: id da mensagem no provedor externo. */
export interface SendResult {
  externalId: string;
}

/** Estado da conexão da instância no provedor. */
export type ConnectionState = "CONNECTED" | "DISCONNECTED" | "CONNECTING" | "QR_PENDING";

/** QR Code para parear a instância (imagem em base64, geralmente data URI). */
export interface QrCode {
  base64: string;
}

/** Botão de resposta rápida exibido junto à mensagem. */
export interface ChannelButton {
  /** Identificador retornado quando o lead clica. */
  id: string;
  /** Texto visível do botão. */
  label: string;
}

/** Tipo de conteúdo de uma mensagem recebida. */
export type InboundMessageKind = "TEXT" | "IMAGE" | "FILE" | "AUDIO";

/** Mensagem recebida já normalizada — independente do provedor de origem. */
export interface NormalizedInboundMessage {
  /** Id da mensagem no provedor externo (deduplicação). */
  externalId: string;
  /** Telefone/identificador do remetente sem sufixo de domínio (ex.: "5511999999999"). */
  from: string;
  /** Momento em que a mensagem foi enviada. */
  timestamp: Date;
  kind: InboundMessageKind;
  /** Texto da mensagem ou legenda da mídia. */
  text?: string;
  /** URL da mídia quando kind é IMAGE/FILE/AUDIO. */
  mediaUrl?: string;
  /** MIME type da mídia (ex.: "image/jpeg"). */
  mediaMimeType?: string;
  /** Nome de exibição do remetente (pushName no WhatsApp). */
  senderName?: string;
}

/** Provedor de canal: envia mensagens e gerencia a instância de um workspace. */
export interface ChannelProvider {
  sendText(to: string, text: string): Promise<SendResult>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<SendResult>;
  sendFile(to: string, fileUrl: string, filename: string): Promise<SendResult>;
  sendButtons(to: string, text: string, buttons: ChannelButton[]): Promise<SendResult>;
  sendLink(to: string, url: string, previewText?: string): Promise<SendResult>;
  getConnectionState(): Promise<ConnectionState>;
  /** QR Code atual para pareamento, ou null se não há QR disponível. */
  getQrCode(): Promise<QrCode | null>;
  /** Cria a instância no provedor (uma por workspace). */
  createInstance(): Promise<void>;
  /** Garante que a instância existe, criando-a se necessário. */
  ensureInstance(): Promise<void>;
}
