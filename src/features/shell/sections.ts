import {
  BadgeCheck,
  BarChart3,
  Building2,
  Library,
  Megaphone,
  PencilRuler,
  Scale,
  Settings,
  type LucideIcon,
} from "lucide-react";

// أقسام السايدبار الثمانية (§هـ.1) بترتيبها.
export interface SectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  table: string | null; // جدول العدّاد (إن وُجد)
  note: string; // مرحلة البناء
}

export const SECTIONS: readonly SectionDef[] = [
  { id: "legal-advisor", label: "المستشار القانوني للاستثمار", icon: Scale, table: null, note: "المستشار القانوني الذكي — يُبنى في م4." },
  { id: "opportunities", label: "الفرص الاستثمارية", icon: Megaphone, table: "opportunities", note: "إدارة الفرص المعلَنة (CRUD + فلترة + تصدير) — م2.2." },
  { id: "licenses", label: "الرخص الاستثمارية", icon: BadgeCheck, table: "licenses", note: "متابعة الرخص + سجلّ الزيارات — م2.2." },
  { id: "companies", label: "الشركات", icon: Building2, table: "companies", note: "بنك الشركات المؤهّلة (CRUD + إثراء) — م2.2." },
  { id: "criteria", label: "مكتبة المعايير", icon: Library, table: "criteria", note: "أرشيف المعايير المحفوظة — م2.2." },
  { id: "reports", label: "التقارير الذكية", icon: BarChart3, table: null, note: "لوحات وتشارتات وتقارير — م5." },
  { id: "opportunity-design", label: "تصميم فرصة", icon: PencilRuler, table: "assumed_parcels", note: "الفرص المفترضة — م2.2." },
  { id: "settings", label: "إعدادات المستخدم", icon: Settings, table: null, note: "الحساب والعرض والذكاء والتصدير — م5." },
];
