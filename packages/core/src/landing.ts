/**
 * Roteamento de variantes de landing page: seleção por dispositivo + bucket A/B
 * ponderado, e escolha de vencedora por conversão.
 */

export type DeviceTarget = "ANY" | "MOBILE" | "TABLET" | "DESKTOP";

export interface VariantRef {
  id: string;
  deviceTarget: DeviceTarget;
  weight: number;
}

export function detectDevice(userAgent: string): Exclude<DeviceTarget, "ANY"> {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "TABLET";
  if (/mobi|iphone|ipod|android/.test(ua)) return "MOBILE";
  return "DESKTOP";
}

/**
 * Escolhe a variante: filtra por device (específicas têm prioridade sobre ANY),
 * depois sorteia por peso usando um hash estável do visitorId (sticky bucket).
 */
export function pickVariant(
  variants: VariantRef[],
  device: Exclude<DeviceTarget, "ANY">,
  visitorId: string,
): VariantRef | null {
  if (variants.length === 0) return null;

  const specific = variants.filter((v) => v.deviceTarget === device);
  const pool = specific.length > 0 ? specific : variants.filter((v) => v.deviceTarget === "ANY");
  const candidates = pool.length > 0 ? pool : variants;

  const totalWeight = candidates.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (totalWeight <= 0) return candidates[0] ?? null;

  const bucket = stableHash(visitorId) % totalWeight;
  let cumulative = 0;
  for (const variant of candidates) {
    cumulative += Math.max(0, variant.weight);
    if (bucket < cumulative) return variant;
  }
  return candidates[candidates.length - 1] ?? null;
}

function stableHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash) >>> 0;
}

export interface VariantStats {
  id: string;
  views: number;
  conversions: number;
}

/**
 * Vencedora por taxa de conversão com amostra mínima.
 * Retorna null se nenhuma variante tem amostra suficiente ou se há empate técnico.
 */
export function pickWinner(stats: VariantStats[], minViews = 100): string | null {
  const eligible = stats.filter((s) => s.views >= minViews);
  if (eligible.length < 2) return null;

  const rated = eligible
    .map((s) => ({ id: s.id, rate: s.conversions / s.views }))
    .sort((a, b) => b.rate - a.rate);

  const [first, second] = rated;
  if (!first || !second) return null;
  // Exige vantagem relativa mínima de 10% para declarar vencedora.
  if (second.rate === 0) return first.rate > 0 ? first.id : null;
  if (first.rate / second.rate < 1.1) return null;
  return first.id;
}
