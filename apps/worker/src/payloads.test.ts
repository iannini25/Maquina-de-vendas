import { describe, expect, it } from "vitest";
import {
  agentReplyJobSchema,
  analystJobSchema,
  automationJobSchema,
  campaignReminderJobSchema,
  campaignTickJobSchema,
  contextIngestJobSchema,
  emailJobSchema,
  importJobSchema,
  outboundJobSchema,
  postSaleJobSchema,
} from "./payloads.js";

describe("emailJobSchema", () => {
  it("aceita payload completo", () => {
    const payload = emailJobSchema.parse({
      workspaceId: "ws_1",
      to: "lead@exemplo.com",
      subject: "Bem-vindo",
      html: "<p>Olá!</p>",
    });
    expect(payload.to).toBe("lead@exemplo.com");
  });

  it("rejeita e-mail inválido", () => {
    expect(() =>
      emailJobSchema.parse({ workspaceId: "ws_1", to: "não-é-email", subject: "x", html: "y" }),
    ).toThrowError();
  });

  it("rejeita subject vazio", () => {
    expect(() =>
      emailJobSchema.parse({ workspaceId: "ws_1", to: "a@b.com", subject: "", html: "y" }),
    ).toThrowError();
  });
});

describe("outboundJobSchema", () => {
  const base = { workspaceId: "ws_1", conversationId: "conv_1", messageId: "msg_1" };

  it("aceita TEXT com texto", () => {
    const payload = outboundJobSchema.parse({
      ...base,
      kind: "TEXT",
      payload: { text: "Oi, tudo bem?" },
    });
    expect(payload.kind).toBe("TEXT");
  });

  it("aceita IMAGE com url e caption opcional", () => {
    const payload = outboundJobSchema.parse({
      ...base,
      kind: "IMAGE",
      payload: { url: "https://cdn.exemplo.com/foto.png" },
    });
    expect(payload.kind).toBe("IMAGE");
  });

  it("aceita FILE com url e fileName", () => {
    const payload = outboundJobSchema.parse({
      ...base,
      kind: "FILE",
      payload: { url: "https://cdn.exemplo.com/proposta.pdf", fileName: "proposta.pdf" },
    });
    expect(payload.kind).toBe("FILE");
  });

  it("aceita BUTTONS com pelo menos um botão", () => {
    const payload = outboundJobSchema.parse({
      ...base,
      kind: "BUTTONS",
      payload: { text: "Escolha:", buttons: [{ id: "sim", label: "Sim" }] },
    });
    expect(payload.kind).toBe("BUTTONS");
  });

  it("rejeita kind desconhecido", () => {
    expect(() =>
      outboundJobSchema.parse({ ...base, kind: "AUDIO", payload: { url: "x" } }),
    ).toThrowError();
  });

  it("rejeita TEXT sem texto", () => {
    expect(() => outboundJobSchema.parse({ ...base, kind: "TEXT", payload: {} })).toThrowError();
  });

  it("rejeita BUTTONS com lista vazia", () => {
    expect(() =>
      outboundJobSchema.parse({ ...base, kind: "BUTTONS", payload: { text: "x", buttons: [] } }),
    ).toThrowError();
  });

  it("rejeita payload sem messageId", () => {
    expect(() =>
      outboundJobSchema.parse({
        workspaceId: "ws_1",
        conversationId: "conv_1",
        kind: "TEXT",
        payload: { text: "oi" },
      }),
    ).toThrowError();
  });
});

describe("schemas dos esqueletos", () => {
  it("automation exige runId", () => {
    expect(automationJobSchema.parse({ workspaceId: "ws", runId: "run" }).runId).toBe("run");
    expect(() => automationJobSchema.parse({ workspaceId: "ws" })).toThrowError();
  });

  it("agent-reply exige conversa e mensagem", () => {
    const payload = agentReplyJobSchema.parse({
      workspaceId: "ws",
      conversationId: "conv",
      messageId: "msg",
    });
    expect(payload.messageId).toBe("msg");
  });

  it("context-ingest exige contextFileId", () => {
    expect(() => contextIngestJobSchema.parse({ workspaceId: "ws" })).toThrowError();
  });

  it("post-sale aceita varredura global sem workspaceId", () => {
    expect(postSaleJobSchema.parse({})).toEqual({});
  });

  it("campaign tick é objeto vazio estrito", () => {
    expect(campaignTickJobSchema.parse({})).toEqual({});
    expect(() => campaignTickJobSchema.parse({ extra: 1 })).toThrowError();
  });

  it("campaign reminder exige campanha e reminderKey", () => {
    expect(() =>
      campaignReminderJobSchema.parse({ workspaceId: "ws", campaignId: "camp" }),
    ).toThrowError();
  });

  it("analyst valida formato da data", () => {
    expect(analystJobSchema.parse({ date: "2026-07-10" }).date).toBe("2026-07-10");
    expect(() => analystJobSchema.parse({ date: "10/07/2026" })).toThrowError();
  });

  it("import exige entity válida", () => {
    const payload = importJobSchema.parse({
      workspaceId: "ws",
      storageKey: "imports/leads.csv",
      entity: "leads",
    });
    expect(payload.entity).toBe("leads");
    expect(() =>
      importJobSchema.parse({ workspaceId: "ws", storageKey: "x", entity: "orders" }),
    ).toThrowError();
  });
});
