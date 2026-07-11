import { NotImplementedYetError } from "../errors.js";
import { ANALYST_JOBS, analystJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "analyst" (analista de funil diário). */
export function createAnalystProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    const payload = analystJobSchema.parse(job.data);
    deps.log.debug(
      { queue: "analyst", job: job.name, workspaceId: payload.workspaceId, date: payload.date },
      "payload válido",
    );

    switch (job.name) {
      case ANALYST_JOBS.dailyReport:
        // TODO: agregar métricas do dia (leads, conversas, deals, ROI) por
        // workspace, gerar o diagnóstico do analista de funil e publicar
        // notificação SSE "notify" + e-mail de resumo.
        throw new NotImplementedYetError("analyst", job.name);
      default:
        throw new NotImplementedYetError("analyst", job.name);
    }
  };
}
