import Image from "next/image";

import { Sales4ULogo } from "@/app/setup/_components/logo";

/**
 * Split-screen 50/50 do protótipo: formulário à esquerda, painel de marketing
 * com glow roxo à direita (login e signup).
 *
 * Assinatura visual: a seta da marca como monumento em sangria + o fio de
 * energia que sobe pela divisa — "a máquina está ligada". Entrada orquestrada
 * com stagger CSS-only (.auth-rise + --auth-delay). No mobile o painel vira
 * uma faixa compacta acima do formulário.
 */

const STATS = [
  { value: "24/7", label: "IA cuidando" },
  { value: "+38%", label: "conversão" },
  { value: "100%", label: "seu ambiente" },
] as const;

function delay(ms: number) {
  return { "--auth-delay": `${ms}ms` } as React.CSSProperties;
}

function MachineBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-3/30 bg-brand-soft px-3.5 py-1.5 text-[12px] font-medium text-accent">
      <span aria-hidden className="auth-pulse size-1.5 rounded-full bg-brand-2" />
      Sua máquina de vendas com IA
    </span>
  );
}

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col lg:flex-row">
      {/* Mobile — faixa compacta do painel de marketing */}
      <div className="relative overflow-hidden border-b border-hairline-soft lg:hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(320px 140px at 50% -20%, rgba(139,92,246,.24), transparent 75%)",
          }}
        />
        <div className="relative flex justify-center px-6 py-3">
          <MachineBadge />
        </div>
      </div>

      {/* Coluna esquerda — formulário */}
      <div className="relative flex w-full flex-1 flex-col justify-center px-6 py-10 lg:w-1/2 lg:flex-none lg:py-12">
        <div
          aria-hidden
          className="absolute inset-0 hidden lg:block"
          style={{
            background:
              "radial-gradient(480px 320px at 14% -4%, rgba(124,58,237,.08), transparent 70%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-[400px]">
          <div className="auth-rise">
            <Sales4ULogo />
          </div>
          <h1
            className="auth-rise mt-8 font-display text-[28px] font-semibold tracking-tight text-ink"
            style={delay(70)}
          >
            {title}
          </h1>
          <p className="auth-rise mt-1.5 text-[13.5px] text-ink-2" style={delay(110)}>
            {subtitle}
          </p>
          <div className="auth-rise mt-8" style={delay(170)}>
            {children}
          </div>
          {footer && (
            <p className="auth-rise mt-6 text-center text-sm text-ink-3" style={delay(240)}>
              {footer}
            </p>
          )}
        </div>
      </div>

      {/* Coluna direita — painel de marketing */}
      <aside className="relative hidden overflow-hidden border-l border-hairline-soft lg:flex lg:w-1/2">
        {/* Halos radiais em camadas */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(560px 420px at 72% 14%, rgba(139,92,246,.32), transparent 70%)," +
              "radial-gradient(380px 300px at 92% 42%, rgba(168,85,247,.12), transparent 70%)," +
              "radial-gradient(680px 540px at 22% 94%, rgba(124,58,237,.18), transparent 70%)," +
              "linear-gradient(160deg, #0E0A18, #08080B 65%)",
          }}
        />
        {/* Grain sutil */}
        <div aria-hidden className="auth-grain absolute inset-0 opacity-[.05]" />
        {/* Monumento — a seta da marca em sangria, mascarada */}
        <div aria-hidden className="auth-float absolute -right-14 top-[10%] w-[520px] select-none">
          <Image
            src="/logo.png"
            alt=""
            width={520}
            height={520}
            className="h-auto w-full opacity-[.16]"
            style={{
              maskImage: "radial-gradient(closest-side, black 55%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(closest-side, black 55%, transparent 100%)",
              filter: "drop-shadow(0 0 60px rgba(139,92,246,.4))",
            }}
          />
        </div>
        {/* Fio de energia subindo pela divisa */}
        <div aria-hidden className="absolute inset-y-0 left-0 w-px overflow-hidden">
          <span
            className="auth-beam absolute left-0 top-0 h-[36%] w-full"
            style={{
              background:
                "linear-gradient(to top, transparent, rgba(179,136,255,.85) 50%, transparent)",
            }}
          />
        </div>

        <div className="relative flex w-full flex-col px-14 py-12 xl:px-20">
          <div className="auth-rise" style={delay(150)}>
            <MachineBadge />
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <h2
              className="auth-rise max-w-[520px] font-display text-[clamp(36px,3.1vw,46px)] font-semibold leading-[1.1] tracking-tight text-ink"
              style={delay(220)}
            >
              Transforme atenção em{" "}
              <span
                className="text-accent"
                style={{ textShadow: "0 0 24px rgba(139,92,246,.55)" }}
              >
                venda
              </span>
              , no automático.
            </h2>
            <p
              className="auth-rise mt-5 max-w-[440px] text-[15px] leading-relaxed text-ink-2"
              style={delay(290)}
            >
              Um SDR de IA cuida dos seus leads 24/7 — do primeiro oi ao fechamento. O pipeline é o
              seu painel de controle.
            </p>
          </div>

          <div className="auth-rise" style={delay(360)}>
            <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.08)] border-t border-hairline pt-6">
              {STATS.map((stat, index) => (
                <div key={stat.value} className={index === 0 ? "pr-6" : "px-6"}>
                  <p className="font-display tnum text-[22px] font-semibold text-ink">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">{stat.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[11.5px] text-ink-3">© 2026 Sales4U · CRM self-host com IA</p>
          </div>
        </div>
      </aside>

      {/* Chip flutuante encostado na divisa (lado do formulário) */}
      <div className="pointer-events-none absolute bottom-16 left-1/2 hidden -translate-x-[85%] lg:block">
        <span
          className="auth-rise inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1 px-4 py-2 text-[12.5px] font-medium text-ink shadow-[0_0_0_1px_rgba(139,92,246,.12),0_12px_32px_-12px_rgba(0,0,0,.8)]"
          style={delay(460)}
        >
          <span aria-hidden className="auth-pulse size-1.5 rounded-full bg-accent" />
          Ambiente pronto. Bora vender.
        </span>
      </div>
    </div>
  );
}
