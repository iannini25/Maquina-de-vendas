import { createHmac, timingSafeEqual } from "node:crypto";

import { applyVars, renderEmail, type EmailStructure, type EmailVars } from "@vendaflow/emails";

import { NotImplementedYetError } from "../errors.js";
import {
  POST_SALE_JOBS,
  postSaleJobSchema,
  type EmailJobPayload,
  type OutboundJobPayload,
  type PostSaleJobPayload,
} from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "post-sale" — régua pós-compra e monitor de uso.
 * Lógica pura com dependências injetadas; o wiring real (prisma, filas
 * outbound/email, env) está em post-sale.wiring.ts e é carregado sob
 * demanda — testes com deps completas nunca tocam banco/redis.
 *
 * Jobs:
 * - schedule-for-lead: confirmação de compra (WhatsApp + e-mail) e entrega
 *   de acesso logo após o lead virar cliente. Idempotente por EventLog
 *   post_sale.started.
 * - daily-classification: varre AccessGrants (nudge de não-uso, IDLE/ACTIVE,
 *   reengajamento) e Orders pagas (NPS, upsell). Tudo idempotente por
 *   EventLog e com guarda de opt-out.
 */

// ── Constantes de negócio ───────────────────────────────────────────────────

const DIA_EM_MS = 86_400_000;
/** Dias sem primeiro acesso até o toque "vi que não usou". */
const NUDGE_APOS_DIAS = 2;
/** Dias após a compra para pedir o NPS. */
const NPS_APOS_DIAS = 7;
/** Reengajamento de acesso ocioso é no máximo 1x por semana. */
const REENGAJE_INTERVALO_DIAS = 7;
/**
 * Janela máxima (em dias, além do gatilho) em que a varredura ainda dispara
 * NPS/upsell — evita backfill em massa para pedidos antigos na 1ª execução.
 */
const JANELA_MAXIMA_VARREDURA_DIAS = 30;
/** Validade padrão do token de opt-out. */
const OPTOUT_TTL_DIAS = 365;

// ── Toggles de Workspace.settings.postSaleFlows ─────────────────────────────

/** Toggles da régua pós-venda (Workspace.settings.postSaleFlows) — default tudo ligado. */
export interface PostSaleFlowToggles {
  purchaseConfirm: boolean;
  accessDelivery: boolean;
  nudge: boolean;
  reengage: boolean;
  nps: boolean;
  upsell: boolean;
}

const TOGGLES_PADRAO: PostSaleFlowToggles = {
  purchaseConfirm: true,
  accessDelivery: true,
  nudge: true,
  reengage: true,
  nps: true,
  upsell: true,
};

/** Lê os toggles de um Workspace.settings (Json) com default tudo ligado. */
export function resolvePostSaleToggles(settings: unknown): PostSaleFlowToggles {
  if (typeof settings !== "object" || settings === null) return { ...TOGGLES_PADRAO };
  const flows = (settings as Record<string, unknown>).postSaleFlows;
  if (typeof flows !== "object" || flows === null) return { ...TOGGLES_PADRAO };
  const registro = flows as Record<string, unknown>;
  const lido = (chave: keyof PostSaleFlowToggles): boolean =>
    typeof registro[chave] === "boolean" ? (registro[chave] as boolean) : TOGGLES_PADRAO[chave];
  return {
    purchaseConfirm: lido("purchaseConfirm"),
    accessDelivery: lido("accessDelivery"),
    nudge: lido("nudge"),
    reengage: lido("reengage"),
    nps: lido("nps"),
    upsell: lido("upsell"),
  };
}

// ── Token de opt-out (HMAC-SHA256) ──────────────────────────────────────────

function assinarOptout(leadId: string, exp: number, secret: string): string {
  return createHmac("sha256", secret).update(`${leadId}.${exp}`).digest("hex");
}

/** Gera token de opt-out no formato "leadId.exp.assinaturaHex" (exp em epoch ms). */
export function makeOptoutToken(
  leadId: string,
  secret: string,
  now: Date = new Date(),
  ttlDias: number = OPTOUT_TTL_DIAS,
): string {
  const exp = now.getTime() + ttlDias * DIA_EM_MS;
  return `${leadId}.${exp}.${assinarOptout(leadId, exp, secret)}`;
}

