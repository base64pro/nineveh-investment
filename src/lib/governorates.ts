/**
 * محافظات العراق: رمز ISO 3166-2 (المحفوظ في بيانات الشركات، مثل IQ-BG) ↔ اسم عربي للعرض (§ح).
 * المصدر: قيم حقل governorate في companies_final.json (رموز قياسية). التخزين بالرمز، العرض عربي.
 */
import { NOT_AVAILABLE } from "./format";

const GOVERNORATE_LABELS: Record<string, string> = {
  "IQ-AN": "الأنبار",
  "IQ-AR": "أربيل",
  "IQ-BA": "البصرة",
  "IQ-BB": "بابل",
  "IQ-BG": "بغداد",
  "IQ-DA": "دهوك",
  "IQ-DI": "ديالى",
  "IQ-DQ": "ذي قار",
  "IQ-HA": "حلبجة",
  "IQ-KA": "كربلاء",
  "IQ-KI": "كركوك",
  "IQ-MA": "ميسان",
  "IQ-MU": "المثنى",
  "IQ-NA": "النجف",
  "IQ-NI": "نينوى",
  "IQ-QA": "القادسية",
  "IQ-SD": "صلاح الدين",
  "IQ-SU": "السليمانية",
  "IQ-WA": "واسط",
};

const GOVERNORATE_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(GOVERNORATE_LABELS).map(([code, label]) => [label, code]),
);

/** رمز المحافظة ← اسم عربي (المجهول يُمرَّر؛ الفارغ ← «غير متوفّر»). */
export function governorateLabel(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return NOT_AVAILABLE;
  return GOVERNORATE_LABELS[raw] ?? raw;
}

/** اسم عربي ← رمز محفوظ (المجهول يُمرَّر؛ الفارغ ← null). */
export function governorateCode(raw: string | null | undefined): string | null {
  const v = (raw ?? "").toString().trim();
  if (v === "") return null;
  return GOVERNORATE_CODES[v] ?? v;
}
