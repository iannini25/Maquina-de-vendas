"use server";

import {
  applyVars,
  createEmailSender,
  renderEmail,
  EmailSendError,
} from "@sales4u/emails";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { completeWithUsage, hasAiCredential, MissingAiCredentialError } from "@/lib/ai";
import { logEvent } from "@/lib/events";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireWorkspace } from "@/lib/session";
import { putObject } from "@/lib/storage";
import { getCredentialData } from "@/server/credentials/service";

import { buildStructure, sampleVars, PURPOSE_LABELS, type EmailPurposeDto } from "./queries";

/**
 * Server Actions do módulo Templates de E-mail: salvar/ativar, gerar corpo
 * com IA (lendo o Design System real), preview renderizado, upload de logo
 * e envio de teste (Resend do workspace ou SMTP dev).
 */

const GENERIC_ERROR = "Algo deu errado. Tente de novo em instantes.";

const purposeEnum = z.enum([
  "PURCHASE_CONFIRM",
  "ACCESS",
  "WELCOME",
  "NPS",
  "UPSELL",
  "REACTIVATION",
  "PASSWORD",
  "LIVE_REMINDER",
  "CUSTOM",
]);

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida — use o formato #RRGGBB.");

const templateFieldsSchema = z.object({
  id: z.string().min(1).nullable(),
  name: z.string().trim().min(1, "Dê um nome ao template.").max(80),
  purpose: purposeEnum,
  bodySource: z.enum(["AI", "MANUAL"]),
  bodyText: z.string().max(8000),
  headerTitle: z.string().trim().max(120),
  headerLogoUrl: z.string().trim().max(600),
  buttonLabel: z.string().trim().max(80),
  buttonUrl: z.string().trim().max(600),
  footerText: z.string().trim().max(300),
  accentColor: colorSchema,
  backgroundColor: colorSchema,
});

export type EmailTemplateFieldsInput = z.infer<typeof templateFieldsSchema>;

// ── Salvar / Ativar ─────────────────────────────────────────────────────────

export interface SaveTemplateResult {
  ok: boolean;
  error?: string;
  id?: string;
  status?: "DRAFT" | "ACTIVE";
}

async function persistTemplate(
  input: unknown,
  nextStatus: "DRAFT" | "ACTIVE" | null,
): Promise<SaveTemplateResult> {
  const parsed = templateFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const ctx = await requireWorkspace();
    const fields = parsed.data;
    const structure = JSON.parse(JSON.stringify(buildStructure(fields))) as Record<string, unknown>;

    let id = fields.id;
    let status: "DRAFT" | "ACTIVE";

    if (id) {
      const existing = await ctx.db.emailTemplate.findFirst({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) return { ok: false, error: "Template não encontrado." };
      status = nextStatus ?? existing.status;
      await ctx.db.emailTemplate.update({
        where: { id },
        data: {
          name: fields.name,
          purpose: fields.purpose,
          bodySource: fields.bodySource,
          bodyText: fields.bodyText,
          structure,
          status,
        },
      });
    } else {
      status = nextStatus ?? "DRAFT";
      const created = await ctx.db.emailTemplate.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: fields.name,
          purpose: fields.purpose,
          bodySource: fields.bodySource,
          bodyText: fields.bodyText,
          structure,
          status,
        },
        select: { id: true },
      });
      id = created.id;
    }

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: nextStatus === "ACTIVE" ? "email_template.activated" : "email_template.saved",
      entity: "EmailTemplate",
      entityId: id,
      data: { name: fields.name, purpose: fields.purpose, status },
    });

    revalidatePath("/emails");
    revalidatePath(`/emails/${id}`);
    return { ok: true, id, status };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveEmailTemplateAction(input: unknown): Promise<SaveTemplateResult> {
  return persistTemplate(input, null);
}

/** "Ativar": salva e publica o template (status ACTIVE). */
export async function activateEmailTemplateAction(input: unknown): Promise<SaveTemplateResult> {
  return persistTemplate(input, "ACTIVE");
}

// ── Preview renderizado (renderEmail do pacote de e-mails) ──────────────────

export interface RenderPreviewResult {
  ok: boolean;
  error?: string;
  html?: string;
}

const previewSchema = templateFieldsSchema.omit({ id: true, name: true }).extend({
  name: z.string().max(80).optional(),
});

export async function renderEmailPreviewAction(input: unknown): Promise<RenderPreviewResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const ctx = await requireWorkspace();
    const vars = await sampleVars(ctx.db);
    const html = renderEmail(buildStructure(parsed.data), parsed.data.bodyText, vars, {
      unsubscribeUrl: "#descadastrar",
    });
    return { ok: true, html };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Gerar corpo com IA (lê o Design System real) ────────────────────────────

export interface GenerateBodyResult {
  ok: boolean;
  missingCredential?: boolean;
  error?: string;
  bodyText?: string;
}

const generateBodySchema = z.object({
  purpose: purposeEnum,
  name: z.string().trim().max(80),
  currentBody: z.string().max(8000),
});

