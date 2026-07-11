import { describe, expect, it } from "vitest";

import { NotImplementedYetError } from "../errors.js";
import type { EmailJobPayload, OutboundJobPayload } from "../payloads.js";
import type { Log } from "../types.js";
import {
  accessDeliveryText,
  classifyGrant,
  createPostSaleProcessor,
  makeOptoutToken,
  purchaseConfirmText,
  verifyOptoutToken,
  type EmailPurposePostSale,
  type EmailTemplateRecord,
  type GrantRecord,
  type LeadContext,
  type OrderRecord,
  type OutMessageRef,
  type PostSaleAutonomy,
  type PostSaleDb,
  type PostSaleDeps,
  type PostSaleEvent,
  type PostSaleFlowToggles,
  type PostSaleLead,
  type UpsellApprovalInput,
} from "./post-sale.js";

const silentLog: Log = { debug() {}, info() {}, warn() {}, error() {} };

const AGORA = new Date("2026-07-10T12:00:00Z");
const DIA_EM_MS = 86_400_000;

function diasAtras(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA_EM_MS);
}

const TOGGLES_ON: PostSaleFlowToggles = {
  purchaseConfirm: true,
  accessDelivery: true,
  nudge: true,
  reengage: true,
  nps: true,
  upsell: true,
};

function makeLead(overrides: Partial<PostSaleLead> = {}): PostSaleLead {
  return { id: "lead_1", name: "Ana", email: "ana@exemplo.com", optedOut: false, ...overrides };
}

function makeGrant(overrides: Partial<GrantRecord> = {}): GrantRecord {
  return {
    id: "grant_1",
    workspaceId: "ws_1",
    status: "NEVER",
    createdAt: diasAtras(3),
    firstAccessAt: null,
    lastActivityAt: null,
    idleThresholdDays: 5,
    trackedToken: "tok123",
    productName: "Curso X",
    lead: makeLead(),
    toggles: { ...TOGGLES_ON },
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "order_1",
    workspaceId: "ws_1",
    paidAt: diasAtras(8),
    valueCents: 19_700,
    productName: "Curso X",
    upsellWindowDays: 7,
    trackedToken: "tok123",
    lead: makeLead(),
    toggles: { ...TOGGLES_ON },
    ...overrides,
  };
}

interface EventoRegistrado extends PostSaleEvent {
  at: Date;
}

/** Fake em memória de PostSaleDb — eventos alimentam o hasEventSince (idempotência real). */
class FakePostSaleDb implements PostSaleDb {
  contexts = new Map<string, LeadContext>();
  grants: GrantRecord[] = [];
  orders: OrderRecord[] = [];
  templates = new Map<EmailPurposePostSale, EmailTemplateRecord>();
  autonomy: PostSaleAutonomy | null = null;

  events: EventoRegistrado[] = [];
  mensagens: Array<{ workspaceId: string; leadId: string; text: string }> = [];
  statusAlterados: Array<{ grantId: string; status: "ACTIVE" | "IDLE" }> = [];
  approvals: UpsellApprovalInput[] = [];

  private proximaMensagem = 0;

  async getLeadContext(workspaceId: string, leadId: string): Promise<LeadContext | null> {
    return this.contexts.get(`${workspaceId}:${leadId}`) ?? null;
  }

  async hasEventSince(
    workspaceId: string,
    type: string,
    entityId: string,
    since?: Date,
  ): Promise<boolean> {
    return this.events.some(
      (evento) =>
        evento.workspaceId === workspaceId &&
        evento.type === type &&
        evento.entityId === entityId &&
        (!since || evento.at.getTime() >= since.getTime()),
    );
  }

  async logEvent(event: PostSaleEvent): Promise<void> {
    this.events.push({ ...event, at: AGORA });
  }

