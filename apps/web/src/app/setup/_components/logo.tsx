import Image from "next/image";

import { cn } from "@/components/ui/cn";

/** Logo Sales4U (marca real + wordmark) usada no Setup Gate, login e sidebar. */
export function Sales4ULogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt=""
        aria-hidden
        width={32}
        height={32}
        className="size-8 object-contain drop-shadow-[0_4px_14px_rgba(139,92,246,.55)]"
      />
      <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
        Sales<span className="text-accent">4U</span>
      </span>
    </span>
  );
}
