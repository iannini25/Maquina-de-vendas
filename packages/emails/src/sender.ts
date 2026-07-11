import type { Transporter } from "nodemailer";

/**
 * Envio de e-mails transacionais.
 * Produção: Resend via API HTTP direta (sem SDK, menos dependências).
 * Desenvolvimento: SMTP local sem autenticação (ex.: Mailpit em localhost:1025).
 */

/** Entrada comum de envio. */
export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
  from: string;
  replyTo?: string;
}

export interface EmailSendResult {
  /** Identificador retornado pelo provedor. */
  id: string;
}

export interface EmailSender {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

/** Erro tipado de envio, com contexto do provedor quando disponível. */
export class EmailSendError extends Error {
  readonly statusCode?: number;
  readonly providerResponse?: string;

  constructor(
    message: string,
    options: { statusCode?: number; providerResponse?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "EmailSendError";
    this.statusCode = options.statusCode;
    this.providerResponse = options.providerResponse;
  }
}

/**
 * Subconjunto estrutural do `fetch` global (Node >= 18).
 * Tipado localmente porque o monorepo não usa @types/node; o fetch nativo
 * é atribuível a este contrato, e testes injetam mocks sem tocar em globais.
 */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<FetchResponseLike>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fetchGlobal(): FetchLike {
  const fetchNativo = (globalThis as { fetch?: FetchLike }).fetch;
  if (!fetchNativo) {
    throw new EmailSendError("fetch global indisponível — requer Node >= 18");
  }
  return fetchNativo;
}

export interface ResendSenderOptions {
  apiKey: string;
  /** Injetável em testes; default: fetch global. */
  fetchFn?: FetchLike;
}

/** Envia via Resend (POST https://api.resend.com/emails com Bearer key). */
export class ResendSender implements EmailSender {
  private readonly apiKey: string;
  private readonly fetchFn: FetchLike;

  constructor(options: ResendSenderOptions) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetchGlobal();
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const payload: Record<string, unknown> = {
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    };
    if (input.replyTo) payload["reply_to"] = input.replyTo;

    let resposta: FetchResponseLike;
    try {
      resposta = await this.fetchFn(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (erro) {
      throw new EmailSendError("Falha de rede ao chamar o Resend", { cause: erro });
    }

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      throw new EmailSendError(`Resend retornou HTTP ${resposta.status}`, {
        statusCode: resposta.status,
        providerResponse: corpo,
      });
    }

    const id = extrairIdResend(await resposta.json());
    if (!id) {
      throw new EmailSendError("Resposta do Resend sem campo id");
    }
    return { id };
  }
}

function extrairIdResend(dados: unknown): string | null {
  if (typeof dados !== "object" || dados === null) return null;
  const id = (dados as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export interface SmtpDevSenderOptions {
  host?: string;
  port?: number;
}

/** Sender de desenvolvimento: SMTP sem autenticação (ex.: Mailpit). */
export class SmtpDevSender implements EmailSender {
  private readonly host: string;
  private readonly port: number;
  private transporter?: Transporter;

  constructor(options: SmtpDevSenderOptions = {}) {
    this.host = options.host ?? "localhost";
    this.port = options.port ?? 1025;
  }

  private async obterTransporter(): Promise<Transporter> {
    if (!this.transporter) {
      // Import tardio: quem usa Resend não carrega o nodemailer.
      const { createTransport } = await import("nodemailer");
      this.transporter = createTransport({ host: this.host, port: this.port, secure: false });
    }
    return this.transporter;
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const transporter = await this.obterTransporter();
    try {
      const info: { messageId?: string } = await transporter.sendMail({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        replyTo: input.replyTo,
      });
      if (!info.messageId) {
        throw new EmailSendError("Servidor SMTP não retornou messageId");
      }
      return { id: info.messageId };
    } catch (erro) {
      if (erro instanceof EmailSendError) throw erro;
      throw new EmailSendError("Falha no envio SMTP de desenvolvimento", { cause: erro });
    }
  }
}

export interface EmailSenderConfig {
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
}

/** Escolhe Resend quando há chave de API; caso contrário, SMTP local de dev. */
export function createEmailSender(config: EmailSenderConfig): EmailSender {
  if (config.resendApiKey) {
    return new ResendSender({ apiKey: config.resendApiKey });
  }
  return new SmtpDevSender({ host: config.smtpHost, port: config.smtpPort });
}