/** Verifica o token de opt-out; retorna o leadId ou null (inválido/expirado). */
export function verifyOptoutToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [leadId, expBruto, assinatura] = partes;
  if (!leadId || !expBruto || !assinatura) return null;
  const exp = Number(expBruto);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return null;
  const esperada = Buffer.from(assinarOptout(leadId, exp, secret), "hex");
  const recebida = Buffer.from(assinatura, "hex");
  if (recebida.length !== esperada.length || recebida.length === 0) return null;
  return timingSafeEqual(recebida, esperada) ? leadId : null;
}

// ── Contratos das dependências (implementados pelo wiring / fakes) ──────────

export type GrantStatus = "NEVER" | "ACCESSED" | "ACTIVE" | "IDLE";
export type PostSaleAutonomy = "DRAFT" | "SEMI" | "AUTO";
export type EmailPurposePostSale = "PURCHASE_CONFIRM" | "NPS" | "UPSELL";

export interface PostSaleLead {
  id: string;
  name: string;
  email: string | null;
  optedOut: boolean;
}

/** Contexto necessário para a régua imediata de um lead recém-convertido. */
export interface LeadContext {
  lead: PostSaleLead;
  toggles: PostSaleFlowToggles;
  grant: { trackedToken: string } | null;
  order: { valueCents: number; productName: string } | null;
}

/** AccessGrant achatado para a classificação diária. */
export interface GrantRecord {
  id: string;
  workspaceId: string;
  status: GrantStatus;
  createdAt: Date;
  firstAccessAt: Date | null;
  lastActivityAt: Date | null;
  idleThresholdDays: number;
  trackedToken: string;
  productName: string;
  lead: PostSaleLead;
  toggles: PostSaleFlowToggles;
}

/** Order paga achatada para NPS/upsell da varredura diária. */
export interface OrderRecord {
  id: string;
  workspaceId: string;
  paidAt: Date;
  valueCents: number;
  productName: string;
  upsellWindowDays: number;
  trackedToken: string | null;
  lead: PostSaleLead | null;
  toggles: PostSaleFlowToggles;
}

export interface EmailTemplateRecord {
  name: string;
  structure: EmailStructure;
  bodyText: string;
}

export interface OutMessageRef {
  conversationId: string;
  messageId: string;
}

export interface PostSaleEvent {
  workspaceId: string;
  type: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
}

export interface UpsellApprovalInput {
  workspaceId: string;
  leadId: string;
  text: string;
  orderId: string;
  productName: string;
}

/** Porta de dados do pós-venda — o wiring implementa com prisma. */
export interface PostSaleDb {
  getLeadContext(workspaceId: string, leadId: string): Promise<LeadContext | null>;
  hasEventSince(
    workspaceId: string,
    type: string,
    entityId: string,
    since?: Date,
  ): Promise<boolean>;
  logEvent(event: PostSaleEvent): Promise<void>;
  /** Cria a Message OUT (QUEUED) na conversa WhatsApp do lead (cria a conversa se preciso). */
  createOutboundMessage(workspaceId: string, leadId: string, text: string): Promise<OutMessageRef>;
  getEmailTemplate(
    workspaceId: string,
    purpose: EmailPurposePostSale,
  ): Promise<EmailTemplateRecord | null>;
  listGrants(workspaceId?: string): Promise<GrantRecord[]>;
  listPaidOrders(workspaceId?: string): Promise<OrderRecord[]>;
  setGrantStatus(grantId: string, status: "ACTIVE" | "IDLE"): Promise<void>;
  /** Autonomia do playbook do estágio POST_SALE do workspace (null = sem playbook). */
  getPostSaleAutonomy(workspaceId: string): Promise<PostSaleAutonomy | null>;
  createUpsellApproval(input: UpsellApprovalInput): Promise<void>;
}

export interface PostSaleDeps {
  db: PostSaleDb;
  enqueueOutbound(payload: OutboundJobPayload): Promise<void>;
  enqueueEmail(payload: EmailJobPayload): Promise<void>;
  /** Base pública do app (sem barra final) — links /a/<token> e opt-out. */
  appUrl: string;
  /** Segredo HMAC do token de opt-out (env AUTH_SECRET). */
  optoutSecret: string;
  now(): Date;
  log: Log;
}

