// م9.9 (②) · تحميل مسبق **كامل** لبلاطات منطقة العمل (z8 → z16) عند بدء الجلسة.
// الفكرة: تُحمّى كاش المتصفّح (HTTP) بنفس عناوين البلاطات التي تطلبها MapLibre لاحقاً (الوسيط يعطي max-age=86400)
// ⇒ تنقّل/طيران فوريّ بلا «تحميل لحظيّ» ولا تقطّع. مزوّد-محايد: يقرأ قوالب البلاط من مصادر النمط المُحمَّل فعلاً
// (raster الصورة + vector القاعدة). المنطقة = صندوق القطع (المدينة حيث يجري العمل) لا المحافظة كاملةً (تفادي صحارى فارغة).
// سقف أمان (maxTiles): يُبنى بترتيب الزوم تصاعديّاً، فإذا تجاوز السقف تُسقَط أعلى الزوومات (يصون مناطق واسعة غير متوقّعة).
import type { Map as MlMap } from "maplibre-gl";

export type Bounds = [number, number, number, number]; // [w, s, e, n]

// تحويل إحداثيّات إلى رقم بلاطة (Web Mercator · سلِبّي) — قيَم صحيحة لا مؤلَّفة.
const lng2x = (lng: number, z: number): number => Math.floor(((lng + 180) / 360) * Math.pow(2, z));
const lat2y = (lat: number, z: number): number => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
};

type GeoFeature = { geometry?: unknown };

/** صندوق إحاطة (bbox) لكلّ القطع المُحمَّلة + حشوة — يُمثّل «المدينة» حيث يجري العمل. null إن لا قطع. */
export function featuresBBox(features: readonly GeoFeature[], pad = 0.012): Bounds | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c)) {
      if (typeof c[0] === "number" && typeof c[1] === "number") {
        const lng = c[0];
        const lat = c[1];
        if (lng < w) w = lng;
        if (lng > e) e = lng;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      } else {
        for (const x of c) walk(x);
      }
    }
  };
  for (const f of features) {
    const g = f.geometry as { coordinates?: unknown } | null | undefined;
    if (g?.coordinates) walk(g.coordinates);
  }
  if (!Number.isFinite(w)) return null;
  return [w - pad, s - pad, e + pad, n + pad];
}

export type PrefetchHandle = { cancel: () => void };

type TileSource = { tpl: string; srcMin: number; srcMax: number };

/**
 * يبدأ تحميل بلاطات المنطقة مسبقاً (تجمّع محدود التزامن). يُستدعى بعد جهوز النمط (load) كي تتوفّر مصادر `tiles`.
 * آمن للإلغاء عند الفكّ. onProgress(done,total) لشاشة التقدّم. maxTiles سقف أمان (يُسقط أعلى الزوومات عند التجاوز).
 */
