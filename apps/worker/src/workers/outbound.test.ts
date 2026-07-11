import { describe, expect, it } from "vitest";
import { NotImplementedYetError } from "../errors.js";
import type { Log } from "../types.js";
import {
  createOutboundProcessor,
  extractExternalId,
  type OutboundDeps,
  type OutboundStatus,
  type WhatsAppSenderPort,
} from "./outbound.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeFakeSender(result: unknown = { key: { id: "wamid_1" } }): {
  sender: WhatsAppSenderPort;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const record = (method: string, args: unknown[]): Promise<unknown> => {
    calls.push({ method, args });
    return Promise.resolve(result);
  };
  return {
    calls,
    sender: {
      sendText: (to, text) => record("sendText", [to, text]),
      sendImage: (to, url, caption) => record("sendImage", [to, url, caption]),
      sendFile: (to, url, fileName) => record("sendFile", [to, url, fileName]),
      sendButtons: (to, text, buttons) => record("sendButtons", [to, text, buttons]),
    },
  };
}

interface Marked {
  messageId: string;
  status: OutboundStatus;
  externalId?: string;
}

interface Published {
  workspaceId: string;
  payload: Record<string, unknown>;
}

function makeDeps(sender: WhatsAppSenderPort): {
  deps: OutboundDeps;
  marked: Marked[];
  published: Published[];
} {
  const marked: Marked[] = [];
  const published: Published[] = [];
  return {
    marked,
    published,
    deps: {
      getSender: async () => sender,
      getRecipientPhone: async () => "5511999998888",
      markMessage: async (messageId, update) => {
        marked.push({ messageId, ...update });
      },
      publishInbox: async (workspaceId, payload) => {
        published.push({ workspaceId, payload });
      },
      log: silentLog,
    },
  };
}

const baseJob = { workspaceId: "ws_1", conversationId: "conv_1", messageId: "msg_1" };

describe("createOutboundProcessor", () => {
  it("envia TEXT para o telefone da conversa e marca SENT com externalId", async () => {
    const { sender, calls } = makeFakeSender({ key: { id: "wamid_42" } });
    const { deps, marked, published } = makeDeps(sender);
    const processor = createOutboundProcessor(deps);

    await processor({
      name: "send",
      data: { ...baseJob, kind: "TEXT", payload: { text: "Olá!" } },
    });

    expect(calls).toEqual([{ method: "sendText", args: ["5511999998888", "Olá!"] }]);
    expect(marked).toEqual([{ messageId: "msg_1", status: "SENT", externalId: "wamid_42" }]);
    expect(published).toHaveLength(1);
    expect(published[0]?.workspaceId).toBe("ws_1");
    expect(published[0]?.payload).toMatchObject({
      type: "message.sent",
      conversationId: "conv_1",
      messageId: "msg_1",
      externalId: "wamid_42",
    });
  });

  it("despacha IMAGE, FILE e BUTTONS para os métodos corretos", async () => {
    const { sender, calls } = makeFakeSender();
    const { deps } = makeDeps(sender);
    const processor = createOutboundProcessor(deps);

    await processor({
      name: "send",
      data: {
        ...baseJob,
        kind: "IMAGE",
        payload: { url: "https://cdn.x/img.png", caption: "veja" },
      },
    });
    await processor({
      name: "send",
      data: {
        ...baseJob,
        kind: "FILE",
        payload: { url: "https://cdn.x/doc.pdf", fileName: "doc.pdf" },
      },
    });
    await processor({
      name: "send",
      data: {
        ...baseJob,
        kind: "BUTTONS",
        payload: { text: "Escolha", buttons: [{ id: "a", label: "A" }] },
      },
    });

    expect(calls.map((call) => call.method)).toEqual(["sendImage", "sendFile", "sendButtons"]);
    expect(calls[0]?.args).toEqual(["5511999998888", "https://cdn.x/img.png", "veja"]);
    expect(calls[1]?.args).toEqual(["5511999998888", "https://cdn.x/doc.pdf", "doc.pdf"]);
    expect(calls[2]?.args).toEqual(["5511999998888", "Escolha", [{ id: "a", label: "A" }]]);
  });

  it("marca FAILED, publica message.failed e repropaga quando o envio falha", async () => {
    const sender: WhatsAppSenderPort = {
      ...makeFakeSender().sender,
      sendText: async () => {
        throw new Error("evolution fora do ar");
      },
    };
    const { deps, marked, published } = makeDeps(sender);
    const processor = createOutboundProcessor(deps);

    await expect(
      processor({ name: "send", data: { ...baseJob, kind: "TEXT", payload: { text: "oi" } } }),
    ).rejects.toThrowError("evolution fora do ar");

    expect(marked).toEqual([{ messageId: "msg_1", status: "FAILED" }]);
    expect(published[0]?.payload).toMatchObject({ type: "message.failed", messageId: "msg_1" });
  });

  it("preserva o erro original mesmo se markMessage também falhar", async () => {
    const sender: WhatsAppSenderPort = {
      ...makeFakeSender().sender,
      sendText: async () => {
        throw new Error("erro de envio");
      },
    };
    const { deps } = makeDeps(sender);
    deps.markMessage = async () => {
      throw new Error("banco caiu");
    };
    const processor = createOutboundProcessor(deps);

    await expect(
      processor({ name: "send", data: { ...baseJob, kind: "TEXT", payload: { text: "oi" } } }),
    ).rejects.toThrowError("erro de envio");
  });

  it("rejeita payload inválido sem chamar o provedor", async () => {
    const { sender, calls } = makeFakeSender();
    const { deps } = makeDeps(sender);
    const processor = createOutboundProcessor(deps);

    await expect(
      processor({ name: "send", data: { ...baseJob, kind: "TEXT", payload: {} } }),
    ).rejects.toThrowError();
    expect(calls).toHaveLength(0);
  });

  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { sender } = makeFakeSender();
    const { deps } = makeDeps(sender);
    const processor = createOutboundProcessor(deps);

    await expect(processor({ name: "broadcast", data: {} })).rejects.toBeInstanceOf(
      NotImplementedYetError,
    );
  });
});

describe("extractExternalId", () => {
  it("extrai de { externalId }", () => {
    expect(extractExternalId({ externalId: "abc" })).toBe("abc");
  });

  it("extrai de { id }", () => {
    expect(extractExternalId({ id: "xyz" })).toBe("xyz");
  });

  it("extrai do formato cru da Evolution { key: { id } }", () => {
    expect(extractExternalId({ key: { id: "wamid_9" } })).toBe("wamid_9");
  });

  it("retorna undefined para formatos desconhecidos", () => {
    expect(extractExternalId(undefined)).toBeUndefined();
    expect(extractExternalId(null)).toBeUndefined();
    expect(extractExternalId("string")).toBeUndefined();
    expect(extractExternalId({ key: {} })).toBeUndefined();
  });
});
