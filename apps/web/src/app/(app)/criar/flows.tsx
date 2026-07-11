/**
 * Definição dos 6 fluxos do Criar com IA (cards do hub + títulos das rotas).
 * Microcopy exata do protótipo.
 */

export type FlowSlug =
  | "anuncio"
  | "secao-landing"
  | "landing-completa"
  | "whatsapp"
  | "campanha"
  | "email";

export interface FlowDef {
  slug: FlowSlug;
  title: string;
  /** Título do h2 dentro do fluxo (difere do card só na landing completa). */
  flowTitle: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const FLOW_DEFS: FlowDef[] = [
  {
    slug: "anuncio",
    title: "Copy de anúncio",
    flowTitle: "Copy de anúncio",
    description: "Grande ideia + ângulos por framework.",
    color: "#A855F7",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <path d="M4 11v2a1 1 0 0 0 1 1h2l4 4V6L7 10H5a1 1 0 0 0-1 1Z" />
        <path d="M15 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10" />
      </svg>
    ),
  },
  {
    slug: "secao-landing",
    title: "Seção de landing",
    flowTitle: "Seção de landing",
    description: "Headline, oferta, prova social, FAQ…",
    color: "#38BDF8",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16M10 10v10" />
      </svg>
    ),
  },
  {
    slug: "landing-completa",
    title: "Landing completa",
    flowTitle: "Landing page completa",
    description: "A partir de um template (obrigatório).",
    color: "#34D399",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 9h16M9 9v11M4 15h5" />
      </svg>
    ),
  },
  {
    slug: "whatsapp",
    title: "Mensagem de WhatsApp",
    flowTitle: "Mensagem de WhatsApp",
    description: "No tom do SDR, por estágio.",
    color: "#25D366",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <path d="M12 4a8 8 0 0 0-6.9 12l-1 4 4.1-1A8 8 0 1 0 12 4Z" />
        <path d="M9 10h6M9 13h4" />
      </svg>
    ),
  },
  {
    slug: "campanha",
    title: "Campanha completa",
    flowTitle: "Campanha completa",
    description: "Ângulos + landing + cadência.",
    color: "#FBBF24",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <path d="m4 12 15-7-4 14-4.5-4.5L4 12Z" />
        <path d="M10.5 14.5 15 5" />
      </svg>
    ),
  },
  {
    slug: "email",
    title: "E-mail de pós-venda",
    flowTitle: "E-mail de pós-venda",
    description: "Confirmação, NPS, upsell…",
    color: "#F472B6",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
        <rect x="4" y="6" width="16" height="12" rx="2" />
        <path d="m4 8 8 5 8-5" />
      </svg>
    ),
  },
];

export function flowBySlug(slug: string): FlowDef | null {
  return FLOW_DEFS.find((flow) => flow.slug === slug) ?? null;
}
