import type { WorkspaceContext } from "@/lib/session";

import type {
  ActiveConversationDto,
  ConversationItemDto,
  InboxData,
  MessageDto,
} from "./types";

/**
 * Leituras do Inbox — sempre via ctx.db (tenantDb), nunca prisma cru.
 */

/** Extrai o texto de Message.content ({ text }) com fallback seguro. */
export function textOfContent(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "[mensagem]";
}

export async function getInboxData(
  ctx: WorkspaceContext,
  params: { c?: string; lead?: string },
): Promise<InboxData> {
  const [rawConversations, stages, leads, product] = await Promise.all([
    ctx.db.conversation.findMany({
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: {
        lead: { select: { id: true, name: true, aiStatus: true, stage: { select: { name: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
      },
    }),
    ctx.db.pipelineStage.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    ctx.db.lead.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, name: true, stage: { select: { name: true } } },
    }),
    ctx.db.productOffer.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true },
    }),
  ]);

  const conversations: ConversationItemDto[] = rawConversations.map((conversation) => ({
    id: conversation.id,
    leadId: conversation.lead.id,
    leadName: conversation.lead.name,
    stageName: conversation.lead.stage.name,
    aiStatus: conversation.lead.aiStatus,
    state: conversation.state,
    channel: conversation.channel,
    unreadCount: conversation.unreadCount,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    preview: conversation.messages[0] ? textOfContent(conversation.messages[0].content) : "Sem mensagens ainda",
  }));

  // Resolve a conversa ativa: ?c=<conversationId> > ?lead=<leadId> > primeira.
  let activeId: string | undefined;
  let pendingLeadId: string | null = null;
  if (params.c && conversations.some((c) => c.id === params.c)) {
    activeId = params.c;
  } else if (params.lead) {
    const byLead = conversations.find((c) => c.leadId === params.lead);
    if (byLead) {
      activeId = byLead.id;
    } else if (leads.some((lead) => lead.id === params.lead)) {
      pendingLeadId = params.lead;
    }
  }
  if (!activeId) activeId = conversations[0]?.id;

  let active: ActiveConversationDto | null = null;
  if (activeId) {
    const conversation = await ctx.db.conversation.findFirst({
      where: { id: activeId },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            score: true,
            valueCents: true,
            nextActionText: true,
            aiStatus: true,
            stage: { select: { id: true, name: true } },
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (conversation) {
      const messages: MessageDto[] = conversation.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        authorType: message.authorType,
        text: textOfContent(message.content),
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      }));
      active = {
        id: conversation.id,
        leadId: conversation.lead.id,
        leadName: conversation.lead.name,
        channel: conversation.channel,
        state: conversation.state,
        aiStatus: conversation.lead.aiStatus,
        stageId: conversation.lead.stage.id,
        stageName: conversation.lead.stage.name,
        valueCents: conversation.lead.valueCents,
        score: conversation.lead.score,
        nextActionText: conversation.lead.nextActionText,
        messages,
      };
    }
  }

  return {
    productName: product?.name ?? null,
    conversations,
    active,
    stages,
    leadOptions: leads.map((lead) => ({ id: lead.id, name: lead.name, stageName: lead.stage.name })),
    pendingLeadId,
  };
}
