/**
 * Provedores ainda não disponíveis (Instagram, WhatsApp Cloud API).
 * Implementam ChannelProvider lançando NotImplementedError com mensagem clara,
 * permitindo cadastrar os canais na UI antes do lançamento.
 */

import type {
  ChannelButton,
  ChannelProvider,
  ConnectionState,
  QrCode,
  SendResult,
} from "./types.js";

/** Erro lançado por provedores de canal ainda não implementados. */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

/** Base para provedores indisponíveis: toda operação rejeita com "<canal>: em breve". */
abstract class UnavailableProvider implements ChannelProvider {
  private readonly channelLabel: string;

  protected constructor(channelLabel: string) {
    this.channelLabel = channelLabel;
  }

  private fail(): never {
    throw new NotImplementedError(`${this.channelLabel}: em breve`);
  }

  async sendText(_to: string, _text: string): Promise<SendResult> {
    this.fail();
  }

  async sendImage(_to: string, _imageUrl: string, _caption?: string): Promise<SendResult> {
    this.fail();
  }

  async sendFile(_to: string, _fileUrl: string, _filename: string): Promise<SendResult> {
    this.fail();
  }

  async sendButtons(_to: string, _text: string, _buttons: ChannelButton[]): Promise<SendResult> {
    this.fail();
  }

  async sendLink(_to: string, _url: string, _previewText?: string): Promise<SendResult> {
    this.fail();
  }

  async getConnectionState(): Promise<ConnectionState> {
    this.fail();
  }

  async getQrCode(): Promise<QrCode | null> {
    this.fail();
  }

  async createInstance(): Promise<void> {
    this.fail();
  }

  async ensureInstance(): Promise<void> {
    this.fail();
  }
}

/** Canal Instagram — em breve. */
export class InstagramProvider extends UnavailableProvider {
  constructor() {
    super("Instagram");
  }
}

/** Canal WhatsApp Cloud API (oficial Meta) — em breve. */
export class WhatsAppCloudProvider extends UnavailableProvider {
  constructor() {
    super("WhatsApp Cloud API");
  }
}
