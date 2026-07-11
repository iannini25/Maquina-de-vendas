import { NotImplementedYetError } from "../errors.js";
import { IMPORT_JOBS, importJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "import" (CSV de leads/prospects em lote). */
export function createImportProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    const payload = importJobSchema.parse(job.data);
    deps.log.debug(
      { queue: "import", job: job.name, entity: payload.entity, storageKey: payload.storageKey },
      "payload válido",
    );

    switch (job.name) {
      case IMPORT_JOBS.csv:
        // TODO: baixar o CSV do S3 (payload.storageKey), validar linhas,
        // deduplicar por telefone/e-mail e criar Leads (stage inicial) ou
        // Prospects (payload.prospectListId) em lote, reportando erros por linha.
        throw new NotImplementedYetError("import", job.name);
      default:
        throw new NotImplementedYetError("import", job.name);
    }
  };
}
