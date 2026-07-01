// إعداد خريطة نينوى (§هـ.4 · §هـ.3). الأرقام لاتينية، الحدود نينوى حصراً.

export const MAP_CENTER: [number, number] = [43.13, 36.34]; // من nineveh_maptiler.html
export const INITIAL_ZOOM = 5; // منظر واسع للدخول المتسارع
export const MAX_ZOOM = 20; // م9.11 · مستوى القطعة + اقتراب أعمق (طيران ٢٠٠م للهيئة · دورة الجولة ٤٠٠م) — القمر الصناعيّ (Google) أصليّ حتى z20
// هامش حول صندوق المحافظة عند قفل maxBounds (واسع كفايةً لتنقّل سلس بلا ارتداد)
export const MAX_BOUNDS_PADDING_DEG = 0.5;

export type BaseStyle = "dark" | "light" | "satellite";

// أنماط MapTiler عبر الوسيط (المفتاح خادمي — لا يصل العميل)
const BASE_STYLE_IDS: Record<BaseStyle, string> = {
  dark: "streets-v2-dark", // القاعدة الكحلية المضبوطة (§هـ.4)
  light: "streets-v2",
  satellite: "hybrid",
};

export const DEFAULT_BASE: BaseStyle = "satellite"; // م9.7 · القمر الصناعي هو الوضع الافتراضي (تبرز عليه الكيانات الزرقاء)

export function styleUrl(base: BaseStyle): string {
  return `/api/maptiler/maps/${BASE_STYLE_IDS[base]}/style.json`;
}

// م9.8/م9.11 · مزوّد صور القمر الصناعي — مزوّدان فقط: "maptiler" (نمط hybrid) و"google" (Google Map Tiles API
// الرسمية · Maxar ~0.5م · تحديث 1-3 سنوات · الأوضح/الأحدث · شروطها تجيز العرض في محرّك طرف ثالث مثل MapLibre).
// (أُزيلت esri/azure/airbus بطلب المستخدم — م9.11.) Mapbox مُستبعَد: شروطه تمنع التمرير عبر وسيط وتشترط محرّكه.
// التبديل **عبر متغيّر بيئة بلا تعديل كود**: NEXT_PUBLIC_SATELLITE_PROVIDER=google (مع GOOGLE_MAPS_KEY خادميّاً).
// الافتراضي "maptiler". (NEXT_PUBLIC مُضمَّن وقت البناء — يلزم إعادة بناء على Render / إعادة تشغيل محلّيّاً.)
export type SatelliteProvider = "maptiler" | "google";
const ALLOWED_PROVIDERS: readonly SatelliteProvider[] = ["maptiler", "google"];
const ENV_PROVIDER = process.env.NEXT_PUBLIC_SATELLITE_PROVIDER as SatelliteProvider | undefined;
export const SATELLITE_PROVIDER: SatelliteProvider = ENV_PROVIDER && ALLOWED_PROVIDERS.includes(ENV_PROVIDER) ? ENV_PROVIDER : "maptiler";

// مصدر صور Google (raster عبر الوسيط) — القالب مُمرَّر، المفتاح + session token يُحقَنان خادمياً في /api/imagery/google.
export const IMAGERY_SOURCES: Record<
  Exclude<SatelliteProvider, "maptiler">,
  { tiles: string[]; tileSize: number; maxzoom: number; attribution: string }
> = {
  google: {
    // وسيط مخصّص (session token خادمي) — القالب القياسي z/x/y. ⚠ للإنتاج يُنصح بإظهار شعار Google + إسناد Maxar.
    tiles: ["/api/imagery/google/{z}/{x}/{y}"],
    tileSize: 256,
    maxzoom: 20,
    attribution: "Google · Maxar Technologies",
  },
};

export const BASES: ReadonlyArray<{ id: BaseStyle; label: string }> = [
  { id: "dark", label: "داكن" },
  { id: "light", label: "فاتح" },
  { id: "satellite", label: "قمر صناعي" },
];

// لوحة الحدود الكحلية على قاعدة داكنة (مشتقّة من §هـ.3 + nineveh_maptiler.html)
export const BOUNDARY_COLORS = {
  governorate: { line: "#aebfe0", width: 2.4 },
  districts: { line: "#6f83b0", width: 1.4 },
  subdistricts: { line: "#4a5c86", width: 0.9 },
  label: "#e8edf5",
  labelHalo: "#0b1220",
};

// ضبط نحو الكحلي المات للقاعدة الداكنة — أرضية أعمق غموقاً (م7.6+++ · م8.10: أدكن أكثر بطلب) تحت الشبكة الشعرية
export const NAVY = { background: "#010308", water: "#01040b" };

// تعتيم محيط نينوى (§هـ.4 — «ما حولها معتم») — منسجم مع الأرضية الأغمق
export const DIM_COLOR = "rgba(3,5,10,0.42)";
