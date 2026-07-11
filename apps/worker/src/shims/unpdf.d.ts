/**
 * Shim mínimo de tipos do "unpdf" (extração de texto de PDF).
 * Cobre apenas a superfície usada pelo worker (extractText com mergePages);
 * o pacote é carregado por import() dinâmico apenas no wiring real.
 */
declare module "unpdf" {
  export function extractText(
    data: Uint8Array | ArrayBuffer,
    options?: { mergePages?: boolean },
  ): Promise<{ totalPages: number; text: string | string[] }>;
}
