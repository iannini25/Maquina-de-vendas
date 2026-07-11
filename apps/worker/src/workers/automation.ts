import { NotImplementedYetError } from "../errors.js";
import { AUTOMATION_JOBS, automationJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "automation" (cadências e follow-ups). */
export function createAutomationProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    const payload = automationJobSchema.parse(job.data);
    deps.log.debug({ queue: "automation", job: job.name, runId: payload.runId }, "payload válido");

    switch (job.name) {
      case AUTOMATION_JOBS.runStep:
        // TODO: carregar AutomationRun (flow + lead + cursor), executar o passo
        // atual (mensagem, espera, condição), avançar o cursor e agendar o
        // próximo job com delay = nextRunAt.
        throw new NotImplementedYetError("automation", job.name);
      default:
        throw new NotImplementedYetError("automation", job.name);
    }
  };
}
