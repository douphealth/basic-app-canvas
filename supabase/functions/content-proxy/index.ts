import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/0\./,
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return !BLOCKED_PATTERNS.some((p) => p.test(url));
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let targetUrl: string | null = null;
  let forwardHeaders: Record<string, string> = {};
  let accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

  if (req.method === "POST") {
    try {
      const body = await req.json();
      targetUrl = body.url;
      if (body.headers && typeof body.headers === "object") {
        forwardHeaders = body.headers;
      }
      if (body.accept) {
        accept = body.accept;
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    const params = new URL(req.url).searchParams;
    targetUrl = params.get("url") ? decodeURIComponent(params.get("url")!) : null;
  }

  if (!targetUrl || !isAllowedUrl(targetUrl)) {
    return new Response(JSON.stringify({ error: "Invalid or disallowed URL" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; AmzWP-Automator/2.0; +https://amzwp.app)",
      Accept: accept,
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      ...forwardHeaders,
    };

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: fetchHeaders,
      redirect: "follow",
    });

    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") ?? "text/plain";
    const text = await response.text();

    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "X-Proxied-Status": String(response.status),
        "X-Proxied-Url": response.url,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return new Response(JSON.stringify({ error: isTimeout ? "Timeout" : message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
