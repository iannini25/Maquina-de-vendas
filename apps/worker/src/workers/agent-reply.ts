import { NotImplementedYetError } from "../errors.js";
import { AGENT_REPLY_JOBS, agentReplyJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "agent-reply" (SDR de IA responde no WhatsApp). */
export function createAgentReplyProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    const payload = agentReplyJobSchema.parse(job.data);
    deps.log.debug(
      { queue: "agent-reply", job: job.name, conversationId: payload.conversationId },
      "payload válido",
    );

    switch (job.name) {
      case AGENT_REPLY_JOBS.reply:
        // TODO: montar contexto (persona + modo ativo + RAG + histórico da
        // conversa), chamar o modelo, persistir Message OUT como QUEUED e
        // enfileirar na fila "outbound". Respeitar activeHours e aiStatus.
        throw new NotImplementedYetError("agent-reply", job.name);
      default:
        throw new NotImplementedYetError("agent-reply", job.name);
    }
  };
}
