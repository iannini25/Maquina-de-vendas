/**
 * Contrato mínimo de fetch para injeção nos testes.
 * Não depende de @types/node nem da lib DOM — os testes injetam um mock
 * e em produção o fetch global do Node 22 é usado.
 */

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface FetchRequestInit {
  method: string;
  headers: Record<string, string>;
  body: string;
}

export type FetchLike = (url: string, init: FetchRequestInit) => Promise<FetchResponseLike>;

/** Retorna o fetch global (Node >= 18) ou uma função que rejeita com erro claro. */
export function defaultFetch(): FetchLike {
  const holder = globalThis as { fetch?: FetchLike };
  const globalFetch = holder.fetch;
  if (!globalFetch) {
    return () =>
      Promise.reject(new Error("fetch global indisponível — injete um FetchLike no cliente"));
  }
  return (url, init) => globalFetch(url, init);
}

/** JSON.parse tolerante: retorna undefined em vez de lançar. */
export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