export async function generateEmailBodyAction(input: {
  purpose: EmailPurposeDto;
  name: string;
  currentBody: string;
}): Promise<GenerateBodyResult> {
  const parsed = generateBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const ctx = await requireWorkspace();

    if (!(await hasAiCredential(ctx.workspaceId))) {
      return {
        ok: false,
        missingCredential: true,
        error: "Configure sua chave da Anthropic em Configurações para usar a IA.",
      };
    }

    const limit = RATE_LIMITS.aiGeneration;
    const rl = await rateLimit(`email-body:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
    if (!rl.allowed) {
      return { ok: false, error: `Muitas gerações seguidas — aguarde ${rl.resetInSeconds}s e tente de novo.` };
    }

    const [designSystem, offer] = await Promise.all([
      ctx.db.contextFile.findFirst({
        where: { type: "DESIGN_SYSTEM", status: "INDEXED" },
        select: { rawText: true },
      }),
      ctx.db.productOffer.findFirst({
        orderBy: { createdAt: "asc" },
        select: { name: true },
      }),
    ]);

    const system = [
      "Você escreve o corpo de e-mails em português do Brasil para um negócio digital.",
      designSystem?.rawText
        ? `Siga FIELMENTE o Design System da marca abaixo (cores são para referência de tom; o que importa aqui é tom de voz, personalidade e regras):\n---\n${designSystem.rawText}\n---`
        : "O workspace ainda não tem Design System cadastrado: use tom direto, caloroso e sem jargão.",
      offer ? `Produto principal do workspace: ${offer.name}.` : "",
      "Use as variáveis {nome}, {produto}, {link_acesso}, {valor} e {data} quando fizer sentido.",
      "Regras: parágrafos curtos separados por linha em branco; pode usar **negrito** com moderação;",
      "nunca invente preço, prazo ou promessa; sem assunto, sem assinatura e sem HTML; no máximo 120 palavras.",
      "Responda SOMENTE com o texto do corpo do e-mail.",
    ]
      .filter(Boolean)
      .join("\n");

    const userContent = [
      `Propósito do e-mail: ${PURPOSE_LABELS[parsed.data.purpose]}.`,
      parsed.data.name ? `Nome do template: ${parsed.data.name}.` : "",
      parsed.data.currentBody.trim()
        ? `Corpo atual (reescreva melhor, mantendo a intenção):\n${parsed.data.currentBody.trim()}`
        : "Escreva o corpo do zero.",
    ]
      .filter(Boolean)
      .join("\n");

    const bodyText = (
      await completeWithUsage({
        workspaceId: ctx.workspaceId,
        feature: "emails.body",
        tier: "chat",
        system,
        messages: [{ role: "user", content: userContent }],
        maxTokens: 600,
      })
    ).trim();

    if (!bodyText) return { ok: false, error: "A IA não retornou conteúdo. Tente de novo." };
    return { ok: true, bodyText };
  } catch (error) {
    if (error instanceof MissingAiCredentialError) {
      return { ok: false, missingCredential: true, error: error.message };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ── Upload do logo (putObject) ──────────────────────────────────────────────

export interface UploadLogoResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const LOGO_MAX_BYTES = 1024 * 1024;

export async function uploadEmailLogoAction(formData: FormData): Promise<UploadLogoResult> {
  try {
    const ctx = await requireWorkspace();

    const file = formData.get("logo");
    if (!(file instanceof File)) return { ok: false, error: "Selecione um arquivo de imagem." };
    const extension = LOGO_TYPES[file.type];
    if (!extension) return { ok: false, error: "Formato não suportado — use PNG, JPG, WebP ou SVG." };
    if (file.size > LOGO_MAX_BYTES) return { ok: false, error: "Imagem grande demais — máximo de 1 MB." };

    const key = `emails/${ctx.workspaceId}/logo-${Date.now()}.${extension}`;
    await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);

    const endpoint = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "http://localhost:9000";
    const bucket = process.env.S3_BUCKET ?? "sales4u";
    return { ok: true, url: `${endpoint}/${bucket}/${key}` };
  } catch {
    return {
      ok: false,
      error: "Não foi possível enviar o logo — verifique o armazenamento (S3/MinIO) nas credenciais.",
    };
  }
}

// ── Testar envio ────────────────────────────────────────────────────────────

export interface SendTestResult {
  ok: boolean;
  error?: string;
}

const sendTestSchema = z.object({
  to: z.string().trim().email("Informe um e-mail válido."),
  fields: previewSchema,
});

export async function sendTestEmailAction(input: unknown): Promise<SendTestResult> {
  const parsed = sendTestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const ctx = await requireWorkspace();
    const { to, fields } = parsed.data;

    const resend = await getCredentialData(ctx.workspaceId, "RESEND");
    if (!resend?.apiKey && process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "Configure a credencial do Resend em Configurações para enviar e-mails.",
      };
    }

    const limit = RATE_LIMITS.aiGeneration;
    const rl = await rateLimit(`email-test:${ctx.workspaceId}`, limit.max, limit.windowSeconds);
    if (!rl.allowed) {
      return { ok: false, error: `Muitos envios seguidos — aguarde ${rl.resetInSeconds}s e tente de novo.` };
    }

    const vars = await sampleVars(ctx.db);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const html = renderEmail(buildStructure(fields), fields.bodyText, vars, {
      unsubscribeUrl: `${appUrl}/api/optout?token=test`,
    });
    const subject = `[Teste] ${applyVars(fields.headerTitle || fields.name || "Template de e-mail", vars)}`;

    const sender = createEmailSender({ resendApiKey: resend?.apiKey });
    const from = resend?.domain
      ? `Sales4U <no-reply@${resend.domain}>`
      : "Sales4U <teste@sales4u.local>";

    await sender.send({ to, subject, html, from });

    await logEvent({
      workspaceId: ctx.workspaceId,
      actorType: "USER",
      actorId: ctx.userId,
      type: "email_template.test_sent",
      entity: "EmailTemplate",
      entityId: fields.name || "novo",
      data: { to },
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof EmailSendError) {
      return { ok: false, error: `Falha no envio: ${error.message}` };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
}
