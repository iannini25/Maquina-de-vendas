import { renderEmail, type EmailStructure, type EmailVars } from "@sales4u/emails";
import type { Prisma, TenantDb } from "@sales4u/db";

import { hasAiCredential } from "@/lib/ai";
import { formatBRL, formatDateBR } from "@/lib/format";

/**
 * Queries do módulo Templates de E-mail (somente server).
 * Client components importam apenas os TIPOS deste arquivo (`import type`).
 */

export type EmailPurposeDto =
  | "PURCHASE_CONFIRM"
  | "ACCESS"
  | "WELCOME"
  | "NPS"
  | "UPSELL"
  | "REACTIVATION"
  | "PASSWORD"
  | "LIVE_REMINDER"
  | "CUSTOM";

export const PURPOSE_CATEGORY: Record<EmailPurposeDto, string> = {
  PURCHASE_CONFIRM: "Pós-venda",
  ACCESS: "Pós-venda",
  WELCOME: "Automação",
  NPS: "Pós-venda",
  UPSELL: "Pós-venda",
  REACTIVATION: "Automação",
  PASSWORD: "Sistema",
  LIVE_REMINDER: "Campanha",
  CUSTOM: "Personalizado",
};

export const PURPOSE_LABELS: Record<EmailPurposeDto, string> = {
  PURCHASE_CONFIRM: "Confirmação de compra",
  ACCESS: "Entrega de acesso",
  WELCOME: "Boas-vindas",
  NPS: "Pesquisa NPS",
  UPSELL: "Oferta complementar (upsell)",
  REACTIVATION: "Reativação",
  PASSWORD: "Recuperação de senha",
  LIVE_REMINDER: "Lembrete de live",
  CUSTOM: "Personalizado",
};

/** Campos editáveis do template, achatados a partir do Json `structure`. */
export interface EmailTemplateEditorDto {
  id: string | null;
  name: string;
  purpose: EmailPurposeDto;
  status: "DRAFT" | "ACTIVE";
  bodySource: "AI" | "MANUAL";
  bodyText: string;
  headerTitle: string;
  headerLogoUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  footerText: string;
  accentColor: string;
  backgroundColor: string;
}

export interface EmailTemplateCardDto {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE";
  categoryLabel: string;
  /** HTML completo renderizado para o mini-preview do card. */
  previewHtml: string;
}

export interface EmailTemplatesPageData {
  templates: EmailTemplateCardDto[];
  designSystemIndexed: boolean;
}

export interface EmailEditorPageData {
  template: EmailTemplateEditorDto;
  designSystemIndexed: boolean;
  hasAi: boolean;
  /** HTML inicial do preview (o client re-renderiza via action a cada edição). */
  initialHtml: string;
}

const DEFAULT_ACCENT = "#8B5CF6";
const DEFAULT_BACKGROUND = "#08080B";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Achata o Json `structure` do Prisma nos campos do editor, com defaults. */
export function parseStructure(json: Prisma.JsonValue): Omit<
  EmailTemplateEditorDto,
  "id" | "name" | "purpose" | "status" | "bodySource" | "bodyText"
> {
  const raw = (typeof json === "object" && json !== null && !Array.isArray(json) ? json : {}) as Record<string, unknown>;
  const style = (typeof raw.style === "object" && raw.style !== null ? raw.style : {}) as Record<string, unknown>;
  const buttons = Array.isArray(raw.buttons) ? raw.buttons : [];
  const firstButton = (typeof buttons[0] === "object" && buttons[0] !== null ? buttons[0] : {}) as Record<string, unknown>;

  return {
    headerTitle: asString(raw.headerTitle),
    headerLogoUrl: asString(raw.headerLogoUrl),
    buttonLabel: asString(firstButton.label),
    buttonUrl: asString(firstButton.url),
    footerText: asString(raw.footerText),
    accentColor: asString(style.accentColor) || DEFAULT_ACCENT,
    backgroundColor: asString(style.backgroundColor) || DEFAULT_BACKGROUND,
  };
}

