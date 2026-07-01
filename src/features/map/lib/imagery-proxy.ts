// منطق وسيط صور Google Map Tiles API — معزول للاختبار (القاعدة 6: المفتاح خادمي، لا يصل العميل).
// م9.11 · المزوّد البديل الوحيد = Google (أُزيلت esri/azure/airbus). يبدّل صور القمر الصناعي بصور Google
// (Maxar) عبر raster مُمرَّر مع إبقاء التسميات السيادية فوقه. Mapbox مُستبعَد (شروطه تمنع التمرير عبر وسيط في MapLibre).

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
