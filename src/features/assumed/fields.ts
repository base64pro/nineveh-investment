import type { CsvColumn } from "@/lib/export-csv";
import { sectorLabel } from "@/lib/sectors";

// القطعة المفترضة (§ج.8/9 · §هـ.4 أداة الرسم). الهندسة + الاستنتاج المكاني في م2.4؛ هنا CRUD للحقول.
export type FieldType = "text" | "number" | "textarea";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
}

export const ASSUMED_FORM_FIELDS: readonly FieldDef[] = [
  { key: "parcel_no", label: "رقم القطعة", type: "text" },
  { key: "muqataa_no", label: "رقم المقاطعة", type: "text" },
  { key: "muqataa_name", label: "اسم المقاطعة", type: "text" },
  { key: "district", label: "القضاء", type: "text" },
  { key: "subdistrict", label: "الناحية", type: "text" },
  { key: "neighborhood", label: "الحي/المنطقة", type: "text" },
  { key: "sector", label: "القطاع", type: "text" },
  { key: "owner", label: "العائدية/المالك", type: "text" },
  { key: "land_right", label: "نوع الحقّ", type: "text" },
  { key: "area_m2", label: "المساحة (م²)", type: "number" },
  { key: "value", label: "القيمة", type: "number" },
  { key: "legal_status", label: "الوضع القانوني", type: "text" },
  { key: "annexation_plan", label: "خطة الضمّ", type: "textarea" },
  { key: "notes", label: "ملاحظات", type: "textarea" },
];

export const ASSUMED_OPTION_FIELDS: readonly string[] = [
  "sector",
  "district",
  "subdistrict",
  "neighborhood",
  "muqataa_name",
  "land_right",
];

export const ASSUMED_EXPORT_COLUMNS: readonly CsvColumn[] = [
  { key: "parcel_no", label: "رقم القطعة" },
  { key: "sector", label: "القطاع", format: (v) => (v ? sectorLabel(String(v)) : null) },
  { key: "district", label: "القضاء" },
  { key: "subdistrict", label: "الناحية" },
  { key: "neighborhood", label: "الحي/المنطقة" },
  { key: "muqataa_no", label: "المقاطعة" },
  { key: "area_m2", label: "المساحة (م²)" },
  { key: "value", label: "القيمة" },
  { key: "owner", label: "العائدية" },
  { key: "land_right", label: "نوع الحقّ" },
];
