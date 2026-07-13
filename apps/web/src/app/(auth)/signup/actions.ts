"use server";

import { prisma } from "@sales4u/db";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const signupSchema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  workspaceName: z.string().min(2, "Informe o nome do negócio"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
});

export interface SignupResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function signup(_prev: SignupResult | null, formData: FormData): Promise<SignupResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    workspaceName: formData.get("workspaceName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  // Anti criação de contas em massa: 5 signups por IP a cada 10 minutos.
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";
  const limit = await rateLimit(`signup:ip:${ip}`, 5, 600);
  if (!limit.allowed) {
    return { ok: false, error: "Muitas contas criadas — aguarde alguns minutos." };
  }

  const { name, workspaceName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: false, fieldErrors: { email: "Já existe uma conta com este e-mail" } };
  }

  const baseSlug = slugify(workspaceName) || "workspace";
  let slug = baseSlug;
  for (let i = 2; await prisma.workspace.findUnique({ where: { slug } }); i++) {
    slug = `${baseSlug}-${i}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email: normalizedEmail, passwordHash },
    });
    const workspace = await tx.workspace.create({
      data: { name: workspaceName, slug },
    });
    await tx.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
    });
    await tx.setupState.create({
      data: { workspaceId: workspace.id, checklist: {} },
    });
    await tx.eventLog.create({
      data: {
        workspaceId: workspace.id,
        actorType: "USER",
        actorId: user.id,
        type: "workspace.created",
        entity: "Workspace",
        entityId: workspace.id,
        data: { name: workspaceName },
      },
    });
  });

  await signIn("credentials", {
    email: normalizedEmail,
    password,
    redirectTo: "/setup",
  });

  return { ok: true };
}
