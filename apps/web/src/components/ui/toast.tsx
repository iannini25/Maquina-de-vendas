"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * Toast global em pílula centralizada na base (padrão do protótipo):
 * ponto roxo à esquerda + mensagem; some sozinho após 4s.
 */

interface ToastItem {
  id: number;
  message: string;
  tone: "brand" | "success" | "danger";
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastItem["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastItem["tone"] = "brand") => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const dotColor =
    (tone: ToastItem["tone"]) =>
      tone === "success" ? "bg-success" : tone === "danger" ? "bg-danger" : "bg-brand-2";

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60]">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-brand-3/30 bg-surface-2/95 px-4.5 py-2.5 text-[13px] text-ink shadow-[0_0_0_1px_rgba(139,92,246,.15),0_12px_40px_-12px_rgba(0,0,0,.8)] backdrop-blur animate-[toast-in_320ms_var(--ease-out)_both]"
            style={{ bottom: index * 48 }}
          >
            <span aria-hidden className={`size-2 rounded-full ${dotColor(item.tone)}`} />
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
