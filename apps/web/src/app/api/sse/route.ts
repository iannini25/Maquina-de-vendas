import { sseChannel } from "@sales4u/core";

import { createSubscriber } from "@/lib/redis";
import { getWorkspaceContext } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Stream SSE do workspace: inbox + pipeline + notificações.
 * A UI abre um único EventSource; eventos chegam com `event: <kind>`.
 */
export async function GET(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return new Response("não autenticado", { status: 401 });
  }

  const encoder = new TextEncoder();
  const subscriber = createSubscriber();
  const channels = (["inbox", "pipeline", "notify"] as const).map((kind) =>
    sseChannel(ctx.workspaceId, kind),
  );

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          // stream já fechada
        }
      };

      await subscriber.subscribe(...channels);
      subscriber.on("message", (channel, message) => {
        const kind = channel.split(":").pop() ?? "notify";
        send(kind, message);
      });

      send("connected", JSON.stringify({ ok: true }));

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        subscriber.quit().catch(() => subscriber.disconnect());
        try {
          controller.close();
        } catch {
          // já fechada
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
