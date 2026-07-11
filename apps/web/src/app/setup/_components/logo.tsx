import { cn } from "@/components/ui/cn";

/** Logo VendaFlow (tile gradiente + wordmark) usada no Setup Gate e no login. */
export function VendaFlowLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-[10px] text-sm font-bold text-white"
        style={{
          background: "linear-gradient(135deg,#7C3AED,#A855F7)",
          boxShadow: "0 0 0 1px rgba(139,92,246,.25), 0 8px 28px -8px rgba(139,92,246,.6)",
        }}
      >
        V
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
        Venda<span className="text-accent">Flow</span>
      </span>
    </span>
  );
}
