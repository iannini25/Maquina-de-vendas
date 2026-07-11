import type { NextAuthConfig } from "next-auth";

/**
 * Config edge-safe (sem Prisma/bcrypt) — usada pelo middleware.
 * O provider Credentials (com acesso a banco) entra apenas em auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.workspaceId = (user as { workspaceId?: string }).workspaceId;
        token.workspaceSlug = (user as { workspaceSlug?: string }).workspaceSlug;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.workspaceId = (token.workspaceId as string) ?? "";
      session.user.workspaceSlug = (token.workspaceSlug as string) ?? "";
      session.user.role = (token.role as string) ?? "SELLER";
      return session;
    },
  },
} satisfies NextAuthConfig;
