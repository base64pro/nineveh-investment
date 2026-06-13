import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { buildUpstreamUrl, rewriteKeyless } from "@/features/map/lib/proxy-rewrite";

/** نداء أعلى بمهلة + محاولة ثانية واحدة — ومضات الشبكة لا تتحوّل 500 (§ز.5: تدهور لطيف، MapLibre يعيد المحاولة). */
async function fetchUpstream(url: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    return fetch(url, { signal: AbortSignal.timeout(15_000) });
  }
}

// وسيط MapTiler الخادمي (القاعدة 6): يحقن المفتاح خادمياً ولا يكشفه للعميل أبداً.
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const key = process.env.MAPTILER_KEY;
  if (!key) return NextResponse.json({ error: "MAPTILER_KEY مفقود" }, { status: 500 });

  const { path } = await ctx.params;
  const upstreamUrl = buildUpstreamUrl(path, new URL(req.url).searchParams, key);

  let res: Response;
  try {
    res = await fetchUpstream(upstreamUrl);
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new NextResponse(`upstream ${res.status}`, { status: res.status });

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const isJson = contentType.includes("json");
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": isJson ? "no-store" : "public, max-age=86400",
  });

  if (isJson) {
    return new NextResponse(rewriteKeyless(await res.text()), { status: 200, headers });
  }
  return new NextResponse(await res.arrayBuffer(), { status: 200, headers });
}