  async createOutboundMessage(
    workspaceId: string,
    leadId: string,
    text: string,
  ): Promise<OutMessageRef> {
    this.mensagens.push({ workspaceId, leadId, text });
    this.proximaMensagem += 1;
    return { conversationId: `conv_${leadId}`, messageId: `msg_${this.proximaMensagem}` };
  }

  async getEmailTemplate(
    _workspaceId: string,
    purpose: EmailPurposePostSale,
  ): Promise<EmailTemplateRecord | null> {
    return this.templates.get(purpose) ?? null;
  }

  async listGrants(): Promise<GrantRecord[]> {
    return this.grants;
  }

  async listPaidOrders(): Promise<OrderRecord[]> {
    return this.orders;
  }

  async setGrantStatus(grantId: string, status: "ACTIVE" | "IDLE"): Promise<void> {
    this.statusAlterados.push({ grantId, status });
    const grant = this.grants.find((item) => item.id === grantId);
    if (grant) grant.status = status;
  }

  async getPostSaleAutonomy(): Promise<PostSaleAutonomy | null> {
    return this.autonomy;
  }

  async createUpsellApproval(input: UpsellApprovalInput): Promise<void> {
    this.approvals.push(input);
  }
}

function makeHarness(db: FakePostSaleDb): {
  deps: PostSaleDeps;
  outbound: OutboundJobPayload[];
  emails: EmailJobPayload[];
} {
  const outbound: OutboundJobPayload[] = [];
  const emails: EmailJobPayload[] = [];
  const deps: PostSaleDeps = {
    db,
    enqueueOutbound: async (payload) => {
      outbound.push(payload);
    },
    enqueueEmail: async (payload) => {
      emails.push(payload);
    },
    appUrl: "https://app.teste",
    optoutSecret: "segredo-de-teste",
    now: () => AGORA,
    log: silentLog,
  };
  return { deps, outbound, emails };
}

// ── Token de opt-out ────────────────────────────────────────────────────────

describe("makeOptoutToken / verifyOptoutToken", () => {
  it("assina no formato leadId.exp.assinaturaHex e verifica de volta", () => {
    const token = makeOptoutToken("lead_1", "segredo", AGORA);
    const [leadId, exp, assinatura] = token.split(".");
    expect(leadId).toBe("lead_1");
    expect(Number(exp)).toBeGreaterThan(AGORA.getTime());
    expect(assinatura).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyOptoutToken(token, "segredo", AGORA)).toBe("lead_1");
  });

  it("rejeita token expirado", () => {
    const token = makeOptoutToken("lead_1", "segredo", AGORA, 1);
    const depoisDaValidade = new Date(AGORA.getTime() + 2 * DIA_EM_MS);
    expect(verifyOptoutToken(token, "segredo", depoisDaValidade)).toBeNull();
  });

  it("rejeita assinatura adulterada e segredo errado", () => {
    const token = makeOptoutToken("lead_1", "segredo", AGORA);
    expect(verifyOptoutToken(`outro.${token.split(".")[1]}.${token.split(".")[2]}`, "segredo", AGORA)).toBeNull();
    expect(verifyOptoutToken(token, "segredo-errado", AGORA)).toBeNull();
    expect(verifyOptoutToken("lixo", "segredo", AGORA)).toBeNull();
  });
});

// ── classifyGrant ───────────────────────────────────────────────────────────

describe("classifyGrant", () => {
  it("NEVER sem primeiro acesso e criado há mais de 2 dias → nudge", () => {
    expect(classifyGrant(makeGrant({ createdAt: diasAtras(3) }), AGORA)).toBe("nudge");
  });

  it("NEVER recente ainda não recebe nudge", () => {
    expect(classifyGrant(makeGrant({ createdAt: diasAtras(1) }), AGORA)).toBe("none");
  });

  it("ocioso além do idleThresholdDays → reengage", () => {
    const grant = makeGrant({
      status: "ACCESSED",
      firstAccessAt: diasAtras(20),
      lastActivityAt: diasAtras(10),
      idleThresholdDays: 5,
    });
    expect(classifyGrant(grant, AGORA)).toBe("reengage");
  });

  it("atividade recente → activate", () => {
    const grant = makeGrant({
      status: "IDLE",
      firstAccessAt: diasAtras(20),
      lastActivityAt: diasAtras(1),
      idleThresholdDays: 5,
    });
    expect(classifyGrant(grant, AGORA)).toBe("activate");
  });
});

