import { createServer, type Server } from "node:http";

/**
 * Health check do worker: GET /health responde { ok, queues } (200)
 * ou { ok: false, error } (503) se redis/postgres não responderem.
 */

export interface HealthDeps {
  queueNames: readonly string[];
  pingRedis(): Promise<void>;
  pingDb(): Promise<void>;
}

export interface HealthResult {
  status: number;
  body: { ok: boolean; queues?: readonly string[]; error?: string };
}

/** Lógica pura do health check — testável sem servidor HTTP. */
export async function checkHealth(deps: HealthDeps): Promise<HealthResult> {
  try {
    await Promise.all([deps.pingRedis(), deps.pingDb()]);
    return { status: 200, body: { ok: true, queues: deps.queueNames } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 503, body: { ok: false, error: message } };
  }
}

/** Sobe o servidor HTTP mínimo (node:http) com a rota GET /health. */
export function startHealthServer(deps: HealthDeps, port: number): Server {
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === "GET" && req.url === "/health") {
        const result = await checkHealth(deps);
        res.writeHead(result.status, { "content-type": "application/json" });
        res.end(JSON.stringify(result.body));
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "rota não encontrada" }));
    })();
  });
  server.listen(port);
  return server;
}
