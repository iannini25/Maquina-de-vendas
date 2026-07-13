"use server";

import { prisma } from "@sales4u/db";
import { AuthError } from "next-auth";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface LoginResult {
  ok: boolean;
  error?: string;
}

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  );
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Preencha e-mail e senha" };
  }

  // Anti brute-force: janela por IP + por e-mail alvo.
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip}`, RATE_LIMITS.login.max, RATE_LIMITS.login.windowSeconds),
    rateLimit(
      `login:email:${parsed.data.email.toLowerCase()}`,
      RATE_LIMITS.login.max,
      RATE_LIMITS.login.windowSeconds,
    ),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return {
      ok: false,
      error: "Muitas tentativas — aguarde alguns minutos e tente de novo.",
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    });
    await syncSetupCookie(parsed.data.email.toLowerCase());
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "E-mail ou senha incorretos" };
    }
    throw error;
  }
}

/**
 * Espelha o estado do Setup Gate num cookie leve lido pelo middleware
 * (que roda no edge e não pode consultar o banco).
 */
async function syncSetupCookie(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { workspace: { include: { setupState: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const completed = Boolean(user?.memberships[0]?.workspace.setupState?.completedAt);
  const cookieStore = await cookies();
  cookieStore.set("vf-setup-done", completed ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
