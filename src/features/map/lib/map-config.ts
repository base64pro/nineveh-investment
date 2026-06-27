// إعداد خريطة نينوى (§هـ.4 · §هـ.3). الأرقام لاتينية، الحدود نينوى حصراً.

export const MAP_CENTER: [number, number] = [43.13, 36.34]; // من nineveh_maptiler.html
export const INITIAL_ZOOM = 5; // منظر واسع للدخول المتسارع
export const MAX_ZOOM = 18; // مستوى القطعة
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

// م9.8 · مزوّد صور القمر الصناعي — سطر التبديل الوحيد. "maptiler" = نمط hybrid الحالي؛
// "esri" = طبقة raster مُمرَّرة (دقّة جيدة لكنها مجمَّدة 2021 فوق الموصل — مؤكَّد من خادم Esri — فبديل/احتياط)؛
// "google" = خدمة Google Map Tiles API الرسمية (Maxar ~0.5م · تحديث 1-3 سنوات · الأوضح/الأحدث المتاح)،
// شروطها الرسمية تجيز العرض في محرّك طرف ثالث مثل MapLibre (≠ خرائط Google الاستهلاكية/البلاط المسروق).
// الافتراضي = "maptiler" (آمن للإنتاج الحيّ: القمر قاعدة افتراضية، وgoogle يلزمه مفتاح خادمي + فوترة).
// تُقارَن البدائل محلّياً عبر شريط المقارنة، ويُغيَّر هذا السطر للفائز بعد توفّر مفتاحه. Mapbox مُستبعَد:
// شروطه (§2.8.1/§3.56) تمنع التمرير عبر وسيط وتشترط محرّك Mapbox GL JS (وMapLibre ليس منه).
export type SatelliteProvider = "maptiler" | "esri" | "google" | "azure" | "airbus";
// م9.9 · المزوّد قابل للتبديل **عبر متغيّر بيئة بلا تعديل كود**: NEXT_PUBLIC_SATELLITE_PROVIDER=google (مع GOOGLE_MAPS_KEY خادميّاً).
// الافتراضي "maptiler". (NEXT_PUBLIC مُضمَّن وقت البناء — يلزم إعادة بناء على Render / إعادة تشغيل محلّيّاً.)
const ALLOWED_PROVIDERS: readonly SatelliteProvider[] = ["maptiler", "esri", "google", "azure", "airbus"];
const ENV_PROVIDER = process.env.NEXT_PUBLIC_SATELLITE_PROVIDER as SatelliteProvider | undefined;
export const SATELLITE_PROVIDER: SatelliteProvider = ENV_PROVIDER && ALLOWED_PROVIDERS.includes(ENV_PROVIDER) ? ENV_PROVIDER : "maptiler";

// مصادر الصور البديلة (raster عبر الوسيط) — القوالب مُمرَّرة، المفتاح يُحقَن خادمياً في /api/imagery.
export const IMAGERY_SOURCES: Record<
  Exclude<SatelliteProvider, "maptiler">,
  { tiles: string[]; tileSize: number; maxzoom: number; attribution: string }
> = {
  esri: {
    tiles: ["/api/imagery/esri/tile/{z}/{y}/{x}"], // ترتيب Esri: z/y/x (الصفّ قبل العمود)
    tileSize: 256,
    maxzoom: 19,
    attribution: "Esri · Maxar · Earthstar Geographics",
  },
  google: {
    // وسيط مخصّص (session token خادمي) — القالب القياسي z/x/y. ⚠ للإنتاج يلزم إظهار شعار Google + إسناد Maxar.
    tiles: ["/api/imagery/google/{z}/{x}/{y}"],
    tileSize: 256,
    maxzoom: 20,
    attribution: "Google · Maxar Technologies",
  },
  azure: {
    // Azure Maps (microsoft.imagery · مصدر Airbus) — z/x/y عبر معاملات الاستعلام في الوسيط.
    tiles: ["/api/imagery/azure/{z}/{x}/{y}"],
    tileSize: 256,
    maxzoom: 19,
    attribution: "© Microsoft · Airbus",
  },
  airbus: {
    // Airbus OneAtlas (تجريبي · WMTS) — يلزم AIRBUS_API_KEY + AIRBUS_WMTS_TEMPLATE من حساب التجربة.
    tiles: ["/api/imagery/airbus/{z}/{x}/{y}"],
    tileSize: 256,
    maxzoom: 18,
    attribution: "© Airbus DS",
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
