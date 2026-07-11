/**
 * Eventos de domínio do funil. Tudo relevante vira evento — persiste em EventLog,
 * publica em SSE e agenda jobs no worker.
 */

export type DomainEvent =
  | { type: "lead.created"; leadId: string; source: string; stageKey: string }
  | {
      type: "lead.stage_changed";
      leadId: string;
      fromStageId: string;
      toStageId: string;
      movedBy: "HUMAN" | "AI" | "AUTOMATION";
      reason?: string;
    }
  | { type: "lead.opted_out"; leadId: string; channel: string }
  | { type: "lead.score_changed"; leadId: string; score: number; temperature: string }
  | { type: "message.received"; leadId: string; conversationId: string; messageId: string }
  | { type: "message.sent"; leadId: string; conversationId: string; messageId: string; authorType: string }
  | { type: "conversation.human_takeover"; leadId: string; conversationId: string; userId: string }
  | { type: "conversation.handback"; leadId: string; conversationId: string; userId: string }
  | { type: "cadence.exhausted"; leadId: string; stageId: string }
  | { type: "deal.won"; leadId: string; dealId: string; valueCents: number }
  | { type: "deal.lost"; leadId: string; dealId: string; reason?: string }
  | { type: "order.paid"; orderId: string; leadId?: string; valueCents: number; source: string }
  | { type: "order.refunded"; orderId: string; provider?: string }
  | { type: "access.granted"; accessGrantId: string; leadId: string; orderId: string }
  | { type: "access.first_open"; accessGrantId: string; leadId: string }
  | { type: "access.idle"; accessGrantId: string; leadId: string; idleDays: number }
  | { type: "access.active"; accessGrantId: string; leadId: string }
  | { type: "approval.requested"; approvalId: string; kind: string; leadId?: string }
  | { type: "approval.decided"; approvalId: string; status: "APPROVED" | "REJECTED" }
  | { type: "upsell.window_open"; leadId: string; productOfferId: string };

export type DomainEventType = DomainEvent["type"];

/** Efeito computado por uma transição — o chamador executa (job, SSE, EventLog). */
export type TransitionEffect =
  | { kind: "cancel_automation_runs"; leadId: string }
  | { kind: "start_stage_automation"; leadId: string; stageId: string }
  | { kind: "emit_event"; event: DomainEvent }
  | { kind: "publish_sse"; channel: "inbox" | "pipeline"; payload: Record<string, unknown> }
  | { kind: "create_order_from_deal"; leadId: string; dealId?: string }
  | { kind: "grant_access"; leadId: string; orderId?: string }
  | { kind: "schedule_post_sale"; leadId: string }
  | { kind: "pause_automation_runs"; leadId: string; reason: string }
  | { kind: "resume_automation_runs"; leadId: string }
  | { kind: "toast"; text: string };