export function prefetchOverview(
  map: MlMap,
  bounds: Bounds,
  opts: {
    zMin?: number;
    zMax?: number;
    wideZMax?: number; // أعلى زوم يُحمَّل للخريطة الكاملة (bounds)؛ الأعمق يُحمَّل حول deepPoints فقط
    deepPoints?: readonly [number, number][]; // مراكز القطع — للتحميل العميق حولها (المحافظة كاملةً عند z16 مستحيلة فيزيائياً)
    deepRadius?: number; // نصف قطر بالبلاطات حول كلّ نقطة عميقة
    concurrency?: number;
    maxTiles?: number;
    throttleMs?: number; // مهلة لطيفة بين الطلبات لكلّ عامل — لا نُغرق وسيط MapTiler (تفادي 429)
    onProgress?: (done: number, total: number) => void;
  } = {},
): PrefetchHandle {
  const zMin = opts.zMin ?? 8;
  const zMax = opts.zMax ?? 16;
  const wideZMax = Math.min(opts.wideZMax ?? zMax, zMax);
  const deepPoints = opts.deepPoints ?? [];
  const deepRadius = opts.deepRadius ?? 1;
  const concurrency = opts.concurrency ?? 3;
  const maxTiles = opts.maxTiles ?? 8000;
  const throttleMs = opts.throttleMs ?? 120;
  const onProgress = opts.onProgress;

  let style: ReturnType<MlMap["getStyle"]>;
  try {
    style = map.getStyle();
  } catch {
    return { cancel: () => {} };
  }
  // **القمر الصناعي فقط (raster)**: صور الأرض هي مصدر «التحميل اللحظيّ» الأثقل؛ نتجاهل الطبقة المتّجهة/الداكنة (تتدفّق سريعاً).
  const sources: TileSource[] = [];
  for (const src of Object.values(style.sources ?? {})) {
    const s = src as { type?: string; tiles?: string[]; minzoom?: number; maxzoom?: number };
    if (s.type !== "raster" || !Array.isArray(s.tiles) || !s.tiles.length) continue;
    const tpl = s.tiles[0];
    if (!tpl || !tpl.includes("{z}")) continue;
    sources.push({ tpl, srcMin: typeof s.minzoom === "number" ? s.minzoom : 0, srcMax: typeof s.maxzoom === "number" ? s.maxzoom : 22 });
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  const addTile = (z: number, x: number, y: number): void => {
    for (const src of sources) {
      if (z < src.srcMin || z > src.srcMax) continue;
      const u = src.tpl.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
      if (!seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }
  };
  const [w, s, e, n] = bounds;
  // ① عرض إجماليّ: الخريطة الكاملة (bounds) من zMin حتى wideZMax — طيران/تصفّح بلا تقطّع على المستوى الإجماليّ/المتوسّط.
  for (let z = zMin; z <= wideZMax && urls.length < maxTiles; z++) {
    const x0 = lng2x(w, z);
    const x1 = lng2x(e, z);
    const y0 = lat2y(n, z); // الشمال = أعلى (y أصغر)
    const y1 = lat2y(s, z); // الجنوب = أسفل (y أكبر)
    for (let x = x0; x <= x1 && urls.length < maxTiles; x++) {
      for (let y = y0; y <= y1 && urls.length < maxTiles; y++) addTile(z, x, y);
    }
  }
  // ② عمق: حول كلّ قطعة (حيث يتنقّل المستخدم فعلاً) من wideZMax+1 حتى zMax — تفصيل القطعة بلا تقطّع. إن لا نقاط، نعمّق المنطقة كلّها (مقيَّداً بالسقف).
  for (let z = wideZMax + 1; z <= zMax && urls.length < maxTiles; z++) {
    if (deepPoints.length) {
      for (const [lng, lat] of deepPoints) {
        if (urls.length >= maxTiles) break;
        const cx = lng2x(lng, z);
        const cy = lat2y(lat, z);
        for (let x = cx - deepRadius; x <= cx + deepRadius && urls.length < maxTiles; x++) {
          for (let y = cy - deepRadius; y <= cy + deepRadius && urls.length < maxTiles; y++) addTile(z, x, y);
        }
      }
    } else {
      const x0 = lng2x(w, z);
      const x1 = lng2x(e, z);
      const y0 = lat2y(n, z);
      const y1 = lat2y(s, z);
      for (let x = x0; x <= x1 && urls.length < maxTiles; x++) {
        for (let y = y0; y <= y1 && urls.length < maxTiles; y++) addTile(z, x, y);
      }
    }
  }

  const total = urls.length;
  onProgress?.(0, total);
  if (!total) return { cancel: () => {} };

  let cancelled = false;
  let idx = 0;
  let done = 0;
  const ctrl = new AbortController();
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const worker = async (): Promise<void> => {
    while (!cancelled) {
      const i = idx++;
      if (i >= total) return;
      try {
        // التخبئة تعتمد على رؤوس Cache-Control من الوسيط (MapTiler/Azure/Esri: max-age=86400) لا على استهلاك الجسم.
        const res = await fetch(urls[i]!, { signal: ctrl.signal, cache: "force-cache" });
        if (res.status === 429) { cancelled = true; ctrl.abort(); break; } // **حدّ المعدّل**: أوقف التحميل المسبق فوراً (الباقي يتدفّق عند الطلب) — لا نُغرق MapTiler
        await res.arrayBuffer(); // إكمال التنزيل (العنوان مطابق لما تطلبه MapLibre ⇒ إصابة كاش)
      } catch {
        // ومضة شبكة/إلغاء — تجاهل (MapLibre سيُعيد المحاولة عند الطلب)
      }
      done++;
      if (!cancelled) onProgress?.(done, total); // لا تبليغ بعد الإلغاء/الفكّ
      if (!cancelled && throttleMs > 0) await sleep(throttleMs); // مهلة لطيفة بين الطلبات
    }
  };
  // إشارة الاكتمال النهائيّة بعد خروج كلّ العمّال فعلاً (لا داخل الحلقة) — فلا يختفي مؤشّر التقدّم قبل انتهاء آخر جلب.
  void Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()))
    .then(() => {
      onProgress?.(total, total); // إشارة انتهاء (اكتمال أو توقّف عند 429) ⇒ تُخفي شاشة التقدّم دائماً (لا تتجمّد)
    })
    .catch(() => {});
  return {
    cancel: () => {
      cancelled = true;
      ctrl.abort();
    },
  };
}
