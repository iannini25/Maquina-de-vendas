"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "./cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  badge?: string | number;
}

/** Abas com underline deslizante (padrão das telas com abas do protótipo). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  const activeIndex = tabs.findIndex((tab) => tab.value === value);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelectorAll<HTMLButtonElement>("button")[activeIndex];
    if (active) {
      setUnderline({ left: active.offsetLeft, width: active.offsetWidth });
    }
  }, [activeIndex, tabs.length]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn("relative flex gap-1 border-b border-hairline-soft", className)}
    >
      <span
        aria-hidden
        className="absolute -bottom-px h-0.5 rounded-full bg-[linear-gradient(90deg,#7C3AED,#A855F7)] transition-all duration-200 ease-[var(--ease-out)]"
        style={{ left: underline.left, width: underline.width }}
      />
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors duration-[130ms]",
            tab.value === value ? "text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
