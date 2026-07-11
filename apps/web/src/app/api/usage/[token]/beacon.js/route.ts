import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Snippet de heartbeat copiável: a plataforma do curso inclui
 * <script src="{APP_URL}/api/usage/{token}/beacon.js"></script>
 * e o monitor de uso passa a receber batidas por minuto enquanto a aba está ativa.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = new URL(request.url).origin;

  const script = `(function () {
  var url = ${JSON.stringify(`${origin}/api/usage/${token}`)};
  function beat() {
    if (document.visibilityState !== "visible") return;
    try {
      navigator.sendBeacon ? navigator.sendBeacon(url) : fetch(url, { method: "POST", keepalive: true });
    } catch (e) {}
  }
  beat();
  setInterval(beat, 60000);
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
