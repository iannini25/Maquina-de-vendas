import { NotImplementedYetError } from "../errors.js";
import { CAMPAIGN_JOBS, campaignReminderJobSchema, campaignTickJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "campaign" (lembretes de Lançamento/Live). */
export function createCampaignProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case CAMPAIGN_JOBS.schedulerTick: {
        campaignTickJobSchema.parse(job.data);
        deps.log.debug({ queue: "campaign", job: job.name }, "payload válido");
        // TODO: buscar campanhas LAUNCH_LIVE ativas com remindersEnabled e
        // liveAt próximo; enfileirar jobs send-reminder para cada lembrete
        // devido (d-1, h-1, live-now) ainda não disparado.
        throw new NotImplementedYetError("campaign", job.name);
      }
      case CAMPAIGN_JOBS.sendReminder: {
        const payload = campaignReminderJobSchema.parse(job.data);
        deps.log.debug(
          { queue: "campaign", job: job.name, campaignId: payload.campaignId },
          "payload válido",
        );
        // TODO: montar a mensagem do lembrete (template + campanha) e
        // enfileirar envios na fila "outbound" para os leads inscritos.
        throw new NotImplementedYetError("campaign", job.name);
      }
      default:
        throw new NotImplementedYetError("campaign", job.name);
    }
  };
}
