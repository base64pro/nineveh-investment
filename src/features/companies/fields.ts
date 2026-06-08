import type { CsvColumn } from "@/lib/export-csv";
import { sectorLabel } from "@/lib/sectors";
import { governorateLabel } from "@/lib/governorates";
import type { Company } from "@/types/entities";

// حقول الشركة (قالب 23 — §ج.8/3). يُمنع عرض المعرّف الداخلي id (§ح).
export type FieldType = "text" | "number" | "textarea" | "select" | "boolean";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}

const YES_NO = [
  { value: "false", label: "لا" },
  { value: "true", label: "نعم" },
];
const YES_NO_NULL = [
  { value: "", label: "غير محدّد" },
  { value: "true", label: "نعم" },
  { value: "false", label: "لا" },
];

// المصفوفات (المساهمون/المصدر/المشاريع/المطابقة) تُعرض في التفاصيل؛ تحريرها/الإثراء لاحقاً (م4).
export const COMPANY_FORM_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "اسم الشركة", type: "text" },
  { key: "company_type", label: "نوع الشركة", type: "text" },
  { key: "sector", label: "القطاع", type: "text" },
  { key: "activity", label: "النشاط", type: "text" },
  { key: "registration_no", label: "رقم القيد", type: "text" },
  { key: "file_no", label: "رقم الإضبارة", type: "text" },
  { key: "capital_iqd", label: "رأس المال (دينار)", type: "number" },
  { key: "capital_usd", label: "رأس المال (دولار)", type: "number" },
  { key: "is_excluded", label: "مستثناة قانوناً", type: "boolean", options: YES_NO },
  { key: "meets_250k_threshold", label: "تستوفي عتبة 250 ألف", type: "boolean", options: YES_NO_NULL },
  { key: "manager", label: "المدير", type: "text" },
  { key: "phone", label: "الهاتف", type: "text" },
  { key: "email", label: "البريد الإلكتروني", type: "text" },
  { key: "website", label: "الموقع الإلكتروني", type: "text" },
  { key: "governorate", label: "المحافظة", type: "text" },
  { key: "address", label: "العنوان", type: "textarea" },
  { key: "notes", label: "ملاحظات", type: "textarea" },
];

export const COMPANY_OPTION_FIELDS: readonly string[] = ["company_type", "sector", "activity", "governorate"];
export const COMPANY_BOOLEAN_FIELDS: readonly string[] = ["is_excluded", "meets_250k_threshold"];

/** الشركة مؤهّلة: غير مستثناة وتستوفي العتبة (§ج.9 — معايير المستثمر). */
export function isEligible(c: Company): boolean {
  return !c.is_excluded && c.meets_250k_threshold === true;
}

// أعمدة التصدير (بلا معرّف داخلي — §ح؛ القطاع/المحافظة بالعربي).
export const COMPANY_EXPORT_COLUMNS: readonly CsvColumn[] = [
  { key: "name", label: "اسم الشركة" },
  { key: "company_type", label: "نوع الشركة" },
  { key: "sector", label: "القطاع", format: (v) => (v ? sectorLabel(String(v)) : null) },
  { key: "activity", label: "النشاط" },
  { key: "registration_no", label: "رقم القيد" },
  { key: "capital_usd", label: "رأس المال (دولار)" },
  { key: "is_excluded", label: "مستثناة", format: (v) => (v === true ? "نعم" : v === false ? "لا" : null) },
  { key: "meets_250k_threshold", label: "تستوفي العتبة", format: (v) => (v === true ? "نعم" : v === false ? "لا" : null) },
  { key: "manager", label: "المدير" },
  { key: "phone", label: "الهاتف" },
  { key: "governorate", label: "المحافظة", format: (v) => (v ? governorateLabel(String(v)) : null) },
];
