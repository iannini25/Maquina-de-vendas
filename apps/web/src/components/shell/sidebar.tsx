"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Dropdown, DropdownItem } from "@/components/ui/misc";

import { logoutAction } from "./actions";

/**
 * Sidebar do protótipo: 4 grupos rotulados em overline + card do usuário no rodapé.
 * Ícones inline em traço 1.5px (estilo Iconsax).
 */

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof icons;
  badge?: number;
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
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  ),
  pipeline: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="M4 5h16M6.5 12h11M9.5 19h5" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.7c2 .3 3.6 1.6 4.3 3.8" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="M21 12h-5l-2 3h-4l-2-3H3" />
      <path d="M5.5 5h13L21 12v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-7Z" />
    </svg>
  ),
  campaigns: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="M18 8a3 3 0 1 0 0 8M18 8v8M6 15v4M6 9v2" />
      <path d="M18 8 8 10v4l10 2M4 10h4v4H4z" />
    </svg>
  ),
  postSale: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="m9.5 11.5 2.5 2.5 5.5-6" />
    </svg>
  ),
  landing: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7.5 13h6M7.5 16h3" />
    </svg>
  ),
  ads: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="m4 15 4-8 4 8M5.2 12.5h5.6" />
      <circle cx="17" cy="11.5" r="3.5" />
      <path d="M20.5 8v7" />
    </svg>
  ),
  prospect: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5M11 8.5v5M8.5 11h5" />
    </svg>
  ),
  emails: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  ),
  context: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14 4v5h5M8.5 13h7M8.5 16.5h5" />
    </svg>
  ),
  sdr: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M12 8V5M9.5 13v1M14.5 13v1M12 3.5h.01M5 12H3.5M20.5 12H19" />
    </svg>
  ),
  roi: (
    <svg viewBox="0 0 24 24" className="size-[17px]" {...strokeProps}>
      <path d="M3.5 20.5v-17M3.5 20.5h17" />
      <path d="m7 15 4-4 3 3 5.5-6" />
    </svg>
  ),
} as const;

const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/leads", label: "Leads", icon: "leads" },
      { href: "/inbox", label: "Inbox", icon: "inbox" },
      { href: "/campanhas", label: "Campanhas", icon: "campaigns" },
      { href: "/pos-venda", label: "Pós-venda", icon: "postSale" },
    ],
  },
  {
    title: "Crescimento",
    items: [
      { href: "/landing-pages", label: "Landing Pages", icon: "landing" },
      { href: "/anuncios", label: "Anúncios", icon: "ads" },
      { href: "/prospeccao", label: "Prospecção", icon: "prospect" },
      { href: "/emails", label: "Templates de E-mail", icon: "emails" },
    ],
  },
  {
    title: "Inteligência",
    items: [
      { href: "/contexto", label: "Contexto", icon: "context" },
      { href: "/sdr", label: "SDR de IA", icon: "sdr" },
    ],
  },
  {
    title: "Resultado",
    items: [{ href: "/financas", label: "ROI & Finanças", icon: "roi" }],
  },
];

export function Sidebar({
  workspaceName,
  userName,
  inboxUnread,
}: {
  workspaceName: string;
  userName: string;
  inboxUnread: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="flex h-dvh w-[248px] shrink-0 flex-col border-r border-hairline-soft bg-surface-1">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <Image
          src="/logo.png"
          alt=""
          aria-hidden
          width={32}
          height={32}
          className="size-8 object-contain drop-shadow-[0_4px_14px_rgba(139,92,246,.55)]"
        />
        <span className="font-display text-[15px] font-semibold tracking-tight">
          Sales<span className="text-accent">4U</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-2">
            <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.href === "/inbox" ? inboxUnread : item.badge;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors duration-[130ms] ${
                        active
                          ? "bg-brand-soft font-medium text-ink"
                          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[linear-gradient(180deg,#7C3AED,#A855F7)]"
                        />
                      )}
                      <span
                        className={`transition-colors duration-[130ms] ${
                          active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"
                        }`}
                      >
                        {icons[item.icon]}
                      </span>
                      {item.label}
                      {badge !== undefined && badge > 0 && (
                        <span className="ml-auto rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-hairline-soft p-3">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-[130ms] hover:bg-surface-2"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-hairline bg-surface-3 text-[11px] font-semibold text-ink">
            {userName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "VF"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{userName}</span>
            <span className="block truncate text-[11px] text-ink-3">
              Workspace · {workspaceName}
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="size-4 text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />
          </svg>
        </button>

        <Dropdown open={menuOpen} onClose={() => setMenuOpen(false)} className="bottom-16 left-3 right-3">
          <DropdownItem
            onClick={() => {
              setMenuOpen(false);
              router.push("/configuracoes");
            }}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
            </svg>
            Credenciais & Integrações
          </DropdownItem>
          <DropdownItem danger onClick={() => logoutAction()}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sair
          </DropdownItem>
        </Dropdown>
      </div>
    </aside>
  );
}
