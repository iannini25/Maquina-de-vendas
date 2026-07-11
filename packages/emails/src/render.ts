/**
 * Renderização de e-mails HTML responsivos e dark-friendly usando template
 * strings (zero React em runtime).
 *
 * A shape de `EmailStructure` espelha o campo Json `EmailTemplate.structure`
 * do Prisma (@vendaflow/db).
 */

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailStructureStyle {
  accentColor?: string;
  backgroundColor?: string;
}

export interface EmailStructure {
  headerTitle?: string;
  headerLogoUrl?: string;
  buttons?: EmailButton[];
  footerText?: string;
  style?: EmailStructureStyle;
}

/** Variáveis de personalização: {nome}, {produto}, {link_acesso}, {valor}, {data}. */
export type EmailVars = Record<string, string>;

export interface RenderEmailOptions {
  /** Link de descadastro — obrigatório em todo e-mail enviado. */
  unsubscribeUrl: string;
}

const COR_FUNDO_PADRAO = "#08080B";
const COR_TEXTO = "#F4F4F7";
const COR_TEXTO_SUAVE = "#9CA3AF";
const COR_ACENTO_PADRAO = "#8B5CF6";
const COR_CARTAO = "#111116";
const COR_BORDA = "#26262E";
const FONTE = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Substitui variáveis no formato {chave} pelos valores informados.
 * Variável ausente em `vars` permanece intacta no texto.
 */
export function applyVars(text: string, vars: EmailVars): string {
  return text.replace(/\{([a-z0-9_]+)\}/gi, (original, chave: string) => vars[chave] ?? original);
}

/** Escapa caracteres especiais de HTML (uso em texto e em atributos). */
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Markdown leve: **negrito** e [texto](url). Aplicar APÓS escapeHtml. */
function aplicarMarkdownLeve(texto: string, corAcento: string): string {
  return texto
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_tudo, rotulo: string, url: string) =>
        `<a href="${url}" target="_blank" style="color: ${corAcento}; text-decoration: underline;">${rotulo}</a>`,
    );
}

/** Parágrafos separados por linha em branco; quebra simples vira <br />. */
function renderizarCorpo(bodyText: string, corAcento: string): string {
  return bodyText
    .split(/\r?\n\s*\r?\n/)
    .map((paragrafo) => paragrafo.trim())
    .filter((paragrafo) => paragrafo.length > 0)
    .map((paragrafo) => {
      const conteudo = aplicarMarkdownLeve(escapeHtml(paragrafo), corAcento).replace(
        /\r?\n/g,
        "<br />",
      );
      return `<p style="margin: 0 0 16px; font-family: ${FONTE}; font-size: 16px; line-height: 1.6; color: ${COR_TEXTO};">${conteudo}</p>`;
    })
    .join("\n");
}

function renderizarCabecalho(structure: EmailStructure, vars: EmailVars): string {
  const partes: string[] = [];
  if (structure.headerLogoUrl) {
    const logoUrl = escapeHtml(applyVars(structure.headerLogoUrl, vars));
    partes.push(
      `<img src="${logoUrl}" alt="" width="120" style="display: block; margin: 0 auto; max-width: 160px; height: auto; border: 0;" />`,
    );
  }
  if (structure.headerTitle) {
    const titulo = escapeHtml(applyVars(structure.headerTitle, vars));
    partes.push(
      `<h1 style="margin: 16px 0 0; font-family: ${FONTE}; font-size: 22px; font-weight: 700; line-height: 1.3; color: ${COR_TEXTO};">${titulo}</h1>`,
    );
  }
  if (partes.length === 0) return "";
  return `<tr><td align="center" style="padding: 0 0 24px;">${partes.join("\n")}</td></tr>`;
}

function renderizarBotoes(botoes: EmailButton[], vars: EmailVars, corAcento: string): string {
  if (botoes.length === 0) return "";
  const linhas = botoes
    .map((botao) => {
      const rotulo = escapeHtml(applyVars(botao.label, vars));
      const url = escapeHtml(applyVars(botao.url, vars));
      return `<tr><td align="center" style="padding: 8px 0;"><a href="${url}" target="_blank" style="display: inline-block; background-color: ${corAcento}; color: #FFFFFF; font-family: ${FONTE}; font-size: 16px; font-weight: 600; line-height: 1; text-decoration: none; padding: 14px 32px; border-radius: 8px;">${rotulo}</a></td></tr>`;
    })
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">${linhas}</table>`;
}

function renderizarRodape(
  structure: EmailStructure,
  vars: EmailVars,
  unsubscribeUrl: string,
): string {
  const partes: string[] = [];
  if (structure.footerText) {
    const texto = escapeHtml(applyVars(structure.footerText, vars));
    partes.push(
      `<p style="margin: 0 0 8px; font-family: ${FONTE}; font-size: 12px; line-height: 1.5; color: ${COR_TEXTO_SUAVE};">${texto}</p>`,
    );
  }
  partes.push(
    `<p style="margin: 0; font-family: ${FONTE}; font-size: 12px; line-height: 1.5; color: ${COR_TEXTO_SUAVE};"><a href="${escapeHtml(unsubscribeUrl)}" target="_blank" style="color: ${COR_TEXTO_SUAVE}; text-decoration: underline;">Cancelar inscrição</a></p>`,
  );
  return `<tr><td align="center" style="padding: 24px 8px 0;">${partes.join("\n")}</td></tr>`;
}

/**
 * Monta o HTML completo do e-mail: tabela de 600px, inline styles,
 * fundo escuro e footer com link de descadastro sempre presente.
 */
export function renderEmail(
  structure: EmailStructure,
  bodyText: string,
  vars: EmailVars,
  options: RenderEmailOptions,
): string {
  const corFundo = structure.style?.backgroundColor ?? COR_FUNDO_PADRAO;
  const corAcento = structure.style?.accentColor ?? COR_ACENTO_PADRAO;
  const titulo = structure.headerTitle ? escapeHtml(applyVars(structure.headerTitle, vars)) : "";

  const cabecalho = renderizarCabecalho(structure, vars);
  const corpo = renderizarCorpo(applyVars(bodyText, vars), corAcento);
  const botoes = renderizarBotoes(structure.buttons ?? [], vars, corAcento);
  const rodape = renderizarRodape(structure, vars, options.unsubscribeUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${titulo}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${corFundo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${corFundo};">
<tr><td align="center" style="padding: 32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
${cabecalho}
<tr><td style="background-color: ${COR_CARTAO}; border: 1px solid ${COR_BORDA}; border-radius: 12px; padding: 32px;">
${corpo}
${botoes}
</td></tr>
${rodape}
</table>
</td></tr>
</table>
</body>
</html>`;
}
