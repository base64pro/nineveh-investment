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

export const DEFAULT_BASE: BaseStyle = "dark";

export function styleUrl(base: BaseStyle): string {
  return `/api/maptiler/maps/${BASE_STYLE_IDS[base]}/style.json`;
}

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

// ضبط نحو الكحلي المات للقاعدة الداكنة — أرضية أغمق (م7.6) لإبراز المعالم بحدّة أعلى
export const NAVY = { background: "#0a111f", water: "#070e1a" };

// تعتيم محيط نينوى (§هـ.4 — «ما حولها معتم»)
export const DIM_COLOR = "rgba(7,11,20,0.5)";
