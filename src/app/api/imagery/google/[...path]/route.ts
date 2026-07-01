import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { buildGoogleSessionUrl, buildGoogleTileUrl } from "@/features/map/lib/imagery-proxy";

// وسيط Google Map Tiles API الرسمي (القاعدة 6: المفتاح خادمي، لا يصل العميل).
// createSession خادمي مخزَّن — مع إعادة محاولة لتجاوز تذبذب انتشار إعدادات Google، والتمسّك بأوّل جلسة
// ناجحة (صالحة ~أسبوعين) وعدم إبطالها عند هفوة عابرة. ثمّ بلاط z/x/y.
// م9.11 · **تخبئة أداء يوم واحد** (`public, max-age=86400`): بلاطة الصورة تُخبَّأ في المتصفّح يوماً ⇒ إعادة زيارة
// المنطقة (تنقّل/طيران/جولة) لا تُعيد طلب Google ⇒ **توفير كلفة كبير + سلاسة فوريّة** + يجعل التحميل المسبق مجدياً.
// (تخبئة مؤقّتة للأداء — جائزة في شروط Google Maps Platform؛ الصورة ثابتة فلا حاجة لتحديث متكرّر.)
// ⚠ للإنتاج: يُنصح بإظهار شعار Google + إسناد «Google, Maxar Technologies» في الواجهة.

let cachedSession: { token: string; expiresAtMs: number } | null = null;
let inflight: Promise<string> | null = null;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function fetchSession(key: string): Promise<{ token: string; expiresAtMs: number }> {
  let lastStatus = 0;
  let lastDetail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(250 * attempt); // backoff لطيف (تذبذب انتشار Google)
    let res: Response;
    try {
      res = await fetch(buildGoogleSessionUrl(key), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapType: "satellite", language: "ar", region: "IQ" }),
        signal: AbortSignal.timeout(8_000), // فشل أسرع (لا تعليق طويل عند تذبذب Google)
      });
    } catch {
      continue; // ومضة شبكة — أعد المحاولة
    }
    if (res.ok) {
      const j = (await res.json()) as { session: string; expiry: string };
      return { token: j.session, expiresAtMs: Number(j.expiry) * 1000 };
    }
    lastStatus = res.status;
    lastDetail = (await res.text().catch(() => "")).slice(0, 300); // جسم خطأ Google لا يحوي المفتاح
  }
  console.error("[google createSession] فشل بعد المحاولات", lastStatus, lastDetail);
  throw new Error(`createSession ${lastStatus}`);
}

async function getSession(key: string, forceNew = false): Promise<string> {
  if (!forceNew && cachedSession && cachedSession.expiresAtMs - Date.now() > 60_000) return cachedSession.token;
  if (!inflight) {
    inflight = fetchSession(key)
      .then((s) => {
        cachedSession = s; // لا نُبطل القديمة إلا عند نجاح جلسة جديدة (تمسّك بأوّل جلسة صالحة)
        return s.token;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return NextResponse.json({ error: "GOOGLE_MAPS_KEY مفقود" }, { status: 500 });

  const { path } = await ctx.params;
  if (path.length < 3) return new NextResponse("bad tile path", { status: 400 });
  const z = path[0]!;
  const x = path[1]!;
  const y = path[2]!;

  const fetchTile = (session: string): Promise<Response> =>
    fetch(buildGoogleTileUrl(z, x, y, session, key), { signal: AbortSignal.timeout(15_000) });

  let res: Response;
  try {
    res = await fetchTile(await getSession(key));
    if (res.status === 401 || res.status === 403) {
      res = await fetchTile(await getSession(key, true)); // الجلسة مرفوضة — جدّدها (مع إعادة المحاولة)
    }
  } catch {
    return new NextResponse("upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new NextResponse(`upstream ${res.status}`, { status: res.status });

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "public, max-age=86400" }, // م9.11 · تخبئة يوم (توفير + سلاسة)
  });
}
