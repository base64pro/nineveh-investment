/**
 * قطاعات الفرص: رمز ثابت (محفوظ) ↔ تسمية عربية (للعرض). §ح: العرض عربي والتخزين بالرمز.
 * الرموز من قيم حقل sector في data/opportunities_structured.json (لا تأليف).
 */
import { NOT_AVAILABLE } from "./format";

export const SECTOR_LABELS: Record<string, string> = {
  commercial: "تجاري",
  health: "صحي",
  industrial: "صناعي",
  housing: "سكني",
  tourism: "سياحي",
  services: "خدمي",
  agricultural: "زراعي",
  // قطاعات إضافية من بيانات الشركات (companies_final.json)
  construction: "إنشاءات",
  energy: "طاقة",
  exchange: "صرافة",
  financial_investment: "استثمار مالي",
  logistics_transport: "نقل ولوجستيات",
  money_transfer: "تحويل مالي",
  real_estate: "عقاري",
  telecom: "اتصالات",
  other: "أخرى",
};

const SECTOR_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(SECTOR_LABELS).map(([code, label]) => [label, code]),
);

/** رمز القطاع ← تسمية عربية للعرض (المجهول يُمرَّر كما هو؛ الفارغ ← «غير متوفّر»). */
export function sectorLabel(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return NOT_AVAILABLE;
  return SECTOR_LABELS[raw] ?? raw;
}

/** تسمية عربية ← رمز ثابت للتخزين (المجهول يُمرَّر كما هو؛ الفارغ ← null). */
export function sectorCode(raw: string | null | undefined): string | null {
  const v = (raw ?? "").toString().trim();
  if (v === "") return null;
  return SECTOR_CODES[v] ?? v;
}
