import { prisma } from "@sales4u/db";

import { GlobalOverlays } from "@/components/shell/global-overlays";
import { Sidebar } from "@/components/shell/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { requireWorkspace } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const [workspace, user, inboxUnread] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    prisma.conversation.count({
      where: { workspaceId: ctx.workspaceId, unreadCount: { gt: 0 } },
    }),
  ]);

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          workspaceName={workspace?.name ?? "Workspace"}
          userName={user?.name ?? "Você"}
          inboxUnread={inboxUnread}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
      <GlobalOverlays />
    </ToastProvider>
  );
}
