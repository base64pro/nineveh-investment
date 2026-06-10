// محرّك مواقع الخريطة (geocoding) — **خادمي فقط** (القاعدة 6: المفتاح لا يصل العميل).
// §هـ.2.ج: مواقع حقيقية **ضمن حدود نينوى حصراً** — لا تأليف.

// صندوق نينوى التقريبي [minLng, minLat, maxLng, maxLat] (تحيّز أوّلي للنتائج).
const NINEVEH_BBOX: [number, number, number, number] = [41.2, 35.0, 44.4, 37.4];

// نوع تسمية الخريطة ← تسمية عربية واضحة (حي · منطقة · معلم …).
const TYPE_LABEL: Record<string, string> = {
  neighbourhood: "حي",
  suburb: "حي",
  quarter: "محلة",
  locality: "منطقة",
  place: "منطقة",
  hamlet: "قرية",
  village: "قرية",
  town: "بلدة",
  city: "مدينة",
  municipality: "بلدة",
  municipal_district: "ناحية",
  county: "قضاء",
  subregion: "قضاء",
  poi: "معلم",
  address: "عنوان",
  street: "شارع",
};

export interface GeoPlace {
  label: string;
  sublabel: string;
  lng: number;
  lat: number;
  kind: string;
}

interface RawCtx {
  text_ar?: string;
  text?: string;
}
interface RawFeature {
  center?: unknown;
  place_name_ar?: string;
  place_name?: string;
  text_ar?: string;
  text?: string;
  place_type?: string[];
  context?: RawCtx[];
}

// توحيد الياءات/الألفات لمطابقة اسم نينوى رغم اختلاف الإملاء (نینوى/نينوى).
function normAr(s: string): string {
  return s.replace(/[ىیي]/g, "ي").replace(/[أإآ]/g, "ا");
}

export async function geocodeNineveh(query: string): Promise<GeoPlace[]> {
  const key = process.env.MAPTILER_KEY;
  const q = query.trim();
  if (!key || q.length < 2) return [];

  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "ar");
  url.searchParams.set("country", "iq");
  url.searchParams.set("bbox", NINEVEH_BBOX.join(","));
  url.searchParams.set("limit", "8");

  let data: unknown;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const feats = (data as { features?: unknown[] })?.features;
  if (!Array.isArray(feats)) return [];

  const out: GeoPlace[] = [];
  for (const f of feats) {
    const ft = f as RawFeature;
    const c = ft.center;
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < NINEVEH_BBOX[0] || lng > NINEVEH_BBOX[2] || lat < NINEVEH_BBOX[1] || lat > NINEVEH_BBOX[3]) continue;

    // فلتر صارم: لا نقبل إلا ما محافظته نينوى (يستبعد دهوك/كركوك/أربيل الواقعة ضمن المستطيل).
    const placeName = ft.place_name_ar || ft.place_name || "";
    const ctxText = Array.isArray(ft.context) ? ft.context.map((x) => x.text_ar || x.text || "").join(" ") : "";
    if (!normAr(`${placeName} ${ctxText}`).includes("نينو")) continue;

    const parts = placeName.split(",").map((s) => s.trim()).filter((s) => s && s !== "العراق");
    const typeLabel = TYPE_LABEL[ft.place_type?.[0] ?? ""] ?? "موقع";
    out.push({
      label: ft.text_ar || ft.text || parts[0] || q,
      sublabel: [typeLabel, ...parts.slice(-2)].filter(Boolean).join(" · "),
      lng,
      lat,
      kind: ft.place_type?.[0] ?? "place",
    });
  }
  return out;
}