/** Deps sem o relógio — o que o wiring precisa fornecer. */
export type PostSaleWiring = Omit<PostSaleDeps, "log" | "now">;

/** index.ts chama com { log }; testes injetam as deps completas. */
export type PostSaleOptions = { log: Log; now?(): Date } & Partial<PostSaleWiring>;

// ── Factory ─────────────────────────────────────────────────────────────────

/** Cria o processor da fila "post-sale". */
export function createPostSaleProcessor(options: PostSaleOptions): JobProcessor {
  let deps: PostSaleDeps | undefined;
  return async (job: JobLike): Promise<void> => {
    const payload = postSaleJobSchema.parse(job.data);
    switch (job.name) {
      case POST_SALE_JOBS.scheduleForLead:
        deps ??= await resolveDeps(options);
        return scheduleForLead(deps, payload);
      case POST_SALE_JOBS.dailyClassification:
        deps ??= await resolveDeps(options);
        return runDailyClassification(deps, payload);
      default:
        throw new NotImplementedYetError("post-sale", job.name);
    }
  };
}

function temWiringCompleto(options: PostSaleOptions): options is PostSaleOptions & PostSaleWiring {
  return (
    options.db !== undefined &&
    options.enqueueOutbound !== undefined &&
    options.enqueueEmail !== undefined &&
    options.appUrl !== undefined &&
    options.optoutSecret !== undefined
  );
}

async function resolveDeps(options: PostSaleOptions): Promise<PostSaleDeps> {
  const now = options.now ?? ((): Date => new Date());
  if (temWiringCompleto(options)) return { ...options, now };
  const { createPostSaleWiring } = await import("./post-sale.wiring.js");
  const wiring = createPostSaleWiring();
  return {
    log: options.log,
    now,
    db: options.db ?? wiring.db,
    enqueueOutbound: options.enqueueOutbound ?? wiring.enqueueOutbound,
    enqueueEmail: options.enqueueEmail ?? wiring.enqueueEmail,
    appUrl: options.appUrl ?? wiring.appUrl,
    optoutSecret: options.optoutSecret ?? wiring.optoutSecret,
  };
}

// ── schedule-for-lead ───────────────────────────────────────────────────────

async function scheduleForLead(deps: PostSaleDeps, payload: PostSaleJobPayload): Promise<void> {
  const { workspaceId, leadId } = payload;
  if (!workspaceId || !leadId) {
    deps.log.error({ payload }, "schedule-for-lead sem workspaceId/leadId — job ignorado");
    return;
  }

  const contexto = await deps.db.getLeadContext(workspaceId, leadId);
  if (!contexto) {
    deps.log.warn({ workspaceId, leadId }, "lead não encontrado — pós-venda ignorado");
    return;
  }
  if (contexto.lead.optedOut) {
    deps.log.info({ workspaceId, leadId }, "lead com opt-out — pós-venda não disparado");
    return;
  }
  if (await deps.db.hasEventSince(workspaceId, "post_sale.started", leadId)) {
    deps.log.info({ workspaceId, leadId }, "pós-venda já iniciado para o lead — ignorado");
    return;
  }

  const produto = contexto.order?.productName ?? "sua compra";
  const linkAcesso = contexto.grant ? trackedLink(deps.appUrl, contexto.grant.trackedToken) : null;

  let confirmacaoWhatsApp = false;
  let confirmacaoEmail = false;
  let acessoEntregue = false;

  if (contexto.toggles.purchaseConfirm) {
    await sendWhatsAppText(deps, workspaceId, leadId, purchaseConfirmText(contexto.lead.name, produto));
    confirmacaoWhatsApp = true;
    confirmacaoEmail = await sendPurchaseConfirmEmail(deps, workspaceId, contexto, produto, linkAcesso);
  }

  if (contexto.toggles.accessDelivery && linkAcesso) {
    await sendWhatsAppText(deps, workspaceId, leadId, accessDeliveryText(produto, linkAcesso));
    acessoEntregue = true;
  }

  await deps.db.logEvent({
    workspaceId,
    type: "post_sale.started",
    entity: "Lead",
    entityId: leadId,
    data: { confirmacaoWhatsApp, confirmacaoEmail, acessoEntregue },
  });
  deps.log.info(
    { workspaceId, leadId, confirmacaoWhatsApp, confirmacaoEmail, acessoEntregue },
    "régua pós-venda iniciada",
  );
}

