import { prisma } from "@vendaflow/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "web", db: "up" });
  } catch {
    return NextResponse.json({ ok: false, service: "web", db: "down" }, { status: 503 });
  }
}
