import { prisma } from "@sales4u/db";
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const HEARTBEAT_SECONDS = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Heartbeat de uso do produto: a plataforma do curso embeda o snippet que
 * faz POST /api/usage/{token} a cada minuto enquanto o aluno está ativo.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limit = await rateLimit(`usage:${token}`, 4, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: CORS_HEADERS });
  }

  const grant = await prisma.accessGrant.findUnique({ where: { trackedToken: token } });
  if (!grant) {
    return NextResponse.json({ error: "token inválido" }, { status: 404, headers: CORS_HEADERS });
  }

  const now = new Date();
  await Promise.all([
    prisma.accessGrant.update({
      where: { id: grant.id },
      data: {
        firstAccessAt: grant.firstAccessAt ?? now,
        lastActivityAt: now,
        totalActiveSeconds: { increment: HEARTBEAT_SECONDS },
        status: "ACTIVE",
      },
    }),
    prisma.usageEvent.create({
      data: { accessGrantId: grant.id, type: "HEARTBEAT", meta: {} },
    }),
  ]);

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
