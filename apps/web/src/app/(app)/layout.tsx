import { prisma } from "@vendaflow/db";

import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireWorkspace } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const [workspace, user] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
  ]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar workspaceName={workspace?.name ?? "Workspace"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={user?.name ?? "Você"} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
