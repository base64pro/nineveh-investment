import type { CsvColumn } from "@/lib/export-csv";

// مكتبة المعايير (§ج.8/5 · §هـ.4 تاب إنشاء معايير). المعرّف الداخلي (uuid) لا يُعرَض (§ح).
export const CRITERION_DOMAINS = [
  { value: "company", label: "شركة" },
  { value: "opportunity", label: "فرصة" },
  { value: "architecture", label: "معمار" },
  { value: "competitive", label: "تنافسي" },
] as const;

export const CRITERION_STATUSES = [
  { value: "active", label: "مفعّل" },
  { value: "disabled", label: "معطّل" },
] as const;

const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(CRITERION_DOMAINS.map((d) => [d.value, d.label]));
const STATUS_LABEL: Record<string, string> = Object.fromEntries(CRITERION_STATUSES.map((s) => [s.value, s.label]));

export function domainLabel(v: unknown): string {
  return DOMAIN_LABEL[String(v ?? "")] ?? "";
}
export function criterionStatusLabel(v: unknown): string {
  return STATUS_LABEL[String(v ?? "")] ?? "";
}

// بند معيار (§ج.8/5): وصف · أساس · وزن · مؤشّر الدعم.
export interface CriterionItem {
  description: string | null;
  basis: string | null;
  weight: string | null;
  support_indicator: string | null;
}

export function asItems(v: unknown): CriterionItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    return {
      description: typeof o.description === "string" ? o.description : null,
      basis: typeof o.basis === "string" ? o.basis : null,
      weight: o.weight === null || o.weight === undefined ? null : String(o.weight),
      support_indicator: typeof o.support_indicator === "string" ? o.support_indicator : null,
    };
  });
}

export const CRITERION_EXPORT_COLUMNS: readonly CsvColumn[] = [
  { key: "name", label: "الاسم" },
  { key: "domain", label: "المجال", format: (v) => domainLabel(v) || null },
  { key: "purpose", label: "الغرض" },
  { key: "status", label: "الحالة", format: (v) => criterionStatusLabel(v) || null },
  { key: "items", label: "عدد البنود", format: (v) => (Array.isArray(v) ? String(v.length) : "0") },
];
