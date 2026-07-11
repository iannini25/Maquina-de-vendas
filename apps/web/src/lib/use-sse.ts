"use client";

import { useEffect, useRef } from "react";

/**
 * Assina o stream SSE do workspace (/api/sse).
 * kinds: inbox | pipeline | notify. O handler recebe o payload já parseado.
 */
export function useSse(
  kinds: Array<"inbox" | "pipeline" | "notify">,
  onEvent: (kind: string, payload: Record<string, unknown>) => void,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const kindsKey = kinds.join(",");

  useEffect(() => {
    const source = new EventSource("/api/sse");
    const listeners = kindsKey.split(",").map((kind) => {
      const listener = (event: MessageEvent) => {
        try {
          handlerRef.current(kind, JSON.parse(event.data as string));
        } catch {
          // payload inválido — ignora
        }
      };
      source.addEventListener(kind, listener);
      return { kind, listener };
    });

    return () => {
      for (const { kind, listener } of listeners) {
        source.removeEventListener(kind, listener);
      }
      source.close();
    };
  }, [kindsKey]);
}
