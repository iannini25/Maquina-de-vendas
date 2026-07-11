import { NotImplementedYetError } from "../errors.js";
import { CONTEXT_INGEST_JOBS, contextIngestJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/** Esqueleto do handler da fila "context-ingest" (RAG: extração + embeddings). */
export function createContextIngestProcessor(deps: { log: Log }): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    const payload = contextIngestJobSchema.parse(job.data);
    deps.log.debug(
      { queue: "context-ingest", job: job.name, contextFileId: payload.contextFileId },
      "payload válido",
    );

    switch (job.name) {
      case CONTEXT_INGEST_JOBS.ingestFile:
        // TODO: baixar o arquivo do S3 (storageKey) ou usar rawText, extrair
        // texto, fazer chunking, gerar embeddings (credencial VOYAGE do
        // workspace) e gravar ContextChunks; atualizar ContextFile.status.
        throw new NotImplementedYetError("context-ingest", job.name);
      default:
        throw new NotImplementedYetError("context-ingest", job.name);
    }
  };
}
