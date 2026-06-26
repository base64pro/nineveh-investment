import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { buildAzureTileUrl } from "@/features/map/lib/imagery-proxy";

// وسيط Azure Maps الصوري (microsoft.imagery · مصدر Airbus) — المفتاح خادمي (القاعدة 6).
// ⚠ للإنتاج: يجب عرض الإسناد من Get Map Attribution API (إسناد ثابت مؤقّت في الواجهة).
async function fetchUpstream(url: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    return fetch(url, { signal: AbortSignal.timeout(15_000) });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const key = process.env.AZURE_MAPS_KEY;
  if (!key) return NextResponse.json({ error: "AZURE_MAPS_KEY مفقود" }, { status: 500 });

  const { path } = await ctx.params;
  if (path.length < 3) return new NextResponse("bad tile path", { status: 400 });
  const url = buildAzureTileUrl(path[0]!, path[1]!, path[2]!, key);

  let res: Response;
  try {
    res = await fetchUpstream(url);
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new NextResponse(`upstream ${res.status}`, { status: res.status });

  const contentType = res.headers.get("content-type") ?? "image/png";
  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "public, max-age=86400" },
  });
}
