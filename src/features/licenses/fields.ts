import type { CsvColumn } from "@/lib/export-csv";
import { sectorLabel } from "@/lib/sectors";

// حقول الرخص (§ج.8/2). بلا معرّف داخلي/تحقّق/إحالات داخلية (§ح).
export type FieldType = "text" | "number" | "date" | "textarea" | "select";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}

// الحالات الثلاث للرخصة (قيد/منجزة/مسحوبة) — رمز ثابت + تسمية عربية.
export const LICENSE_STATUSES = [
  { value: "in-progress", label: "قيد الإنجاز" },
  { value: "completed", label: "منجزة" },
  { value: "withdrawn", label: "مسحوبة" },
] as const;

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LICENSE_STATUSES.map((s) => [s.value, s.label]),
);

/** رمز الحالة ← تسمية عربية (المجهول/الفارغ ← ""). */
export function licenseStatusLabel(value: unknown): string {
  return STATUS_LABEL[String(value ?? "")] ?? "";
}

/**
 * تطبيع حالة الرخصة عند الحفظ (دالّة نقية مُختبرة):
 * إنشاء بلا حالة ← الافتراضي «قيد الإنجاز» (العمود إلزامي)؛
 * تحديث بلا حالة ← يُحذف المفتاح فلا تُمسّ الحالة المخزّنة (تغييرها حصراً عبر نقل الحالة §هـ.2).
 */
export function normalizeLicenseStatusForSave(
  values: Record<string, unknown>,
  isUpdate: boolean,
): Record<string, unknown> {
  const v = { ...values };
  if (!v.status) {
    if (isUpdate) delete v.status;
    else v.status = "in-progress";
  }
  return v;
}

// حقول التحرير (§هـ.5 «أيّ حقل»). company_ref/opportunity_ref مؤجَّلة لمحرّك الربط (م3).
export const LICENSE_FORM_FIELDS: readonly FieldDef[] = [
  { key: "license_number", label: "رقم الرخصة", type: "text" },
  { key: "status", label: "الحالة", type: "select", options: [...LICENSE_STATUSES] },
  { key: "title", label: "العنوان", type: "text" },
  { key: "project_type", label: "نوع المشروع", type: "text" },
  { key: "sector", label: "القطاع", type: "text" },
  { key: "description", label: "الوصف", type: "textarea" },
  { key: "raw_details", label: "التفاصيل", type: "textarea" },
  { key: "parcel_no", label: "رقم القطعة", type: "text" },
  { key: "muqataa_no", label: "رقم المقاطعة", type: "text" },
  { key: "muqataa_name", label: "اسم المقاطعة", type: "text" },
  { key: "district", label: "القضاء", type: "text" },
  { key: "subdistrict", label: "الناحية", type: "text" },
  { key: "neighborhood", label: "الحي/المنطقة", type: "text" },
  { key: "area_olk", label: "المساحة (أولك)", type: "number" },
  { key: "area_m2", label: "المساحة (م²)", type: "number" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)", type: "number" },
  { key: "area_factor_note", label: "ملاحظة المساحة", type: "text" },
  { key: "owner", label: "العائدية/المالك", type: "text" },
  { key: "land_right", label: "نوع الحقّ", type: "text" },
  { key: "zoning", label: "التخطيط", type: "text" },
  { key: "investor_name", label: "اسم المستثمر", type: "text" },
  { key: "investor_nationality", label: "جنسية المستثمر", type: "text" },
  { key: "capital", label: "رأس المال", type: "number" },
  { key: "lease_rate", label: "بدل الإيجار", type: "number" },
  { key: "term_years", label: "مدة العقد (سنوات)", type: "number" },
  { key: "issue_date", label: "تاريخ الإصدار", type: "date" },
  { key: "renewal_date", label: "تاريخ التجديد", type: "date" },
  { key: "completion_date", label: "تاريخ الإنجاز", type: "date" },
  { key: "withdrawal_date", label: "تاريخ السحب", type: "date" },
  { key: "withdrawal_reason", label: "سبب السحب", type: "textarea" },
  { key: "source_url", label: "المصدر (رابط)", type: "text" },
  { key: "notes", label: "ملاحظات", type: "textarea" },
];

// حقول لها قيم معلومة ← قائمة منسدلة (datalist).
export const LICENSE_OPTION_FIELDS: readonly string[] = [
  "sector",
  "project_type",
  "district",
  "subdistrict",
  "neighborhood",
  "muqataa_name",
  "land_right",
  "investor_nationality",
];

// أعمدة التصدير (بلا معرّف داخلي/تحقّق — §ح؛ القطاع والحالة بالعربي).
export const LICENSE_EXPORT_COLUMNS: readonly CsvColumn[] = [
  { key: "license_number", label: "رقم الرخصة" },
  { key: "status", label: "الحالة", format: (v) => licenseStatusLabel(v) || null },
  { key: "title", label: "العنوان" },
  { key: "sector", label: "القطاع", format: (v) => (v ? sectorLabel(String(v)) : null) },
  { key: "parcel_no", label: "رقم القطعة" },
  { key: "muqataa_no", label: "المقاطعة" },
  { key: "district", label: "القضاء" },
  { key: "subdistrict", label: "الناحية" },
  { key: "neighborhood", label: "الحي/المنطقة" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)" },
  { key: "owner", label: "العائدية" },
  { key: "investor_name", label: "المستثمر" },
  { key: "issue_date", label: "تاريخ الإصدار" },
  { key: "completion_date", label: "تاريخ الإنجاز" },
];
