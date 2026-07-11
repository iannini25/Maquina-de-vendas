import { prisma } from "@vendaflow/db";
import { NextResponse } from "next/server";

import { logEvent } from "@/lib/events";
import { verifyOptoutToken } from "@/server/email-templates/optout";

export const dynamic = "force-dynamic";

/**
 * Descadastro público de e-mails: GET /api/optout?token={assinado}.
 * Token HMAC (AUTH_SECRET) com o leadId → marca optedOut, cancela automações
 * em andamento e registra lead.opted_out. Página simples de confirmação.
 */

function page(title: string, message: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#08080B;color:#F4F4F7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:420px;padding:40px 24px;text-align:center;">
<div style="width:44px;height:44px;margin:0 auto 20px;border-radius:9999px;background:linear-gradient(135deg,#7C3AED,#A855F7);display:flex;align-items:center;justify-content:center;font-size:20px;">✓</div>
<h1 style="margin:0 0 10px;font-size:20px;font-weight:700;">${title}</h1>
<p style="margin:0;font-size:14px;line-height:1.6;color:#9CA3AF;">${message}</p>
</main>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token") ?? "";

  if (token === "test") {
    return page(
      "Link de teste",
      "Este é o link de descadastro de um e-mail de teste — nenhum contato foi descadastrado.",
      200,
    );
  }

  let leadId: string | null = null;
  try {
    leadId = verifyOptoutToken(token);
  } catch {
    leadId = null;
  }
  if (!leadId) {
    return page("Link inválido", "Este link de descadastro é inválido ou expirou.", 400);
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, workspaceId: true, optedOut: true },
  });
  if (!lead) {
    return page("Link inválido", "Este link de descadastro é inválido ou expirou.", 400);
  }

  if (!lead.optedOut) {
    await prisma.lead.update({ where: { id: lead.id }, data: { optedOut: true } });
    await prisma.automationRun.updateMany({
      where: { leadId: lead.id, state: { in: ["RUNNING", "PAUSED"] } },
      data: { state: "CANCELLED", pausedReason: "Lead descadastrado (opt-out de e-mail)" },
    });
    try {
      await logEvent({
        workspaceId: lead.workspaceId,
        actorType: "SYSTEM",
        type: "lead.opted_out",
        entity: "Lead",
        entityId: lead.id,
        data: { via: "email_optout" },
        notify: ["notify"],
      });
    } catch {
      // Evento é trilha secundária — o descadastro em si já foi persistido.
    }
  }

  return page(
    "Você não vai mais receber nossos e-mails.",
    "Seu descadastro foi registrado com sucesso. Se mudar de ideia, é só falar com a gente.",
    200,
  );
}
