import { prisma } from "@sales4u/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Link rastreado de acesso ao produto: /a/{token}.
 * Registra LINK_OPENED (primeiro acesso vira status ACCESSED) e redireciona
 * para a URL real da área de membros.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const grant = await prisma.accessGrant.findUnique({
    where: { trackedToken: token },
  });
  if (!grant) {
    return new NextResponse("Link de acesso inválido ou expirado.", { status: 404 });
  }

  const now = new Date();
  await Promise.all([
    prisma.accessGrant.update({
      where: { id: grant.id },
      data: {
        firstAccessAt: grant.firstAccessAt ?? now,
        lastActivityAt: now,
        status: grant.status === "NEVER" ? "ACCESSED" : grant.status,
      },
    }),
    prisma.usageEvent.create({
      data: {
        accessGrantId: grant.id,
        type: "LINK_OPENED",
        meta: { userAgent: request.headers.get("user-agent") ?? "" },
      },
    }),
    grant.firstAccessAt
      ? Promise.resolve()
      : prisma.eventLog.create({
          data: {
            workspaceId: grant.workspaceId,
            actorType: "SYSTEM",
            type: "access.first_open",
            entity: "Lead",
            entityId: grant.leadId,
            data: { accessGrantId: grant.id },
          },
        }),
  ]);

  if (!grant.url) {
    return new NextResponse(
      "Acesso registrado, mas o produto ainda não tem link de área de membros cadastrado.",
      { status: 200 },
    );
  }

  return NextResponse.redirect(grant.url, 302);
}
