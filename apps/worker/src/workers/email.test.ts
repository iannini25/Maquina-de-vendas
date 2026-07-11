import { describe, expect, it } from "vitest";
import { NotImplementedYetError } from "../errors.js";
import type { Log } from "../types.js";
import { createEmailProcessor, type EmailSenderPort } from "./email.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

interface SentEmail {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

function makeFakeSender(): { sender: EmailSenderPort; sent: SentEmail[] } {
  const sent: SentEmail[] = [];
  return {
    sent,
    sender: {
      async send(input) {
        sent.push(input);
        return { id: "email_123" };
      },
    },
  };
}

describe("createEmailProcessor", () => {
  it("resolve o remetente do workspace e envia o e-mail", async () => {
    const { sender, sent } = makeFakeSender();
    const resolvedFor: string[] = [];
    const processor = createEmailProcessor({
      getSender: async (workspaceId) => {
        resolvedFor.push(workspaceId);
        return sender;
      },
      log: silentLog,
    });

    await processor({
      name: "send",
      data: {
        workspaceId: "ws_1",
        to: "lead@exemplo.com",
        subject: "Proposta",
        html: "<p>Segue proposta</p>",
      },
    });

    expect(resolvedFor).toEqual(["ws_1"]);
    expect(sent).toEqual([
      { to: "lead@exemplo.com", subject: "Proposta", html: "<p>Segue proposta</p>" },
    ]);
  });

  it("rejeita payload inválido antes de tocar no remetente", async () => {
    const { sender, sent } = makeFakeSender();
    const processor = createEmailProcessor({ getSender: async () => sender, log: silentLog });

    await expect(
      processor({ name: "send", data: { workspaceId: "ws_1", to: "inválido" } }),
    ).rejects.toThrowError();
    expect(sent).toHaveLength(0);
  });

  it("propaga a falha do remetente para o BullMQ fazer retry", async () => {
    const processor = createEmailProcessor({
      getSender: async () => ({
        async send() {
          throw new Error("resend indisponível");
        },
      }),
      log: silentLog,
    });

    await expect(
      processor({
        name: "send",
        data: { workspaceId: "ws_1", to: "a@b.com", subject: "x", html: "y" },
      }),
    ).rejects.toThrowError("resend indisponível");
  });

  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { sender } = makeFakeSender();
    const processor = createEmailProcessor({ getSender: async () => sender, log: silentLog });

    await expect(processor({ name: "digest", data: {} })).rejects.toBeInstanceOf(
      NotImplementedYetError,
    );
  });
});
