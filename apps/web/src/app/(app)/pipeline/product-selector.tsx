"use client";

import { useState } from "react";

import { cn } from "@/components/ui/cn";
import { Dropdown, DropdownItem } from "@/components/ui/misc";
import type { ProductOptionDto } from "@/server/pipeline/types";

/** Seletor "● {Produto} ˅" da topbar do Pipeline (+ atalho "+ Novo pipeline"). */
export function ProductSelector({
  products,
  value,
  onSelect,
  onNewPipeline,
}: {
  products: ProductOptionDto[];
  value: string | null;
  onSelect: (id: string) => void;
  onNewPipeline: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = products.find((p) => p.id === value) ?? products[0] ?? null;

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex max-w-64 items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3.5 py-1.5",
          "text-[12.5px] font-medium text-ink transition-colors duration-[130ms] hover:border-brand-3/40",
        )}
      >
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-2" />
        <span className="truncate">{current?.name ?? "Sem produto cadastrado"}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-3.5 shrink-0 text-ink-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <Dropdown open={open} onClose={() => setOpen(false)}>
        {products.map((product) => (
          <DropdownItem
            key={product.id}
            onClick={() => {
              onSelect(product.id);
              setOpen(false);
            }}
          >
            <span className="flex-1 truncate">{product.name}</span>
            {product.id === current?.id && (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-3.5 text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            )}
          </DropdownItem>
        ))}
        {products.length === 0 && (
          <p className="px-3 py-2 text-[12px] text-ink-3">Nenhum produto cadastrado ainda.</p>
        )}
        <div className="my-1 border-t border-hairline-soft" />
        <DropdownItem
          onClick={() => {
            setOpen(false);
            onNewPipeline();
          }}
        >
          <span className="text-accent">+ Novo pipeline</span>
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
