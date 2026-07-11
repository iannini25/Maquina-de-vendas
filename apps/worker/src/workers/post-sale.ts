import { NotImplementedYetError } from "../errors.js";
import { POST_SALE_JOBS, postSaleJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "post-sale" (monitor de uso e régua pós-venda). */
export function createPostSaleProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    const payload = postSaleJobSchema.parse(job.data);
    deps.log.debug(
      { queue: "post-sale", job: job.name, workspaceId: payload.workspaceId },
      "payload válido",
    );

    switch (job.name) {
      case POST_SALE_JOBS.dailyClassification:
        // TODO: varrer AccessGrants de todos os workspaces (ou só de
        // payload.workspaceId), classificar idle/ativo por lastOpenAt e emitir
        // eventos access.idle / access.active.
        throw new NotImplementedYetError("post-sale", job.name);
      case POST_SALE_JOBS.scheduleForLead:
        // TODO: montar a régua de pós-venda do lead (payload.leadId) após
        // order.paid: onboarding, check-ins e janela de upsell.
        throw new NotImplementedYetError("post-sale", job.name);
      default:
        throw new NotImplementedYetError("post-sale", job.name);
    }
  };
}
