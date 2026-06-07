import type { CsvColumn } from "@/lib/export-csv";
import { sectorLabel } from "@/lib/sectors";

export type FieldType = "text" | "number" | "date" | "textarea";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
}

// حقول التحرير — كل الحقول القابلة للتحرير (§هـ.5 «أيّ حقل»). بلا معرّف داخلي/تحقّق (§ح).
export const OPPORTUNITY_FORM_FIELDS: readonly FieldDef[] = [
  { key: "title", label: "العنوان", type: "text" },
  { key: "project_type", label: "نوع المشروع", type: "text" },
  { key: "sector", label: "القطاع", type: "text" },
  { key: "description", label: "الوصف", type: "textarea" },
  { key: "raw_details", label: "التفاصيل", type: "textarea" },
  { key: "parcel_no", label: "رقم القطعة", type: "text" },
  { key: "muqataa_no", label: "رقم المقاطعة", type: "text" },
  { key: "muqataa_name", label: "اسم المقاطعة", type: "text" },
  { key: "district", label: "القضاء", type: "text" },
  { key: "neighborhood", label: "الحي", type: "text" },
  { key: "area_olk", label: "المساحة (أولك)", type: "number" },
  { key: "area_m2", label: "المساحة (م²)", type: "number" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)", type: "number" },
  { key: "area_factor_note", label: "ملاحظة المساحة", type: "text" },
  { key: "owner", label: "العائدية/المالك", type: "text" },
  { key: "zoning", label: "التخطيط", type: "text" },
  { key: "announcement_number", label: "رقم الإعلان", type: "text" },
  { key: "announcement_type", label: "نوع الإعلان", type: "text" },
  { key: "publish_date", label: "تاريخ النشر", type: "date" },
  { key: "deadline", label: "آخر موعد", type: "date" },
  { key: "opp_status", label: "حالة الإعلان", type: "text" },
  { key: "doc_fee", label: "أجور الوثائق", type: "number" },
  { key: "conditions", label: "الشروط", type: "textarea" },
  { key: "source_url", label: "المصدر (رابط)", type: "text" },
  { key: "notes", label: "ملاحظات", type: "textarea" },
];

// حقول لها قيم معلومة ← قائمة منسدلة (datalist: اقتراحات + إدخال حرّ، بلا تأليف).
export const OPPORTUNITY_OPTION_FIELDS: readonly string[] = [
  "sector",
  "project_type",
  "district",
  "neighborhood",
  "muqataa_name",
  "announcement_type",
  "opp_status",
];

// حقول العرض التفصيلي (بلا معرّف داخلي/تحقّق/إحالات داخلية — §ح).
export const OPPORTUNITY_DETAIL_FIELDS: readonly FieldDef[] = [
  { key: "title", label: "العنوان", type: "text" },
  { key: "project_type", label: "نوع المشروع", type: "text" },
  { key: "sector", label: "القطاع", type: "text" },
  { key: "description", label: "الوصف", type: "textarea" },
  { key: "raw_details", label: "التفاصيل", type: "textarea" },
  { key: "parcel_no", label: "رقم القطعة", type: "text" },
  { key: "muqataa_no", label: "رقم المقاطعة", type: "text" },
  { key: "muqataa_name", label: "اسم المقاطعة", type: "text" },
  { key: "district", label: "القضاء", type: "text" },
  { key: "neighborhood", label: "الحي", type: "text" },
  { key: "area_olk", label: "المساحة (أولك)", type: "number" },
  { key: "area_m2", label: "المساحة (م²)", type: "number" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)", type: "number" },
  { key: "area_factor_note", label: "ملاحظة المساحة", type: "text" },
  { key: "owner", label: "العائدية/المالك", type: "text" },
  { key: "zoning", label: "التخطيط", type: "text" },
  { key: "announcement_number", label: "رقم الإعلان", type: "text" },
  { key: "announcement_type", label: "نوع الإعلان", type: "text" },
  { key: "publish_date", label: "تاريخ النشر", type: "date" },
  { key: "deadline", label: "آخر موعد", type: "date" },
  { key: "opp_status", label: "حالة الإعلان", type: "text" },
  { key: "doc_fee", label: "أجور الوثائق", type: "number" },
  { key: "conditions", label: "الشروط", type: "textarea" },
  { key: "views", label: "المشاهدات", type: "number" },
  { key: "announcement_count", label: "عدد الإعلانات", type: "number" },
  { key: "source_url", label: "المصدر (رابط)", type: "text" },
  { key: "notes", label: "ملاحظات", type: "textarea" },
];

// أعمدة التصدير (بلا معرّف داخلي ولا حالة تحقّق — §ح).
export const OPPORTUNITY_EXPORT_COLUMNS: readonly CsvColumn[] = [
  { key: "title", label: "العنوان" },
  { key: "sector", label: "القطاع", format: (v) => (v ? sectorLabel(String(v)) : null) },
  { key: "parcel_no", label: "رقم القطعة" },
  { key: "muqataa_no", label: "المقاطعة" },
  { key: "district", label: "القضاء" },
  { key: "neighborhood", label: "الحي" },
  { key: "area_total_m2", label: "المساحة الكلية (م²)" },
  { key: "owner", label: "العائدية" },
  { key: "announcement_number", label: "رقم الإعلان" },
  { key: "publish_date", label: "تاريخ النشر" },
  { key: "deadline", label: "آخر موعد" },
  { key: "opp_status", label: "حالة الإعلان" },
];
