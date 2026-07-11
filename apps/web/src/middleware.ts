import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

/**
 * Proteção de rotas (edge-safe — sem Prisma):
 * - públicas: login, signup, landings (/p/*), link rastreado (/a/*), webhooks, assets
 * - autenticadas: todo o app
 * - Setup Gate: usuários logados com setup incompleto só acessam /setup (cookie leve
 *   `vf-setup-done`, gravado/revogado pelo server a cada mutação do setup)
 */

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/p/",
  "/a/",
  "/api/auth",
  "/api/webhooks",
  "/api/usage",
  "/api/optout",
  "/api/health",
  "/_next",
  "/favicon",
  "/logo",
  "/images",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (!request.auth?.user?.id) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const setupDone = request.cookies.get("vf-setup-done")?.value === "1";
  if (!setupDone && !pathname.startsWith("/setup") && !pathname.startsWith("/api/setup")) {
    return NextResponse.redirect(new URL("/setup", request.nextUrl.origin));
  }
  if (setupDone && pathname.startsWith("/setup")) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|woff2)$).*)"],
};
