import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { AIRBUS_TOKEN_URL, buildAirbusTileUrl } from "@/features/map/lib/imagery-proxy";

// وسيط Airbus OneAtlas (Pléiades/Neo · بثّ WMTS) — المفتاح خادمي (القاعدة 6).
// تدفّق: api key → bearer token (مخزَّن في الذاكرة) ثمّ بلاط WMTS من قالب التجربة AIRBUS_WMTS_TEMPLATE.
// AIRBUS_WMTS_TEMPLATE = عنوان بلاطة المنتَج من حسابك التجريبي مع العناصر {z}/{x}/{y}.

let cachedToken: { token: string; expiresAtMs: number } | null = null;
let inflight: Promise<string> | null = null;

async function mintToken(apiKey: string): Promise<string> {
  const res = await fetch(AIRBUS_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ apikey: apiKey, grant_type: "api_key", client_id: "IDP" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`airbus token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: j.access_token, expiresAtMs: Date.now() + (j.expires_in - 30) * 1000 };
  return j.access_token;
}

async function getToken(apiKey: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) return cachedToken.token;
  if (!inflight) {
    inflight = mintToken(apiKey).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const apiKey = process.env.AIRBUS_API_KEY;
  const template = process.env.AIRBUS_WMTS_TEMPLATE;
  if (!apiKey || !template) {
    return NextResponse.json({ error: "AIRBUS_API_KEY/AIRBUS_WMTS_TEMPLATE مفقود" }, { status: 500 });
  }

  const { path } = await ctx.params;
  if (path.length < 3) return new NextResponse("bad tile path", { status: 400 });
  const url = buildAirbusTileUrl(template, path[0]!, path[1]!, path[2]!);

  const fetchTile = (token: string): Promise<Response> =>
    fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });

  let res: Response;
  try {
    res = await fetchTile(await getToken(apiKey));
    if (res.status === 401 || res.status === 403) {
      cachedToken = null; // التوكن منتهٍ — جدّده مرّة واحدة
      res = await fetchTile(await getToken(apiKey));
    }
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new NextResponse(`upstream ${res.status}`, { status: res.status });

  const contentType = res.headers.get("content-type") ?? "image/png";
  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "private, max-age=3600" },
  });
}
