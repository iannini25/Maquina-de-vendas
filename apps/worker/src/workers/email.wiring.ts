import { prisma, decryptCredentialData } from "@sales4u/db";
import { createEmailSender } from "@sales4u/emails";
import type { EmailSenderPort } from "./email.js";

/**
 * Wiring real do handler de e-mail: resolve o remetente por workspace.
 * Ordem: credencial RESEND do workspace → fallback SMTP local em dev.
 */

/** SMTP local do compose de dev (Mailpit/MailHog). */
const DEV_SMTP_HOST = "localhost";
const DEV_SMTP_PORT = 1025;

/** Cria o resolvedor de remetente usado por createEmailProcessor. */
export function createWorkspaceEmailSenderResolver(
  nodeEnv: string,
): (workspaceId: string) => Promise<EmailSenderPort> {
  return async (workspaceId: string): Promise<EmailSenderPort> => {
    const credential = await prisma.credential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "RESEND" } },
    });

    if (credential) {
      const data = decryptCredentialData(credential.dataEncrypted);
      const resendApiKey = data.apiKey;
      if (!resendApiKey) {
        throw new Error(`Credencial RESEND do workspace ${workspaceId} não possui apiKey`);
      }
      return createEmailSender({ resendApiKey });
    }

    if (nodeEnv !== "production") {
      return createEmailSender({ smtpHost: DEV_SMTP_HOST, smtpPort: DEV_SMTP_PORT });
    }

    throw new Error(`Workspace ${workspaceId} sem credencial RESEND — e-mail não enviado`);
  };
}
