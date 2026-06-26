import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { IMAGERY_PROVIDERS, buildImageryUrl, resolveUpstream } from "@/features/map/lib/imagery-proxy";

/** نداء أعلى بمهلة + محاولة ثانية واحدة — ومضات الشبكة لا تتحوّل 500 (§ز.5: تدهور لطيف، MapLibre يعيد المحاولة). */
async function fetchUpstream(url: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    return fetch(url, { signal: AbortSignal.timeout(15_000) });
  }
}

// وسيط الصور الجوية البديلة (القاعدة 6): يحقن مفتاح المزوّد خادمياً ولا يكشفه للعميل أبداً.
// البلاط ثنائي (صور) فقط — لا JSON ولا إعادة كتابة؛ التسميات السيادية تأتي من طبقاتنا فوق هذا الـraster.
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string; path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const { provider, path } = await ctx.params;
  const cfg = IMAGERY_PROVIDERS[provider];
  if (!cfg) return new NextResponse("unknown provider", { status: 404 });

  const resolved = resolveUpstream(cfg, process.env[cfg.envKey], process.env.NODE_ENV === "production");
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 500 });

  const upstreamUrl = buildImageryUrl(resolved.base, path, new URL(req.url).searchParams, cfg.param, resolved.token);

  let res: Response;
  try {
    res = await fetchUpstream(upstreamUrl);
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new NextResponse(`upstream ${res.status}`, { status: res.status });

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "public, max-age=86400" },
  });
}
