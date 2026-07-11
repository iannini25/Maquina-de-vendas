import { cn } from "./cn";

/** Avatar de iniciais com gradiente estável por hash do nome (padrão dos cards de lead). */

const GRADIENTS = [
  "linear-gradient(135deg,#7C3AED,#A855F7)",
  "linear-gradient(135deg,#38BDF8,#8B5CF6)",
  "linear-gradient(135deg,#FB7185,#A855F7)",
  "linear-gradient(135deg,#FBBF24,#FB7185)",
  "linear-gradient(135deg,#34D399,#38BDF8)",
  "linear-gradient(135deg,#A855F7,#FB7185)",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const gradient = GRADIENTS[hashName(name) % GRADIENTS.length];
  const sizeClass =
    size === "sm" ? "size-7 text-[10px]" : size === "lg" ? "size-11 text-sm" : "size-9 text-xs";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizeClass,
        className,
      )}
      style={{ background: gradient }}
    >
      {initialsOf(name)}
    </span>
  );
}