// ── daily-classification ────────────────────────────────────────────────────

describe("post-sale daily-classification", () => {
  it("NEVER >2d dispara nudge uma única vez (idempotente por EventLog)", async () => {
    const db = new FakePostSaleDb();
    db.grants = [makeGrant()];
    const { deps, outbound } = makeHarness(db);
    const processor = createPostSaleProcessor(deps);

    await processor({ name: "daily-classification", data: {} });
    await processor({ name: "daily-classification", data: {} });

    expect(db.mensagens).toHaveLength(1);
    expect(db.mensagens[0]?.text).toContain("ainda não acessou Curso X");
    expect(db.mensagens[0]?.text).toContain("https://app.teste/a/tok123");
    expect(outbound).toHaveLength(1);
    expect(db.events.filter((evento) => evento.type === "access.nudge_sent")).toHaveLength(1);
  });

  it("detecta ociosidade: marca IDLE e envia reengajamento (1x por semana)", async () => {
    const db = new FakePostSaleDb();
    db.grants = [
      makeGrant({
        id: "grant_idle",
        status: "ACCESSED",
        firstAccessAt: diasAtras(30),
        lastActivityAt: diasAtras(10),
        idleThresholdDays: 5,
      }),
    ];
    const { deps } = makeHarness(db);
    const processor = createPostSaleProcessor(deps);

    await processor({ name: "daily-classification", data: {} });
    await processor({ name: "daily-classification", data: {} });

    expect(db.statusAlterados).toEqual([{ grantId: "grant_idle", status: "IDLE" }]);
    const reengajamentos = db.mensagens.filter((mensagem) =>
      mensagem.text.includes("sentimos sua falta"),
    );
    expect(reengajamentos).toHaveLength(1);
    expect(db.events.filter((evento) => evento.type === "access.reengage_sent")).toHaveLength(1);
  });

  it("atividade recente marca ACTIVE sem enviar mensagem", async () => {
    const db = new FakePostSaleDb();
    db.grants = [
      makeGrant({
        id: "grant_ativo",
        status: "IDLE",
        firstAccessAt: diasAtras(30),
        lastActivityAt: diasAtras(1),
      }),
    ];
    const { deps } = makeHarness(db);

    await createPostSaleProcessor(deps)({ name: "daily-classification", data: {} });

    expect(db.statusAlterados).toEqual([{ grantId: "grant_ativo", status: "ACTIVE" }]);
    expect(db.mensagens).toHaveLength(0);
  });

  it("lead com opt-out não recebe nudge nem reengajamento", async () => {
    const db = new FakePostSaleDb();
    db.grants = [
      makeGrant({ lead: makeLead({ optedOut: true }) }),
      makeGrant({
        id: "grant_2",
        status: "ACCESSED",
        firstAccessAt: diasAtras(30),
        lastActivityAt: diasAtras(10),
        lead: makeLead({ id: "lead_2", optedOut: true }),
      }),
    ];
    const { deps, outbound } = makeHarness(db);

    await createPostSaleProcessor(deps)({ name: "daily-classification", data: {} });

    expect(db.mensagens).toHaveLength(0);
    expect(outbound).toHaveLength(0);
  });

  it("NPS: order paga há 7+ dias envia e-mail com template e registra nps.sent uma vez", async () => {
    const db = new FakePostSaleDb();
    db.orders = [makeOrder()];
    db.templates.set("NPS", {
      name: "Pesquisa NPS",
      structure: { headerTitle: "Uma pergunta, {nome}" },
      bodyText: "De 0 a 10, recomendaria {produto}?",
    });
    const { deps, emails } = makeHarness(db);
    const processor = createPostSaleProcessor(deps);

    await processor({ name: "daily-classification", data: {} });
    await processor({ name: "daily-classification", data: {} });

    expect(emails).toHaveLength(1);
    expect(emails[0]?.to).toBe("ana@exemplo.com");
    expect(emails[0]?.subject).toBe("Uma pergunta, Ana");
    expect(emails[0]?.html).toContain("/api/optout?token=");
    expect(db.events.filter((evento) => evento.type === "nps.sent")).toHaveLength(1);
  });

  it("NPS sem e-mail cai para WhatsApp", async () => {
    const db = new FakePostSaleDb();
    db.orders = [makeOrder({ lead: makeLead({ email: null }) })];
    const { deps, emails } = makeHarness(db);

    await createPostSaleProcessor(deps)({ name: "daily-classification", data: {} });

    expect(emails).toHaveLength(0);
    expect(db.mensagens).toHaveLength(1);
    expect(db.mensagens[0]?.text).toContain("de 0 a 10");
  });

  it("upsell com autonomia SEMI vira Approval MESSAGE_DRAFT (idempotente)", async () => {
    const db = new FakePostSaleDb();
    db.orders = [makeOrder({ paidAt: diasAtras(8), toggles: { ...TOGGLES_ON, nps: false } })];
    db.autonomy = "SEMI";
    const { deps } = makeHarness(db);
    const processor = createPostSaleProcessor(deps);

    await processor({ name: "daily-classification", data: {} });
    await processor({ name: "daily-classification", data: {} });

    expect(db.approvals).toHaveLength(1);
    expect(db.approvals[0]?.orderId).toBe("order_1");
    expect(db.mensagens).toHaveLength(0);
    const eventos = db.events.filter((evento) => evento.type === "upsell.sent");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.data).toMatchObject({ modo: "approval" });
  });

  it("upsell com autonomia AUTO envia direto pelo WhatsApp", async () => {
    const db = new FakePostSaleDb();
    db.orders = [makeOrder({ paidAt: diasAtras(8), toggles: { ...TOGGLES_ON, nps: false } })];
    db.autonomy = "AUTO";
    const { deps, outbound } = makeHarness(db);

    await createPostSaleProcessor(deps)({ name: "daily-classification", data: {} });

    expect(db.approvals).toHaveLength(0);
    expect(db.mensagens).toHaveLength(1);
    expect(db.mensagens[0]?.text).toContain("condição exclusiva");
    expect(outbound).toHaveLength(1);
  });

  it("order antiga demais fica fora da janela (sem backfill em massa)", async () => {
    const db = new FakePostSaleDb();
    db.orders = [makeOrder({ paidAt: diasAtras(200) })];
    const { deps, emails } = makeHarness(db);

    await createPostSaleProcessor(deps)({ name: "daily-classification", data: {} });

    expect(emails).toHaveLength(0);
    expect(db.mensagens).toHaveLength(0);
    expect(db.approvals).toHaveLength(0);
  });
});

