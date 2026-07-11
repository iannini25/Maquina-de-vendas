import { getObject } from "@/lib/storage";
import { findPublishedLandingBySlug } from "@/server/landing/public-queries";

/**
 * Serve o HTML enviado pelo usuário (landing kind UPLOADED) direto do MinIO.
 * Conteúdo do próprio dono do workspace — sandbox básico via CSP restritiva.
 */

export const dynamic = "force-dynamic";

const ZIP_NOTICE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Arquivo .zip</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#08080B;color:#A1A1AA;font-family:system-ui"><p style="max-width:32rem;text-align:center;padding:1rem">Este arquivo foi enviado como .zip — a extração automática ainda não está disponível. Reenvie a página como .html único para publicá-la.</p></body></html>`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const landing = await findPublishedLandingBySlug(slug);
  if (!landing || landing.kind !== "UPLOADED" || !landing.storageKey) {
    return new Response("não encontrado", { status: 404 });
  }

  if (landing.storageKey.endsWith(".zip")) {
    return new Response(ZIP_NOTICE, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  try {
    const html = await getObject(landing.storageKey);
    return new Response(new Uint8Array(html), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy":
          "default-src 'self' https: data: 'unsafe-inline'; frame-ancestors 'self'",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("arquivo indisponível no storage", { status: 502 });
  }
}
