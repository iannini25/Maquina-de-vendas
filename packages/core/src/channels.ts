/**
 * Contratos compartilhados entre web e worker:
 * nomes de filas BullMQ e canais Redis pub/sub (SSE).
 */

export const QUEUES = {
  /** Executa passos de AutomationRun (cadências, follow-ups). */
  automation: "automation",
  /** Resposta do agente de IA a uma mensagem recebida. */
  agentReply: "agent-reply",
  /** Ingestão RAG: extração de texto, chunking, embeddings. */
  contextIngest: "context-ingest",
  /** Envio de e-mails transacionais. */
  email: "email",
  /** Envio de mensagens de saída (WhatsApp etc.) com rate-limit. */
  outbound: "outbound",
  /** Jobs de pós-venda e monitor de uso (classificação diária). */
  postSale: "post-sale",
  /** Lembretes de campanha Lançamento/Live. */
  campaign: "campaign",
  /** Analista de funil (job diário) e agregações. */
  analyst: "analyst",
  /** Importações em lote (CSV de leads/prospects). */
  import: "import",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export function sseChannel(workspaceId: string, kind: "inbox" | "pipeline" | "notify"): string {
  return `ws:${workspaceId}:${kind}`;
}

/** Extrai o workspaceId de um nome de canal SSE. */
export function parseSseChannel(channel: string): { workspaceId: string; kind: string } | null {
  const match = channel.match(/^ws:([^:]+):(inbox|pipeline|notify)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { workspaceId: match[1], kind: match[2] };
}
