import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { buildUpstreamUrl, rewriteKeyless } from "@/features/map/lib/proxy-rewrite";

// وسيط MapTiler الخادمي (القاعدة 6): يحقن المفتاح خادمياً ولا يكشفه للعميل أبداً.
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const key = process.env.MAPTILER_KEY;
  if (!key) return NextResponse.json({ error: "MAPTILER_KEY مفقود" }, { status: 500 });

  const { path } = await ctx.params;
  const upstreamUrl = buildUpstreamUrl(path, new URL(req.url).searchParams, key);

  const res = await fetch(upstreamUrl);
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
