import { prisma } from "@vendaflow/db";
import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string;
      workspaceSlug: string;
      role: string;
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: {
            memberships: {
              include: { workspace: { select: { id: true, slug: true } } },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        const membership = user.memberships[0];
        if (!membership) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          workspaceId: membership.workspace.id,
          workspaceSlug: membership.workspace.slug,
          role: membership.role,
        };
      },
    }),
  ],
});