// ── schedule-for-lead ───────────────────────────────────────────────────────

describe("post-sale schedule-for-lead", () => {
  function makeContexto(overrides: Partial<LeadContext> = {}): LeadContext {
    return {
      lead: makeLead(),
      toggles: { ...TOGGLES_ON },
      grant: { trackedToken: "tok123" },
      order: { valueCents: 19_700, productName: "Curso X" },
      ...overrides,
    };
  }

  it("dispara confirmação (WhatsApp + e-mail) e entrega de acesso, com EventLog", async () => {
    const db = new FakePostSaleDb();
    db.contexts.set("ws_1:lead_1", makeContexto());
    db.templates.set("PURCHASE_CONFIRM", {
      name: "Compra confirmada",
      structure: {
        headerTitle: "Compra confirmada, {nome}!",
        buttons: [{ label: "Acessar {produto}", url: "{link_acesso}" }],
      },
      bodyText: "Sua compra de {produto} no valor de {valor} foi aprovada.",
    });
    const { deps, outbound, emails } = makeHarness(db);

    await createPostSaleProcessor(deps)({
      name: "schedule-for-lead",
      data: { workspaceId: "ws_1", leadId: "lead_1" },
    });

    expect(db.mensagens.map((mensagem) => mensagem.text)).toEqual([
      purchaseConfirmText("Ana", "Curso X"),
      accessDeliveryText("Curso X", "https://app.teste/a/tok123"),
    ]);
    expect(outbound).toHaveLength(2);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.subject).toBe("Compra confirmada, Ana!");
    expect(emails[0]?.html).toContain("https://app.teste/a/tok123");
    expect(emails[0]?.html).toContain("/api/optout?token=lead_1.");
    expect(db.events.filter((evento) => evento.type === "post_sale.started")).toHaveLength(1);
  });

  it("é idempotente: segunda execução não reenvia nada", async () => {
    const db = new FakePostSaleDb();
    db.contexts.set("ws_1:lead_1", makeContexto());
    const { deps, outbound } = makeHarness(db);
    const processor = createPostSaleProcessor(deps);
    const job = { name: "schedule-for-lead", data: { workspaceId: "ws_1", leadId: "lead_1" } };

    await processor(job);
    const mensagensAposPrimeira = db.mensagens.length;
    await processor(job);

    expect(db.mensagens).toHaveLength(mensagensAposPrimeira);
    expect(outbound).toHaveLength(mensagensAposPrimeira);
    expect(db.events.filter((evento) => evento.type === "post_sale.started")).toHaveLength(1);
  });

  it("lead inexistente ou com opt-out não é erro de job (resolve sem lançar)", async () => {
    const db = new FakePostSaleDb();
    db.contexts.set("ws_1:lead_optout", makeContexto({ lead: makeLead({ id: "lead_optout", optedOut: true }) }));
    const { deps, outbound } = makeHarness(db);
    const processor = createPostSaleProcessor(deps);

    await expect(
      processor({ name: "schedule-for-lead", data: { workspaceId: "ws_1", leadId: "sumiu" } }),
    ).resolves.toBeUndefined();
    await expect(
      processor({ name: "schedule-for-lead", data: { workspaceId: "ws_1", leadId: "lead_optout" } }),
    ).resolves.toBeUndefined();
    expect(outbound).toHaveLength(0);
  });

  it("respeita os toggles desligados de postSaleFlows", async () => {
    const db = new FakePostSaleDb();
    db.contexts.set(
      "ws_1:lead_1",
      makeContexto({ toggles: { ...TOGGLES_ON, purchaseConfirm: false, accessDelivery: false } }),
    );
    const { deps, outbound, emails } = makeHarness(db);

    await createPostSaleProcessor(deps)({
      name: "schedule-for-lead",
      data: { workspaceId: "ws_1", leadId: "lead_1" },
    });

    expect(outbound).toHaveLength(0);
    expect(emails).toHaveLength(0);
    expect(db.events.filter((evento) => evento.type === "post_sale.started")).toHaveLength(1);
  });
});

describe("createPostSaleProcessor", () => {
  it("lança NotImplementedYetError para job.name desconhecido", async () => {
    const { deps } = makeHarness(new FakePostSaleDb());
    await expect(
      createPostSaleProcessor(deps)({ name: "job-inexistente", data: {} }),
    ).rejects.toBeInstanceOf(NotImplementedYetError);
  });

  it("rejeita payload inválido com erro de validação", async () => {
    const { deps } = makeHarness(new FakePostSaleDb());
    await expect(
      createPostSaleProcessor(deps)({ name: "daily-classification", data: { workspaceId: "" } }),
    ).rejects.toThrowError();
  });
});