async function sendPurchaseConfirmEmail(
  deps: PostSaleDeps,
  workspaceId: string,
  contexto: LeadContext,
  produto: string,
  linkAcesso: string | null,
): Promise<boolean> {
  const email = contexto.lead.email;
  if (!email || !pareceEmailValido(email)) return false;

  const template = await deps.db.getEmailTemplate(workspaceId, "PURCHASE_CONFIRM");
  if (!template) {
    deps.log.warn(
      { workspaceId, leadId: contexto.lead.id },
      "workspace sem EmailTemplate PURCHASE_CONFIRM — confirmação só por WhatsApp",
    );
    return false;
  }

  const vars: EmailVars = {
    nome: contexto.lead.name,
    produto,
    link_acesso: linkAcesso ?? deps.appUrl,
    data: new Intl.DateTimeFormat("pt-BR").format(deps.now()),
  };
  if (contexto.order) vars.valor = formatBRL(contexto.order.valueCents);

  const unsubscribeUrl = `${deps.appUrl}/api/optout?token=${makeOptoutToken(contexto.lead.id, deps.optoutSecret, deps.now())}`;
  const html = renderEmail(template.structure, template.bodyText, vars, { unsubscribeUrl });
  const subject = applyVars(template.structure.headerTitle ?? "Compra confirmada, {nome}!", vars);

  await deps.enqueueEmail({ workspaceId, to: email, subject, html });
  return true;
}

// ── daily-classification ────────────────────────────────────────────────────

async function runDailyClassification(
  deps: PostSaleDeps,
  payload: PostSaleJobPayload,
): Promise<void> {
  const now = deps.now();
  let falhas = 0;

  const grants = await deps.db.listGrants(payload.workspaceId);
  for (const grant of grants) {
    try {
      await classificarEAgir(deps, grant, now);
    } catch (error) {
      falhas += 1;
      deps.log.error(
        { grantId: grant.id, err: error instanceof Error ? error.message : String(error) },
        "falha ao classificar AccessGrant",
      );
    }
  }

  const orders = await deps.db.listPaidOrders(payload.workspaceId);
  for (const order of orders) {
    try {
      await dispararNps(deps, order, now);
      await dispararUpsell(deps, order, now);
    } catch (error) {
      falhas += 1;
      deps.log.error(
        { orderId: order.id, err: error instanceof Error ? error.message : String(error) },
        "falha em NPS/upsell da order",
      );
    }
  }

  deps.log.info(
    { grants: grants.length, orders: orders.length, falhas },
    "classificação diária concluída",
  );
  if (falhas > 0) {
    // Itens já processados são idempotentes — o retry do BullMQ só refaz o que falhou.
    throw new Error(`classificação diária: ${falhas} itens falharam`);
  }
}

/** Decisão pura da classificação de um AccessGrant. */
export type GrantAction = "nudge" | "reengage" | "activate" | "none";

export function classifyGrant(
  grant: Pick<
    GrantRecord,
    "status" | "createdAt" | "firstAccessAt" | "lastActivityAt" | "idleThresholdDays"
  >,
  now: Date,
): GrantAction {
  if (grant.status === "NEVER" && !grant.firstAccessAt) {
    return daysBetween(grant.createdAt, now) > NUDGE_APOS_DIAS ? "nudge" : "none";
  }
  if (!grant.lastActivityAt) return "none";
  const diasOcioso = daysBetween(grant.lastActivityAt, now);
  return diasOcioso > grant.idleThresholdDays ? "reengage" : "activate";
}

async function classificarEAgir(deps: PostSaleDeps, grant: GrantRecord, now: Date): Promise<void> {
  switch (classifyGrant(grant, now)) {
    case "nudge":
      return dispararNudge(deps, grant);
    case "reengage":
      return dispararReengajamento(deps, grant, now);
    case "activate":
      return marcarAtivo(deps, grant);
    case "none":
      return;
  }
}

