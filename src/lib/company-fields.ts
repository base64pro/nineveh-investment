/**
 * خريطة حقول الشركة (قالب 23 حقلاً — §ج.8/3).
 * - jsonKey: المفتاح العربي الحرفي في companies_final.json (للاستيراد)
 * - column:  عمود القاعدة الإنجليزي
 * - label:   تسمية العرض العربية (طبقة العرض §ح)
 */
import type { Company } from "@/types/entities";

export interface CompanyFieldDef {
  jsonKey: string | null; // null = لا مفتاح في الملف (يُضاف عند البناء)
  column: keyof Company;
  label: string;
}

export const COMPANY_FIELDS: readonly CompanyFieldDef[] = [
  { jsonKey: "معرّف داخلي", column: "id", label: "المعرّف الداخلي" },
  { jsonKey: "اسم الشركة", column: "name", label: "اسم الشركة" },
  { jsonKey: "نوع الشركة", column: "company_type", label: "نوع الشركة" },
  { jsonKey: "القطاع", column: "sector", label: "القطاع" },
  { jsonKey: "النشاط", column: "activity", label: "النشاط" },
  { jsonKey: "رقم القيد", column: "registration_no", label: "رقم القيد" },
  { jsonKey: "رقم الإضبارة", column: "file_no", label: "رقم الإضبارة" },
  { jsonKey: "رأس المال بالدينار", column: "capital_iqd", label: "رأس المال بالدينار" },
  { jsonKey: "رأس المال بالدولار", column: "capital_usd", label: "رأس المال بالدولار" },
  { jsonKey: "مستثناة", column: "is_excluded", label: "مستثناة" },
  { jsonKey: "تستوفي عتبة 250 ألف", column: "meets_250k_threshold", label: "تستوفي عتبة 250 ألف" },
  { jsonKey: "المدير", column: "manager", label: "المدير" },
  { jsonKey: "المساهمون والنسب", column: "shareholders", label: "المساهمون والنسب" },
  { jsonKey: "الهاتف", column: "phone", label: "الهاتف" },
  { jsonKey: "البريد الإلكتروني", column: "email", label: "البريد الإلكتروني" },
  { jsonKey: "الموقع الإلكتروني", column: "website", label: "الموقع الإلكتروني" },
  { jsonKey: "المحافظة", column: "governorate", label: "المحافظة" },
  { jsonKey: "العنوان", column: "address", label: "العنوان" },
  { jsonKey: "المصدر", column: "source", label: "المصدر" },
  { jsonKey: "الفرص المطابقة", column: "matched_opportunities", label: "الفرص المطابقة" },
  { jsonKey: "ملاحظات", column: "notes", label: "ملاحظات" },
  { jsonKey: "تاريخ الإضافة وآخر تعديل", column: "updated_at_label", label: "تاريخ الإضافة والتعديل" },
  { jsonKey: null, column: "projects", label: "سجلّ المشاريع/الخبرة" },
] as const;

/** خريطة المفتاح العربي → العمود الإنجليزي (للاستيراد). */
export const COMPANY_JSON_TO_COLUMN: Readonly<Record<string, keyof Company>> = Object.fromEntries(
  COMPANY_FIELDS.filter((f) => f.jsonKey !== null).map((f) => [f.jsonKey as string, f.column]),
);

/** خريطة العمود الإنجليزي → التسمية العربية (للعرض §ح). */
export const COMPANY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  COMPANY_FIELDS.map((f) => [f.column, f.label]),
);
