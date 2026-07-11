import { NotImplementedYetError } from "../errors.js";
import { EMAIL_JOBS, emailJobSchema } from "../payloads.js";
import type { JobLike, JobProcessor, Log } from "../types.js";

/**
 * Handler da fila "email" — lógica pura, testável com fakes.
 * O wiring real (Resend por credencial do workspace / SMTP dev) está em
 * email.wiring.ts.
 */

/** Contrato mínimo do remetente — satisfeito por createEmailSender de @vendaflow/emails. */
export interface EmailSenderPort {
  send(input: { to: string; subject: string; html: string; from?: string }): Promise<unknown>;
}

export interface EmailDeps {
  /** Resolve o remetente configurado para o workspace. */
  getSender(workspaceId: string): Promise<EmailSenderPort>;
  log: Log;
}

/** Cria o processor da fila "email". */
export function createEmailProcessor(deps: EmailDeps): JobProcessor {
  return async (job: JobLike): Promise<void> => {
    switch (job.name) {
      case EMAIL_JOBS.send:
        return sendEmail(deps, job.data);
      default:
        throw new NotImplementedYetError("email", job.name);
    }
  };
}

async function sendEmail(deps: EmailDeps, data: unknown): Promise<void> {
  const payload = emailJobSchema.parse(data);
  const sender = await deps.getSender(payload.workspaceId);
  await sender.send({ to: payload.to, subject: payload.subject, html: payload.html });
  deps.log.info(
    { workspaceId: payload.workspaceId, to: payload.to, subject: payload.subject },
    "e-mail enviado",
  );
}
