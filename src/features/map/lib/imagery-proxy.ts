// منطق وسيط الصور الجوية البديلة — معزول للاختبار (القاعدة 6: المفتاح خادمي، لا يصل العميل).
// يبدّل صور القمر الصناعي بمزوّد أوضح/أحدث (Esri احتياطاً · Google عبر مساره الخاصّ) عبر raster مُمرَّر،
// مع إبقاء التسميات السيادية فوقه. Mapbox مُستبعَد (شروطه تمنع التمرير عبر وسيط في MapLibre).

export type ImageryProvider = {
  envKey: string; // اسم متغيّر البيئة للمفتاح (خادمي — لا يُكشف للعميل)
  param: string; // اسم معامل المفتاح في العنوان الأعلى (token / access_token)
  upstream: string; // أساس العنوان الأعلى للإنتاج (مع المفتاح)
  evalUpstream?: string; // بديل بلا مفتاح — تقييم محلّي فقط (لا يُنشَر)
};

// قائمة المزوّدين المسموحة (allowlist) — أيّ مزوّد خارجها يُرفض بـ404.
// Google له مساره الخاصّ (/api/imagery/google) لأنه يتطلّب session token (انظر buildGoogle* أدناه).
export const IMAGERY_PROVIDERS: Record<string, ImageryProvider> = {
  esri: {
    envKey: "ESRI_API_KEY",
    param: "token",
    upstream: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer",
    evalUpstream: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  },
};

// ===== Google Map Tiles API (الخدمة الرسمية) — تدفّق session token ثمّ بلاط z/x/y =====
export const GOOGLE_TILES_API = "https://tile.googleapis.com/v1";

/** عنوان توليد الجلسة (POST). المفتاح خادمي حصراً. */
export function buildGoogleSessionUrl(key: string): string {
  const u = new URL(`${GOOGLE_TILES_API}/createSession`);
  u.searchParams.set("key", key);
  return u.toString();
}

/** عنوان البلاطة الأعلى (z/x/y قياسي) مع الجلسة + المفتاح. */
export function buildGoogleTileUrl(z: string, x: string, y: string, session: string, key: string): string {
  const u = new URL(`${GOOGLE_TILES_API}/2dtiles/${z}/${x}/${y}`);
  u.searchParams.set("session", session);
  u.searchParams.set("key", key);
  return u.toString();
}

// ===== Azure Maps (Render · Get Map Tile · microsoft.imagery) — z/x/y عبر معاملات الاستعلام =====
/** عنوان بلاطة Azure (المفتاح = subscription-key خادمي). */
export function buildAzureTileUrl(z: string, x: string, y: string, key: string): string {
  const u = new URL("https://atlas.microsoft.com/map/tile");
  u.searchParams.set("api-version", "2024-04-01");
  u.searchParams.set("tilesetId", "microsoft.imagery"); // صور جوية (مصدر Airbus)
  u.searchParams.set("zoom", z);
  u.searchParams.set("x", x);
  u.searchParams.set("y", y);
  u.searchParams.set("tileSize", "256");
  u.searchParams.set("subscription-key", key);
  return u.toString();
}

// ===== Airbus OneAtlas — OAuth (api key → bearer) ثمّ بلاط WMTS من قالب التجربة =====
export const AIRBUS_TOKEN_URL =
  "https://authenticate.foundation.api.oneatlas.airbus.com/auth/realms/IDP/protocol/openid-connect/token";

/** يعوّض {z}/{x}/{y} في قالب WMTS الذي يزوّده المستخدم من تجربته (AIRBUS_WMTS_TEMPLATE). */
export function buildAirbusTileUrl(template: string, z: string, x: string, y: string): string {
  return template.replaceAll("{z}", z).replaceAll("{x}", x).replaceAll("{y}", y);
}

/**
 * يختار العنوان الأعلى: المفتاح موجود ⇒ النقطة الإنتاجية (مع المفتاح)؛
 * وإلا بديل التقييم بلا مفتاح (تطوير محلّي فقط)؛ وإلا خطأ (يفرض ضبط المفتاح في الإنتاج).
 */
export function resolveUpstream(
  cfg: ImageryProvider,
  key: string | undefined,
  isProd: boolean,
): { base: string; token?: string } | { error: string } {
  if (key) return { base: cfg.upstream, token: key };
  if (cfg.evalUpstream && !isProd) return { base: cfg.evalUpstream };
  return { error: `${cfg.envKey} مفقود` };
}

/**
 * يبني عنوان البلاطة الأعلى مع حقن المفتاح خادمياً.
 * new URL يحفظ المحارف الصالحة في المسار (مثل @ في mapbox.satellite/{y}@2x.jpg) بلا ترميز %40.
 */
export function buildImageryUrl(
  base: string,
  path: string[],
  incoming: URLSearchParams,
  param?: string,
  key?: string,
): string {
  const url = new URL(`${base}/${path.join("/")}`);
  incoming.forEach((value, name) => url.searchParams.set(name, value));
  if (param && key) url.searchParams.set(param, key); // المفتاح الحقيقي يفوز على أي قيمة واردة من العميل
  return url.toString();
}
