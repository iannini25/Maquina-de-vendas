import type { EmailStructure } from "./render.js";

/**
 * Templates seed de e-mail em PT-BR, prontos para popular EmailTemplate.
 * Os valores de `purpose` espelham o enum `EmailPurpose` do Prisma
 * (@sales4u/db) — a fonte da verdade é o schema; aqui usamos literais
 * para manter este pacote sem dependência do client gerado.
 */

export const SEED_EMAIL_PURPOSES = [
  "PURCHASE_CONFIRM",
  "ACCESS",
  "WELCOME",
  "NPS",
  "UPSELL",
  "REACTIVATION",
  "PASSWORD",
  "LIVE_REMINDER",
] as const;

export type SeedEmailPurpose = (typeof SEED_EMAIL_PURPOSES)[number];

export interface SeedEmailTemplate {
  name: string;
  purpose: SeedEmailPurpose;
  structure: EmailStructure;
  bodyText: string;
}

export const SEED_EMAIL_TEMPLATES: readonly SeedEmailTemplate[] = [
  {
    name: "Compra confirmada",
    purpose: "PURCHASE_CONFIRM",
    structure: {
      headerTitle: "Compra confirmada, {nome}!",
      buttons: [{ label: "Ver detalhes da compra", url: "{link_acesso}" }],
      footerText: "Você está recebendo este e-mail porque comprou {produto}.",
    },
    bodyText:
      "Sua compra de **{produto}** no valor de **{valor}** foi aprovada em {data}.\n\n" +
      "Próximo passo: seu acesso chega em um e-mail separado nos próximos minutos. " +
      "Fique de olho na caixa de entrada (e no spam, por garantia).\n\n" +
      "Qualquer dúvida, responda este e-mail — tem gente de verdade do outro lado.",
  },
  {
    name: "Acesso liberado",
    purpose: "ACCESS",
    structure: {
      headerTitle: "Seu acesso chegou",
      buttons: [{ label: "Acessar {produto}", url: "{link_acesso}" }],
      footerText: "Guarde este e-mail: o seu link de acesso é este.",
    },
    bodyText:
      "{nome}, seu acesso a **{produto}** está liberado.\n\n" +
      "Clique no botão, defina sua senha e faça a primeira aula ainda hoje — " +
      "quem começa nas primeiras 24 horas vai muito mais longe.",
  },
  {
    name: "Boas-vindas",
    purpose: "WELCOME",
    structure: {
      headerTitle: "Bem-vindo(a), {nome}",
      buttons: [{ label: "Começar agora", url: "{link_acesso}" }],
      footerText: "Você recebe estes e-mails porque é aluno(a) de {produto}.",
    },
    bodyText:
      "Agora você faz parte de **{produto}**.\n\n" +
      "Comece pelo módulo 1: são 15 minutos que mudam a forma como você vê o resto. " +
      "Nada de pular etapas — o caminho curto é a ordem certa.\n\n" +
      "Travou em algo? Responda este e-mail e a gente destrava junto.",
  },
  {
    name: "Pesquisa NPS",
    purpose: "NPS",
    structure: {
      headerTitle: "Uma pergunta, 10 segundos",
      buttons: [{ label: "Responder em 1 clique", url: "{link_acesso}" }],
      footerText: "Sua opinião define o que melhoramos primeiro em {produto}.",
    },
    bodyText:
      "{nome}, de 0 a 10, o quanto você recomendaria **{produto}** para um amigo?\n\n" +
      "Um clique e pronto. Sua resposta decide o que a gente melhora primeiro.",
  },
  {
    name: "Oferta para clientes",
    purpose: "UPSELL",
    structure: {
      headerTitle: "Um convite só para quem já está dentro",
      buttons: [{ label: "Ver condição exclusiva", url: "{link_acesso}" }],
      footerText: "Condição exclusiva para clientes de {produto}.",
    },
    bodyText:
      "{nome}, você já deu o primeiro passo com **{produto}**.\n\n" +
      "Para acelerar o resultado, liberamos uma condição exclusiva para alunos: " +
      "**{valor}**, válida até {data}. Depois disso, volta ao preço cheio.\n\n" +
      "Sem pegadinha: é o mesmo caminho, com menos atrito.",
  },
  {
    name: "Reativação",
    purpose: "REACTIVATION",
    structure: {
      headerTitle: "A gente notou sua ausência",
      buttons: [{ label: "Retomar de onde parei", url: "{link_acesso}" }],
      footerText: "Seu acesso a {produto} permanece ativo.",
    },
    bodyText:
      "{nome}, faz um tempo que você não entra em **{produto}** — e seu acesso continua ativo.\n\n" +
      "Separamos um atalho para você retomar de onde parou: 15 minutos hoje já colocam " +
      "você de volta no ritmo. Amanhã custa mais caro que agora.",
  },
  {
    name: "Redefinição de senha",
    purpose: "PASSWORD",
    structure: {
      headerTitle: "Redefinir senha",
      buttons: [{ label: "Criar nova senha", url: "{link_acesso}" }],
      footerText: "Por segurança, nunca compartilhe este link com ninguém.",
    },
    bodyText:
      "{nome}, recebemos um pedido para redefinir a senha da sua conta em {data}.\n\n" +
      "O link abaixo expira em 30 minutos. Se não foi você, ignore este e-mail — " +
      "nada muda na sua conta.",
  },
  {
    name: "Lembrete de live",
    purpose: "LIVE_REMINDER",
    structure: {
      headerTitle: "É hoje: {produto} ao vivo",
      buttons: [{ label: "Entrar na live", url: "{link_acesso}" }],
      footerText: "Você pediu para ser avisado(a) sobre esta live.",
    },
    bodyText:
      "{nome}, nossa live acontece {data}.\n\n" +
      "Entre uns minutos antes: a abertura tem um conteúdo que não fica gravado. " +
      "Deixe o link salvo e o lembrete ligado.",
  },
];
