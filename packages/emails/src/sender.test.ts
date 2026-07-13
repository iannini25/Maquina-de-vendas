import { describe, expect, it, vi } from "vitest";

import {
  createEmailSender,
  EmailSendError,
  ResendSender,
  SmtpDevSender,
  type EmailSendInput,
  type FetchLike,
  type FetchResponseLike,
} from "./sender.js";

const ENTRADA: EmailSendInput = {
  to: "lead@exemplo.com",
  subject: "Seu acesso chegou",
  html: "<p>Oi</p>",
  from: "Sales4U <no-reply@sales4u.com>",
};

function respostaJson(status: number, corpo: unknown): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(corpo)),
    json: () => Promise.resolve(corpo),
  };
}

describe("createEmailSender", () => {
  it("escolhe ResendSender quando há resendApiKey", () => {
    const sender = createEmailSender({ resendApiKey: "re_123" });
    expect(sender).toBeInstanceOf(ResendSender);
  });

  it("escolhe SmtpDevSender quando não há chave do Resend", () => {
    const sender = createEmailSender({ smtpHost: "localhost", smtpPort: 1025 });
    expect(sender).toBeInstanceOf(SmtpDevSender);
  });

  it("prioriza Resend quando há chave e config SMTP ao mesmo tempo", () => {
    const sender = createEmailSender({ resendApiKey: "re_123", smtpHost: "localhost" });
    expect(sender).toBeInstanceOf(ResendSender);
  });
});

describe("ResendSender", () => {
  it("envia com sucesso e retorna o id do provedor", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      respostaJson(200, { id: "email_123" }),
    );
    const sender = new ResendSender({ apiKey: "re_abc", fetchFn: fetchMock });

    const resultado = await sender.send({ ...ENTRADA, replyTo: "suporte@sales4u.com" });

    expect(resultado).toEqual({ id: "email_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const chamada = fetchMock.mock.calls[0];
    if (!chamada) throw new Error("fetch não foi chamado");
    const [url, init] = chamada;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer re_abc");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const corpo = JSON.parse(init.body) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
      reply_to?: string;
    };
    expect(corpo.from).toBe(ENTRADA.from);
    expect(corpo.to).toEqual([ENTRADA.to]);
    expect(corpo.subject).toBe(ENTRADA.subject);
    expect(corpo.html).toBe(ENTRADA.html);
    expect(corpo.reply_to).toBe("suporte@sales4u.com");
  });

  it("omite reply_to quando não informado", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(respostaJson(200, { id: "email_1" }));
    const sender = new ResendSender({ apiKey: "re_abc", fetchFn: fetchMock });

    await sender.send(ENTRADA);

    const chamada = fetchMock.mock.calls[0];
    if (!chamada) throw new Error("fetch não foi chamado");
    const corpo = JSON.parse(chamada[1].body) as Record<string, unknown>;
    expect(corpo).not.toHaveProperty("reply_to");
  });

  it("lança EmailSendError tipado em HTTP 422", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      respostaJson(422, { name: "validation_error", message: "Invalid `to` field" }),
    );
    const sender = new ResendSender({ apiKey: "re_abc", fetchFn: fetchMock });

    const promessa = sender.send(ENTRADA);
    await expect(promessa).rejects.toBeInstanceOf(EmailSendError);
    await expect(promessa).rejects.toMatchObject({
      name: "EmailSendError",
      statusCode: 422,
    });
    await expect(promessa).rejects.toHaveProperty(
      "providerResponse",
      expect.stringContaining("validation_error"),
    );
  });

  it("lança EmailSendError quando a resposta ok não traz id", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(respostaJson(200, {}));
    const sender = new ResendSender({ apiKey: "re_abc", fetchFn: fetchMock });

    await expect(sender.send(ENTRADA)).rejects.toBeInstanceOf(EmailSendError);
  });

  it("embrulha falha de rede em EmailSendError com cause", async () => {
    const falha = new Error("ECONNREFUSED");
    const fetchMock = vi.fn<FetchLike>().mockRejectedValue(falha);
    const sender = new ResendSender({ apiKey: "re_abc", fetchFn: fetchMock });

    const promessa = sender.send(ENTRADA);
    await expect(promessa).rejects.toBeInstanceOf(EmailSendError);
    await expect(promessa).rejects.toHaveProperty("cause", falha);
  });
});