async function dispararNudge(deps: PostSaleDeps, grant: GrantRecord): Promise<void> {
  if (!grant.toggles.nudge || grant.lead.optedOut) return;
  if (await deps.db.hasEventSince(grant.workspaceId, "access.nudge_sent", grant.id)) return;

  const link = trackedLink(deps.appUrl, grant.trackedToken);
  await sendWhatsAppText(deps, grant.workspaceId, grant.lead.id, nudgeText(grant.lead.name, grant.productName, link));
  await deps.db.logEvent({
    workspaceId: grant.workspaceId,
    type: "access.nudge_sent",
    entity: "AccessGrant",
    entityId: grant.id,
    data: { leadId: grant.lead.id },
  });
}

async function dispararReengajamento(
  deps: PostSaleDeps,
  grant: GrantRecord,
  now: Date,
): Promise<void> {
  if (grant.status !== "IDLE") {
    await deps.db.setGrantStatus(grant.id, "IDLE");
    await registrarMudancaDeStatus(deps, grant, "IDLE");
  }
  if (!grant.toggles.reengage || grant.lead.optedOut) return;

  const umaSemanaAtras = new Date(now.getTime() - REENGAJE_INTERVALO_DIAS * DIA_EM_MS);
  if (await deps.db.hasEventSince(grant.workspaceId, "access.reengage_sent", grant.id, umaSemanaAtras)) {
    return;
  }

  const link = trackedLink(deps.appUrl, grant.trackedToken);
  await sendWhatsAppText(deps, grant.workspaceId, grant.lead.id, reengageText(grant.lead.name, grant.productName, link));
  await deps.db.logEvent({
    workspaceId: grant.workspaceId,
    type: "access.reengage_sent",
    entity: "AccessGrant",
    entityId: grant.id,
    data: { leadId: grant.lead.id },
  });
}

async function marcarAtivo(deps: PostSaleDeps, grant: GrantRecord): Promise<void> {
  if (grant.status === "ACTIVE") return;
  await deps.db.setGrantStatus(grant.id, "ACTIVE");
  await registrarMudancaDeStatus(deps, grant, "ACTIVE");
}

async function registrarMudancaDeStatus(
  deps: PostSaleDeps,
  grant: GrantRecord,
  para: "ACTIVE" | "IDLE",
): Promise<void> {
  await deps.db.logEvent({
    workspaceId: grant.workspaceId,
    type: "access.status_changed",
    entity: "AccessGrant",
    entityId: grant.id,
    data: { de: grant.status, para, leadId: grant.lead.id },
  });
}

async function dispararNps(deps: PostSaleDeps, order: OrderRecord, now: Date): Promise<void> {
  if (!order.toggles.nps || !order.lead || order.lead.optedOut) return;
  if (!estaNaJanela(order.paidAt, now, NPS_APOS_DIAS)) return;
  if (await deps.db.hasEventSince(order.workspaceId, "nps.sent", order.id)) return;

  const enviadoPorEmail = await enviarNpsPorEmail(deps, order);
  if (!enviadoPorEmail) {
    await sendWhatsAppText(deps, order.workspaceId, order.lead.id, npsText(order.lead.name, order.productName));
  }
  await deps.db.logEvent({
    workspaceId: order.workspaceId,
    type: "nps.sent",
    entity: "Order",
    entityId: order.id,
    data: { leadId: order.lead.id, via: enviadoPorEmail ? "email" : "whatsapp" },
  });
}

async function enviarNpsPorEmail(deps: PostSaleDeps, order: OrderRecord): Promise<boolean> {
  const lead = order.lead;
  if (!lead?.email || !pareceEmailValido(lead.email)) return false;
  const template = await deps.db.getEmailTemplate(order.workspaceId, "NPS");
  if (!template) return false;

  const vars: EmailVars = {
    nome: lead.name,
    produto: order.productName,
    valor: formatBRL(order.valueCents),
    link_acesso: order.trackedToken ? trackedLink(deps.appUrl, order.trackedToken) : deps.appUrl,
    data: new Intl.DateTimeFormat("pt-BR").format(deps.now()),
  };
  const unsubscribeUrl = `${deps.appUrl}/api/optout?token=${makeOptoutToken(lead.id, deps.optoutSecret, deps.now())}`;
  const html = renderEmail(template.structure, template.bodyText, vars, { unsubscribeUrl });
  const subject = applyVars(template.structure.headerTitle ?? "Uma pergunta, 10 segundos", vars);

  await deps.enqueueEmail({ workspaceId: order.workspaceId, to: lead.email, subject, html });
  return true;
}

