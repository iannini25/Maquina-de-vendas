"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sidebar do app — estrutura de navegação do protótipo.
 * Ícones: traço fino 1.5px, estilo Iconsax (inline SVG para zero dependência).
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  ),
  pipeline: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M4 5h16M6.5 12h11M9.5 19h5" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.7c2 .3 3.6 1.6 4.3 3.8" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M21 12h-5l-2 3h-4l-2-3H3" />
      <path d="M5.5 5h13L21 12v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-7Z" />
    </svg>
  ),
  campaigns: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M18 8a3 3 0 1 0 0 8" />
      <path d="M18 8v8M6 15v4M6 9v2" />
      <path d="M18 8 8 10v4l10 2" />
      <path d="M4 10h4v4H4z" />
    </svg>
  ),
  landing: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7.5 13h6M7.5 16h3" />
    </svg>
  ),
  ads: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="m4 15 4-8 4 8M5.2 12.5h5.6" />
      <circle cx="17" cy="11.5" r="3.5" />
      <path d="M20.5 8v7" />
    </svg>
  ),
  prospect: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
      <path d="M11 8.5v5M8.5 11h5" />
    </svg>
  ),
  context: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14 4v5h5M8.5 13h7M8.5 16.5h5" />
    </svg>
  ),
  sdr: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M12 8V5M9.5 13v1M14.5 13v1M12 3.5h.01" />
      <path d="M5 12H3.5M20.5 12H19" />
    </svg>
  ),
  roi: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M3.5 20.5v-17" />
      <path d="M3.5 20.5h17" />
      <path d="m7 15 4-4 3 3 5.5-6" />
    </svg>
  ),
  emails: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  create: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <path d="M12 4.5 13.8 9l4.7 1.8-4.7 1.8L12 17l-1.8-4.4L5.5 10.8 10.2 9 12 4.5Z" />
      <path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="size-[18px]" {...strokeProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
    </svg>
  ),
};

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: icons.dashboard },
  { href: "/pipeline", label: "Pipeline", icon: icons.pipeline },
  { href: "/leads", label: "Leads", icon: icons.leads },
  { href: "/inbox", label: "Inbox", icon: icons.inbox },
];

const GROWTH_NAV: NavItem[] = [
  { href: "/campanhas", label: "Campanhas", icon: icons.campaigns },
  { href: "/landing-pages", label: "Landing Pages", icon: icons.landing },
  { href: "/anuncios", label: "Anúncios", icon: icons.ads },
  { href: "/prospeccao", label: "Prospecção", icon: icons.prospect },
];

const AI_NAV: NavItem[] = [
  { href: "/contexto", label: "Contexto", icon: icons.context },
  { href: "/sdr", label: "SDR de IA", icon: icons.sdr },
  { href: "/criar", label: "Criar com IA", icon: icons.create },
];

const OPS_NAV: NavItem[] = [
  { href: "/financas", label: "ROI & Finanças", icon: icons.roi },
  { href: "/emails", label: "Templates de E-mail", icon: icons.emails },
  { href: "/configuracoes", label: "Configurações", icon: icons.settings },
];

function NavSection({ title, items, pathname }: { title?: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="mb-1">
      {title && (
        <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors duration-[130ms] ${
                  active
                    ? "bg-brand-soft font-medium text-ink"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span
                  className={`transition-colors duration-[130ms] ${
                    active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-dvh w-[232px] shrink-0 flex-col border-r border-hairline-soft bg-surface-1">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div
          className="flex size-8 items-center justify-center rounded-[10px] text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}
        >
          V
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-tight">VendaFlow</p>
          <p className="truncate text-[11px] text-ink-3">{workspaceName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <NavSection items={MAIN_NAV} pathname={pathname} />
        <NavSection title="Aquisição" items={GROWTH_NAV} pathname={pathname} />
        <NavSection title="Inteligência" items={AI_NAV} pathname={pathname} />
        <NavSection title="Operação" items={OPS_NAV} pathname={pathname} />
      </nav>
    </aside>
  );
}
