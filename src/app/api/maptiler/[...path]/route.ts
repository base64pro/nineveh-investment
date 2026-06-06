import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { MAPTILER_UPSTREAM, rewriteKeyless } from "@/features/map/lib/proxy-rewrite";

// وسيط MapTiler الخادمي (القاعدة 6): يحقن المفتاح خادمياً ولا يكشفه للعميل أبداً.
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const key = process.env.MAPTILER_KEY;
  if (!key) return NextResponse.json({ error: "MAPTILER_KEY مفقود" }, { status: 500 });

  const { path } = await ctx.params;
  const search = new URL(req.url).searchParams;
  search.set("key", key);
  const upstreamUrl = `${MAPTILER_UPSTREAM}/${path.map(encodeURIComponent).join("/")}?${search.toString()}`;

  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok) return new NextResponse(`upstream ${upstream.status}`, { status: upstream.status });

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const isJson = contentType.includes("json");
  // JSON (style/tilejson/sprite-index) لا يُخزَّن (يتغيّر بالتحويل)؛ الثنائي يُخزَّن طويلاً.
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": isJson ? "no-store" : "public, max-age=86400",
  });

  if (isJson) {
    return new NextResponse(rewriteKeyless(await upstream.text()), { status: 200, headers });
  }
  return new NextResponse(await upstream.arrayBuffer(), { status: 200, headers });
}