/** Monta o `EmailStructure` do pacote de e-mails a partir dos campos achatados. */
export function buildStructure(fields: {
  headerTitle: string;
  headerLogoUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  footerText: string;
  accentColor: string;
  backgroundColor: string;
}): EmailStructure {
  return {
    headerTitle: fields.headerTitle || undefined,
    headerLogoUrl: fields.headerLogoUrl || undefined,
    buttons: fields.buttonLabel
      ? [{ label: fields.buttonLabel, url: fields.buttonUrl || "{link_acesso}" }]
      : [],
    footerText: fields.footerText || undefined,
    style: { accentColor: fields.accentColor, backgroundColor: fields.backgroundColor },
  };
}

/** Vars de exemplo do preview: nome Sérgio + produto/valor reais do workspace. */
export async function sampleVars(db: TenantDb): Promise<EmailVars> {
  const offer = await db.productOffer.findFirst({
    orderBy: { createdAt: "asc" },
    select: { name: true, priceCents: true, accessLinks: true },
  });
  const accessLinks = offer && Array.isArray(offer.accessLinks) ? offer.accessLinks : [];
  const firstLink = typeof accessLinks[0] === "string" ? accessLinks[0] : "";
  return {
    nome: "Sérgio",
    produto: offer?.name ?? "seu produto",
    valor: formatBRL(offer?.priceCents ?? 0),
    link_acesso: firstLink || "https://exemplo.com/acesso",
    data: formatDateBR(new Date()),
  };
}

export async function designSystemIndexed(db: TenantDb): Promise<boolean> {
  const file = await db.contextFile.findFirst({
    where: { type: "DESIGN_SYSTEM", status: "INDEXED" },
    select: { id: true },
  });
  return file !== null;
}

const PREVIEW_UNSUBSCRIBE_URL = "#descadastrar";

export async function getEmailTemplatesPageData(db: TenantDb): Promise<EmailTemplatesPageData> {
  const [templates, dsIndexed, vars] = await Promise.all([
    db.emailTemplate.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, purpose: true, status: true, structure: true, bodyText: true },
    }),
    designSystemIndexed(db),
    sampleVars(db),
  ]);

  return {
    designSystemIndexed: dsIndexed,
    templates: templates.map((template) => {
      const fields = parseStructure(template.structure);
      return {
        id: template.id,
        name: template.name,
        status: template.status,
        categoryLabel: PURPOSE_CATEGORY[template.purpose],
        previewHtml: renderEmail(buildStructure(fields), template.bodyText, vars, {
          unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
        }),
      };
    }),
  };
}

const NEW_TEMPLATE: EmailTemplateEditorDto = {
  id: null,
  name: "",
  purpose: "CUSTOM",
  status: "DRAFT",
  bodySource: "MANUAL",
  bodyText: "Olá {nome}! Seu acesso ao {produto} está pronto…",
  headerTitle: "",
  headerLogoUrl: "",
  buttonLabel: "Acessar o curso",
  buttonUrl: "{link_acesso}",
  footerText: "",
  accentColor: DEFAULT_ACCENT,
  backgroundColor: DEFAULT_BACKGROUND,
};

/** Dados do editor. `id === null` → template novo (defaults). Retorna null se o id não existir. */
export async function getEmailEditorPageData(
  db: TenantDb,
  workspaceId: string,
  id: string | null,
): Promise<EmailEditorPageData | null> {
  const [dsIndexed, hasAi, vars, workspaceName] = await Promise.all([
    designSystemIndexed(db),
    hasAiCredential(workspaceId),
    sampleVars(db),
    db.workspace
      .findFirst({ select: { name: true } })
      .then((workspace) => workspace?.name ?? ""),
  ]);

  let template: EmailTemplateEditorDto;
  if (id === null) {
    template = { ...NEW_TEMPLATE, headerTitle: workspaceName };
  } else {
    const record = await db.emailTemplate.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        purpose: true,
        status: true,
        bodySource: true,
        bodyText: true,
        structure: true,
      },
    });
    if (!record) return null;
    template = {
      id: record.id,
      name: record.name,
      purpose: record.purpose,
      status: record.status,
      bodySource: record.bodySource,
      bodyText: record.bodyText,
      ...parseStructure(record.structure),
    };
  }

  return {
    template,
    designSystemIndexed: dsIndexed,
    hasAi,
    initialHtml: renderEmail(buildStructure(template), template.bodyText, vars, {
      unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
    }),
  };
}
