import type { CredentialProvider } from "@sales4u/db";

/**
 * Registro dos provedores de credencial: campos, obrigatoriedade e microcopy.
 * A UI do Setup Gate e das Configurações renderiza a partir daqui.
 */

export interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  secret: boolean;
  optional?: boolean;
}

export interface ProviderSpec {
  provider: CredentialProvider;
  title: string;
  description: string;
  required: boolean;
  /** Aviso exibido quando opcional/fallback. */
  note?: string;
  fields: CredentialField[];
  docsUrl?: string;
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    provider: "ANTHROPIC",
    title: "Anthropic (Claude)",
    description: "Motor do SDR de IA: conversa, qualificação e geração de conteúdo.",
    required: true,
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "sk-ant-…", secret: true },
    ],
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    provider: "VOYAGE",
    title: "Voyage AI (embeddings)",
    description: "Busca semântica no contexto (RAG).",
    required: false,
    note: "Opcional — sem a chave, a busca usa texto completo (menos precisa, funciona no dia 1).",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "pa-…", secret: true }],
    docsUrl: "https://dash.voyageai.com",
  },
  {
    provider: "EVOLUTION",
    title: "WhatsApp (Evolution API)",
    description: "Conexão do número que o SDR usa para conversar.",
    required: true,
    fields: [
      { key: "url", label: "URL da Evolution", placeholder: "http://evolution:8080", secret: false, optional: true },
      { key: "apiKey", label: "API Key global", secret: true, optional: true },
      { key: "instanceName", label: "Nome da instância", placeholder: "principal", secret: false, optional: true },
    ],
    docsUrl: "https://doc.evolution-api.com",
  },
  {
    provider: "RESEND",
    title: "Resend (e-mail)",
    description: "E-mails transacionais: acesso, confirmação, NPS, reativação.",
    required: true,
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "re_…", secret: true },
      { key: "domain", label: "Domínio de envio", placeholder: "mail.seudominio.com", secret: false },
    ],
    docsUrl: "https://resend.com/domains",
  },
  {
    provider: "S3",
    title: "Arquivos (S3/MinIO)",
    description: "Armazenamento de mídia, uploads e páginas.",
    required: true,
    note: "Configurado pelo ambiente do servidor — verificação testa leitura e escrita reais.",
    fields: [],
  },
  {
    provider: "META_PIXEL",
    title: "Pixel da Meta",
    description: "Rastreio de conversão nas landing pages.",
    required: false,
    fields: [{ key: "pixelId", label: "Pixel ID", secret: false }],
  },
  {
    provider: "GOOGLE_TAG",
    title: "Google Tag",
    description: "Google Ads/Analytics nas landing pages.",
    required: false,
    fields: [{ key: "tagId", label: "Tag ID (G-… ou AW-…)", secret: false }],
  },
  {
    provider: "HOTMART",
    title: "Hotmart",
    description: "Vendas do checkout entram automaticamente no ROI.",
    required: false,
    fields: [{ key: "webhookToken", label: "Hottok (token do webhook)", secret: true }],
  },
  {
    provider: "KIWIFY",
    title: "Kiwify",
    description: "Vendas do checkout entram automaticamente no ROI.",
    required: false,
    fields: [{ key: "webhookToken", label: "Token do webhook", secret: true }],
  },
  {
    provider: "EDUZZ",
    title: "Eduzz",
    description: "Vendas do checkout entram automaticamente no ROI.",
    required: false,
    fields: [{ key: "webhookToken", label: "Chave de assinatura", secret: true }],
  },
  {
    provider: "STRIPE",
    title: "Stripe",
    description: "Vendas do checkout entram automaticamente no ROI.",
    required: false,
    fields: [
      { key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_…", secret: true },
    ],
  },
  {
    provider: "EXPLORIUM",
    title: "Explorium (Vibe Prospecting)",
    description: "Busca de prospects por perfil, direto na Prospecção.",
    required: false,
    fields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
  {
    provider: "HIGGSFIELD",
    title: "Higgsfield (criativos)",
    description: "Geração de imagens e vídeos para anúncios.",
    required: false,
    fields: [{ key: "apiKey", label: "API Key", secret: true }],
  },
];

export const REQUIRED_PROVIDERS = PROVIDER_SPECS.filter((p) => p.required).map(
  (p) => p.provider,
);

export function providerSpec(provider: CredentialProvider): ProviderSpec {
  const spec = PROVIDER_SPECS.find((p) => p.provider === provider);
  if (!spec) throw new Error(`Provedor desconhecido: ${provider}`);
  return spec;
}
