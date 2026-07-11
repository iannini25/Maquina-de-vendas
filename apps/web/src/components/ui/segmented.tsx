"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "./cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Segmented control com indicador deslizante (token de movimento do protótipo:
 * 200ms ease-out, anima só transform/width).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const activeIndex = options.findIndex((option) => option.value === value);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelectorAll<HTMLButtonElement>("button")[activeIndex];
    if (active) {
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    }
  }, [activeIndex, options.length]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative inline-flex rounded-full border border-hairline bg-surface-2 p-1",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full border border-brand-3/50 bg-[linear-gradient(135deg,rgba(124,58,237,.45),rgba(168,85,247,.45))] shadow-[0_0_12px_-2px_rgba(139,92,246,.5)] transition-all duration-200 ease-[var(--ease-out)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          type="button"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 rounded-full font-medium transition-colors duration-[130ms]",
            size === "sm" ? "px-3 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]",
            option.value === value ? "text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
