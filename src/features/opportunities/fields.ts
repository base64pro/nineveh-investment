import type { CsvColumn } from "@/lib/export-csv";

export type FieldType = "text" | "number" | "date" | "textarea";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
}

// حقول التحرير (المفاتيح الأساسية؛ نافذة القطعة بكل الحقول في م3). بلا معرّف داخلي/تحقّق (§ح).
export const OPPORTUNITY_FORM_FIELDS: readonly FieldDef[] = [
  { key: "title", label: "العنوان", type: "text" },
  { key: "project_type", label: "نوع المشروع", type: "text" },
  { key: "sector", label: "القطاع", type: "text" },
  { key: "parcel_no", label: "رقم القطعة", type: "text" },
  { key: "muqataa_no", label: "رقم المقاطعة", type: "text" },
  { key: "muqataa_name", label: "اسم المقاطعة", type: "text" },
  { key: "district", label: "القضاء", type: "text" },
  { key: "area_olk", label: "المساحة (أولك)", type: "number" },
  { key: "area_m2", label: "المساحة (م²)", type: "number" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)", type: "number" },
  { key: "owner", label: "العائدية/المالك", type: "text" },
  { key: "zoning", label: "التخطيط", type: "text" },
  { key: "announcement_number", label: "رقم الإعلان", type: "text" },
  { key: "announcement_type", label: "نوع الإعلان", type: "text" },
  { key: "publish_date", label: "تاريخ النشر", type: "date" },
  { key: "deadline", label: "آخر موعد", type: "date" },
  { key: "opp_status", label: "حالة الإعلان", type: "text" },
  { key: "doc_fee", label: "أجور الوثائق", type: "number" },
  { key: "conditions", label: "الشروط", type: "textarea" },
  { key: "notes", label: "ملاحظات", type: "textarea" },
];

// أعمدة التصدير (بلا معرّف داخلي ولا حالة تحقّق — §ح).
export const OPPORTUNITY_EXPORT_COLUMNS: readonly CsvColumn[] = [
  { key: "title", label: "العنوان" },
  { key: "sector", label: "القطاع" },
  { key: "parcel_no", label: "رقم القطعة" },
  { key: "muqataa_no", label: "المقاطعة" },
  { key: "district", label: "القضاء" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)" },
  { key: "owner", label: "العائدية" },
  { key: "announcement_number", label: "رقم الإعلان" },
  { key: "publish_date", label: "تاريخ النشر" },
  { key: "deadline", label: "آخر موعد" },
  { key: "opp_status", label: "حالة الإعلان" },
];