async function dispararUpsell(deps: PostSaleDeps, order: OrderRecord, now: Date): Promise<void> {
  if (!order.toggles.upsell || !order.lead || order.lead.optedOut) return;
  if (!estaNaJanela(order.paidAt, now, order.upsellWindowDays)) return;
  if (await deps.db.hasEventSince(order.workspaceId, "upsell.sent", order.id)) return;

  const texto = upsellText(order.lead.name, order.productName);
  const autonomia = (await deps.db.getPostSaleAutonomy(order.workspaceId)) ?? "SEMI";

  if (autonomia === "AUTO") {
    await sendWhatsAppText(deps, order.workspaceId, order.lead.id, texto);
  } else {
    // SEMI/DRAFT: o upsell vira Approval MESSAGE_DRAFT para revisão humana.
    await deps.db.createUpsellApproval({
      workspaceId: order.workspaceId,
      leadId: order.lead.id,
      text: texto,
      orderId: order.id,
      productName: order.productName,
    });
  }

  await deps.db.logEvent({
    workspaceId: order.workspaceId,
    type: "upsell.sent",
    entity: "Order",
    entityId: order.id,
    data: { leadId: order.lead.id, modo: autonomia === "AUTO" ? "auto" : "approval" },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function sendWhatsAppText(
  deps: PostSaleDeps,
  workspaceId: string,
  leadId: string,
  text: string,
): Promise<void> {
  const ref = await deps.db.createOutboundMessage(workspaceId, leadId, text);
  await deps.enqueueOutbound({
    workspaceId,
    conversationId: ref.conversationId,
    messageId: ref.messageId,
    kind: "TEXT",
    payload: { text },
  });
}

/** Gatilho em `aposDias` com teto de varredura — evita backfill de pedidos antigos. */
function estaNaJanela(paidAt: Date, now: Date, aposDias: number): boolean {
  const idade = daysBetween(paidAt, now);
  return idade >= aposDias && idade < aposDias + JANELA_MAXIMA_VARREDURA_DIAS;
}

function daysBetween(de: Date, ate: Date): number {
  return (ate.getTime() - de.getTime()) / DIA_EM_MS;
}

function trackedLink(appUrl: string, trackedToken: string): string {
  return `${appUrl}/a/${trackedToken}`;
}

function pareceEmailValido(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

const formatadorBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(valueCents: number): string {
  return formatadorBRL.format(valueCents / 100);
}

// ── Textos da régua (curtos, PT-BR) ─────────────────────────────────────────

export function purchaseConfirmText(nome: string, produto: string): string {
  return `🎉 ${nome}, sua compra de ${produto} foi confirmada! Obrigado pela confiança — qualquer dúvida, é só responder por aqui.`;
}

export function accessDeliveryText(produto: string, link: string): string {
  return `Seu acesso a ${produto} já está liberado: ${link}`;
}

function nudgeText(nome: string, produto: string, link: string): string {
  return `Oi ${nome}! Vi que você ainda não acessou ${produto}. Seu link está aqui: ${link} — se travou em algo, me chama que eu ajudo. 😉`;
}

function reengageText(nome: string, produto: string, link: string): string {
  return `${nome}, sentimos sua falta em ${produto}! Seu acesso continua ativo: ${link} — 15 minutos hoje já colocam você de volta no ritmo.`;
}

function npsText(nome: string, produto: string): string {
  return `${nome}, de 0 a 10, o quanto você recomendaria ${produto} para um amigo? Responda com um número — leva 10 segundos e ajuda muito. 🙏`;
}

function upsellText(nome: string, produto: string): string {
  return `${nome}, preparamos uma condição exclusiva para quem já tem ${produto}. Quer que eu te conte os detalhes?`;
}
