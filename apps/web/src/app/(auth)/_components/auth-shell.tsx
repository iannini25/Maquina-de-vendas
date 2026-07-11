import { VendaFlowLogo } from "@/app/setup/_components/logo";

/**
 * Split-screen 50/50 do protótipo: formulário à esquerda, painel de marketing
 * com glow roxo à direita (login e signup).
 */
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
    <div className="flex min-h-dvh">
      {/* Coluna esquerda — formulário */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2">
        <div className="rise-in mx-auto w-full max-w-[400px]">
          <VendaFlowLogo />
          <h1 className="mt-8 font-display text-[28px] font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-6 text-center text-sm text-ink-3">{footer}</p>}
        </div>
      </div>

      {/* Coluna direita — painel de marketing */}
      <aside className="relative hidden overflow-hidden border-l border-hairline-soft lg:flex lg:w-1/2">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(560px 420px at 72% 16%, rgba(139,92,246,.30), transparent 70%)," +
              "radial-gradient(680px 540px at 24% 88%, rgba(124,58,237,.16), transparent 70%)," +
              "linear-gradient(160deg, #0E0A18, #08080B 65%)",
          }}
        />
        <div className="relative flex w-full flex-col px-14 py-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-3/30 bg-brand-soft px-3.5 py-1.5 text-[12px] font-medium text-accent">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-2" />
            Sua máquina de vendas com IA
          </span>

          <div className="flex flex-1 flex-col justify-center">
            <h2 className="max-w-[480px] font-display text-[40px] font-semibold leading-[1.12] tracking-tight text-ink">
              Transforme atenção em <span className="text-accent">venda</span>, no automático.
            </h2>
            <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-ink-2">
              Um SDR de IA cuida dos seus leads 24/7 — do primeiro oi ao fechamento. O pipeline é o
              seu painel de controle.
            </p>
          </div>

          <div>
            <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.08)] border-t border-hairline pt-6">
              {[
                { value: "24/7", label: "IA cuidando" },
                { value: "+38%", label: "conversão" },
                { value: "100%", label: "seu ambiente" },
              ].map((stat, index) => (
                <div key={stat.value} className={index === 0 ? "pr-6" : "px-6"}>
                  <p className="font-display tnum text-[22px] font-semibold text-ink">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">{stat.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[11.5px] text-ink-3">
              © 2026 VendaFlow · CRM self-host com IA
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
