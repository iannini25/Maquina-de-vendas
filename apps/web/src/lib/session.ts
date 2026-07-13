import { tenantDb, type TenantDb } from "@sales4u/db";
import { redirect } from "next/navigation";

import { auth } from "./auth";

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  role: string;
  db: TenantDb;
}

/**
 * Contexto de tenant para Server Components/Actions/Route Handlers.
 * TODA query de negócio usa o `db` retornado aqui (tenantDb) — nunca `prisma` cru.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    redirect("/login");
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    workspaceSlug: session.user.workspaceSlug,
    role: session.user.role,
    db: tenantDb(session.user.workspaceId),
  };
}

/** Variante para Route Handlers: retorna null em vez de redirect. */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) return null;
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    workspaceSlug: session.user.workspaceSlug,
    role: session.user.role,
    db: tenantDb(session.user.workspaceId),
  };
}
