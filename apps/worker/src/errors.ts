/**
 * Erros de domínio do worker.
 */

/** Job reconhecido mas ainda não implementado — falha explícita, nunca sucesso silencioso. */
export class NotImplementedYetError extends Error {
  constructor(queue: string, jobName: string) {
    super(`Handler ainda não implementado: fila "${queue}", job "${jobName}"`);
    this.name = "NotImplementedYetError";
  }
}
