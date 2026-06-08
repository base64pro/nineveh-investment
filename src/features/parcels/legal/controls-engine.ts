// محرّك الضوابط والمعايير القانونية — **حتمي بالقواعد لا بالذكاء** (§ج.9 · CLAUDE.md قاعدة 5).
// دوالّ نقية: تأخذ حقول القطعة ← تُخرج البنود الملزمة باستشهاد واستيفاء، متكيّفة مع الحالات الخمس.
// الذكاء (لاحقاً) يصوغ الشرح فقط، لا يقرّر. كل بند باستشهاد من §ج.9. ممنوع تأليف بنود/أرقام.

import type { ParcelState } from "@/types/entities";

export type Fulfillment = "met" | "not_met" | "needs_action" | "not_applicable" | "needs_input";
export type ControlType = "mandatory" | "encouraged";

export interface ControlsInput {
  state: ParcelState;
  sector: string | null; // رمز القطاع
  capitalUsd: number | null; // رأس المال (دولار)
  projectValueUsd: number | null; // قيمة المشروع (دولار) — لعتبة الموافقة العليا
  landRight: string | null; // نوع الحقّ
  nationality: string | null; // جنسية المستثمر (نصّ حرّ)
  owner: string | null; // العائدية/المالك
  withdrawalReason: string | null; // سبب السحب (للمسحوبة)
}

export interface ControlItem {
  number: number;
  title: string;
  text: string;
  citation: string; // قانون+سنة+مادة+بند (§ج.9) — لا معرّف داخلي (§ح)
  type: ControlType;
  fulfillment: Fulfillment;
  note?: string;
  requiredInput?: string;
  conditional?: boolean;
}

export type Eligibility = "eligible" | "not_eligible" | "needs_action" | "future";

export interface ControlsResult {
  projectControls: ControlItem[];
  investorCriteria: ControlItem[];
  missingInputs: string[];
  eligibility: Eligibility;
  eligibilityLabel: string;
  gaps: string[];
}

export const CAPITAL_THRESHOLD_USD = 250_000;
export const CABINET_THRESHOLD_USD = 250_000_000;
// مستثنيات م.29: استخراج/إنتاج النفط والغاز · المصارف · شركات التأمين.
// لا يوجد في تصنيف قطاعاتنا الحالي ما يطابقها (صرافة/تحويل مالي ليست مصارف؛ لا تأمين/استخراج نفط).
export const EXCLUDED_SECTORS = new Set<string>();

const fmt = (n: number): string => n.toLocaleString("en-US"); // أرقام لاتينية دائماً (§ح)
const isProspective = (s: ParcelState): boolean => s === "announced" || s === "assumed";

function normNationality(raw: string | null): "iraqi" | "foreign" | "both" | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  const iraqi = v.includes("عراق") || v.includes("iraqi");
  const foreign = v.includes("أجنب") || v.includes("اجنب") || v.includes("foreign");
  if (iraqi && foreign) return "both";
  if (iraqi) return "iraqi";
  if (foreign) return "foreign";
  if (v.includes("مشترك") || v.includes("both") || v.includes("كلا")) return "both";
  return null;
}

function allowancePct(sector: string | null): string | null {
  switch (sector) {
    case "housing":
      return "2% (تمليك سكني)";
    case "tourism":
      return "10% (سياحي)";
    case "commercial":
      return "10% ثم 5% بعد 3 سنوات (و7% ضمن المدن السكنية)";
    case "services":
      return "7% (ضمن المدن السكنية)";
    default:
      return null;
  }
}

const FEES = "وثائق التقديم 1,000,000 · استمارة الطلب 500,000 · نسخة مصدّقة 100,000 · توقيع العقد 1,000,000 · إعادة الإجازة 5,000,000 دينار";

type Outcome = Pick<ControlItem, "fulfillment" | "note" | "requiredInput" | "conditional">;
interface Def {
  number: number;
  title: string;
  text: string;
  citation: string;
  evaluate: (i: ControlsInput) => Outcome;
}

// ===== أولاً — ضوابط المشروع/الأرض (9) =====
const PROJECT_CONTROLS: Def[] = [
  {
    number: 1,
    title: "الجدوى والاستثناء",
    text: "المشروع ضمن مجالات الاستثمار وغير مستثنى (المستثنى: استخراج/إنتاج النفط والغاز · المصارف · التأمين).",
    citation: "قانون 13/2006 م.29",
    evaluate: (i) => {
      if (!i.sector) return { fulfillment: "needs_input", requiredInput: "القطاع" };
      if (EXCLUDED_SECTORS.has(i.sector)) return { fulfillment: "not_met", note: "القطاع من مستثنيات م.29" };
      return { fulfillment: "met", note: "ضمن مجالات الاستثمار وغير مستثنى" };
    },
  },
  {
    number: 2,
    title: "حقّ الأرض",
    text: "تمليك السكني للعراقي والأجنبي؛ الصناعي للعراقي (وشراكة تمويل مع الأجنبي)؛ والمساطحة/الإيجار/التخصيص بدائل وفق نوع الحقّ.",
    citation: "قانون 13/2006 م.10",
    evaluate: (i) => {
      if (isProspective(i.state)) return { fulfillment: "needs_action", note: "يُحدَّد حقّ الأرض وفق جنسية المستثمر والقطاع عند الإجازة", conditional: true };
      const nat = normNationality(i.nationality);
      if (!nat) return { fulfillment: "needs_input", requiredInput: "جنسية المستثمر", conditional: true };
      if (i.sector === "housing") return { fulfillment: "met", note: "السكني: تمليك للعراقي والأجنبي" };
      if (i.sector === "industrial")
        return nat === "foreign"
          ? { fulfillment: "needs_action", note: "الصناعي: التمليك للعراقي؛ والأجنبي عبر شراكة تمويل", conditional: true }
          : { fulfillment: "met", note: "الصناعي: تمليك للعراقي" };
      return { fulfillment: "met", note: `نوع الحقّ: ${i.landRight ?? "مساطحة/إيجار/تخصيص"}` };
    },
  },
  {
    number: 3,
    title: "البدل المالي",
    text: "نسبة من بدل الإيجار السنوي تقدّرها لجان التثمين المحافظية (لا صيغة رقمية ثابتة)، وتختلف بالقطاع.",
    citation: "نظام 6/2017 م.2 وم.5 · نظام 5/2011 · نظام 5/2018",
    evaluate: (i) => {
      if (i.state === "completed") return { fulfillment: "met", note: "البدل المالي مستوفى" };
      const pct = allowancePct(i.sector);
      return { fulfillment: "needs_action", note: pct ? `النسبة: ${pct} × القيمة المقدّرة (تثمين اللجنة)` : "تقدّرها لجنة التثمين المحافظية" };
    },
  },
  {
    number: 4,
    title: "التخصيص والتسليم",
    text: "تسليم العقار المخصّص خلال 30 يوماً من التخصيص خالياً من الشواغل.",
    citation: "نظام 6/2017 م.1/ثالثاً",
    evaluate: (i) => {
      if (i.state === "completed") return { fulfillment: "met", note: "التخصيص والتسليم منجزان" };
      if (i.state === "withdrawn") return { fulfillment: "not_applicable", note: "الإجازة مسحوبة" };
      return { fulfillment: "needs_action", note: "تسليم خلال 30 يوماً من التخصيص خالياً من الشواغل" };
    },
  },
  {
    number: 5,
    title: "إجراءات الإجازة",
    text: "نافذة واحدة · البتّ خلال 45 يوماً · إنجاز متطلبات المباشرة خلال 30 يوماً من صدور الإجازة.",
    citation: "قانون 13/2006 م.20 · م.7/ج · نظام 2/2009 م.25",
    evaluate: (i) => {
      if (i.state === "completed") return { fulfillment: "met", note: "إجراءات الإجازة منجزة" };
      if (i.state === "withdrawn") return { fulfillment: "not_applicable", note: "الإجازة مسحوبة" };
      return { fulfillment: "needs_action", note: "نافذة واحدة · البتّ 45 يوماً · المباشرة 30 يوماً" };
    },
  },
  {
    number: 6,
    title: "الإعفاءات",
    text: "إعفاء ضريبي/رسوم 10 سنوات من بدء التشغيل (يزداد طردياً مع مشاركة المستثمر العراقي) + إعفاءات كمركية.",
    citation: "قانون 13/2006 م.15 · م.17",
    evaluate: (i) => {
      if (i.state === "completed") return { fulfillment: "met", note: "الإعفاءات سارية (10 سنوات من التشغيل)" };
      if (i.state === "withdrawn") return { fulfillment: "not_applicable", note: "لا إعفاءات (مسحوبة)" };
      return { fulfillment: "needs_action", note: "إعفاء 10 سنوات من التشغيل + إعفاءات كمركية" };
    },
  },
  {
    number: 7,
    title: "الالتزامات",
    text: "التزامات المستثمر (الإشعار · حسابات أصولية بتدقيق محاسب قانوني · دراسة الجدوى · سلامة البيئة · قوانين العمل) و≥50% عمالة محلية.",
    citation: "قانون 13/2006 م.14 · نظام 2/2009 م.30/أولاً",
    evaluate: (i) => {
      if (isProspective(i.state)) return { fulfillment: "needs_action", note: "متطلَّب مستقبلي: الالتزامات + ≥50% عمالة محلية" };
      if (i.state === "completed") return { fulfillment: "met", note: "الالتزامات مستوفاة (≥50% عمالة محلية)" };
      return { fulfillment: "needs_input", requiredInput: "بيان الالتزامات (نسبة العمالة المحلية ≥50% · الحسابات · الجدوى)" };
    },
  },
  {
    number: 8,
    title: "العقوبات",
    text: "إنذار بإزالة المخالفة ← تدرّج ← سحب الإجازة (ويُسحب فوراً عند المعلومات المضلّلة).",
    citation: "قانون 13/2006 م.28",
    evaluate: (i) =>
      i.state === "withdrawn"
        ? { fulfillment: "not_met", note: i.withdrawalReason ? `سحب الإجازة: ${i.withdrawalReason}` : "الإجازة مسحوبة (تدرّج العقوبات)" }
        : { fulfillment: "not_applicable", note: "لا مخالفة (إطار: إنذار ← تدرّج ← سحب)" },
  },
  {
    number: 9,
    title: "أجور الخدمة",
    text: `أجور الخدمة الثابتة: ${FEES}.`,
    citation: "تعليمات 1/2016",
    evaluate: (i) => {
      if (i.state === "completed") return { fulfillment: "met", note: "أجور الخدمة مستوفاة" };
      if (i.state === "withdrawn") return { fulfillment: "not_applicable", note: "الإجازة مسحوبة" };
      return { fulfillment: "needs_action", note: FEES };
    },
  },
];

// ===== ثانياً — معايير المستثمر/الشركة (6) =====
const INVESTOR_CRITERIA: Def[] = [
  {
    number: 1,
    title: "الصفة المؤهَّلة",
    text: "شخص (طبيعي/معنوي) راغب بالاستثمار بعد الحصول على الإجازة.",
    citation: "نظام 2/2009 م.1/أولاً",
    evaluate: (i) =>
      isProspective(i.state)
        ? { fulfillment: "needs_action", note: "متطلَّب مستقبلي: صفة المستثمر بعد الإجازة" }
        : { fulfillment: "met", note: "المستثمر صاحب صفة (إجازة قائمة)" },
  },
  {
    number: 2,
    title: "عتبة رأس المال",
    text: `رأس المال المستثمر ≥ ${fmt(CAPITAL_THRESHOLD_USD)} دولار.`,
    citation: "نظام 2/2009 م.1/ثالثاً",
    evaluate: (i) => {
      if (i.capitalUsd == null)
        return isProspective(i.state)
          ? { fulfillment: "needs_action", note: `متطلَّب مستقبلي: رأس مال ≥ ${fmt(CAPITAL_THRESHOLD_USD)} دولار` }
          : { fulfillment: "needs_input", requiredInput: "رأس المال (دولار)" };
      return i.capitalUsd >= CAPITAL_THRESHOLD_USD
        ? { fulfillment: "met", note: `رأس المال ${fmt(i.capitalUsd)} ≥ ${fmt(CAPITAL_THRESHOLD_USD)} دولار` }
        : { fulfillment: "not_met", note: `رأس المال ${fmt(i.capitalUsd)} < ${fmt(CAPITAL_THRESHOLD_USD)} دولار` };
    },
  },
  {
    number: 3,
    title: "القطاع غير المستثنى",
    text: "قطاع المشروع ليس من المجالات المستثناة في م.29.",
    citation: "قانون 13/2006 م.29 · نظام 2/2009 م.1/ثانياً",
    evaluate: (i) => {
      if (!i.sector) return { fulfillment: "needs_input", requiredInput: "القطاع" };
      return EXCLUDED_SECTORS.has(i.sector) ? { fulfillment: "not_met", note: "القطاع من مستثنيات م.29" } : { fulfillment: "met", note: "القطاع غير مستثنى" };
    },
  },
  {
    number: 4,
    title: "الكفاءة المالية",
    text: "تأييد كفاءة مالية من مصرف معتمد + خطة تمويل المشروع.",
    citation: "نظام 2/2009 م.25/ثانياً/ب/1 · قانون 13/2006 م.19/ثانياً/ب",
    evaluate: (i) =>
      isProspective(i.state)
        ? { fulfillment: "needs_action", note: "متطلَّب مستقبلي: تأييد كفاءة مالية + خطة تمويل" }
        : i.state === "completed"
          ? { fulfillment: "met", note: "الكفاءة المالية مستوفاة عند الإجازة" }
          : { fulfillment: "needs_input", requiredInput: "تأييد الكفاءة المالية + خطة تمويل المشروع" },
  },
  {
    number: 5,
    title: "سجلّ المشاريع المنفّذة",
    text: "بيان المشاريع التي نفّذها المستثمر.",
    citation: "نظام 2/2009 م.25/ثانياً/ب/2 · قانون 13/2006 م.19/ثانياً",
    evaluate: (i) =>
      isProspective(i.state)
        ? { fulfillment: "needs_action", note: "متطلَّب مستقبلي: بيان المشاريع المنفّذة" }
        : i.state === "completed"
          ? { fulfillment: "met", note: "سجلّ المشاريع مستوفى عند الإجازة" }
          : { fulfillment: "needs_input", requiredInput: "بيان المشاريع المنفّذة للمستثمر" },
  },
  {
    number: 6,
    title: "عتبة الموافقة العليا",
    text: `قيمة المشروع > ${fmt(CABINET_THRESHOLD_USD)} دولار ← موافقة مجلس الوزراء.`,
    citation: "قانون 13/2006 م.7/ب",
    evaluate: (i) => {
      if (i.projectValueUsd == null)
        return { fulfillment: "not_applicable", note: `شرطي: يلزم موافقة مجلس الوزراء إن تجاوزت القيمة ${fmt(CABINET_THRESHOLD_USD)} دولار`, conditional: true };
      return i.projectValueUsd > CABINET_THRESHOLD_USD
        ? { fulfillment: "needs_action", note: `القيمة ${fmt(i.projectValueUsd)} > ${fmt(CABINET_THRESHOLD_USD)} ← موافقة مجلس الوزراء`, conditional: true }
        : { fulfillment: "not_applicable", note: `القيمة ${fmt(i.projectValueUsd)} ≤ ${fmt(CABINET_THRESHOLD_USD)} (لا تلزم موافقة عليا)`, conditional: true };
    },
  },
];

function build(def: Def, i: ControlsInput): ControlItem {
  const out = def.evaluate(i);
  return { number: def.number, title: def.title, text: def.text, citation: def.citation, type: "mandatory", ...out };
}

function computeEligibility(state: ParcelState, items: ControlItem[]): { eligibility: Eligibility; label: string } {
  if (isProspective(state)) return { eligibility: "future", label: "إطار/تخطيطي — متطلّبات مستقبلية" };
  const mandatory = items.filter((it) => it.type === "mandatory");
  if (mandatory.some((it) => it.fulfillment === "not_met")) return { eligibility: "not_eligible", label: "غير مؤهّلة — وجود ضوابط غير مستوفاة" };
  if (mandatory.some((it) => it.fulfillment === "needs_input" || it.fulfillment === "needs_action"))
    return { eligibility: "needs_action", label: "تتطلّب إجراء/استكمال" };
  return { eligibility: "eligible", label: "مؤهّلة — الضوابط الملزمة مستوفاة" };
}

/** التقييم الحتمي الكامل (§ج.9) — رأس + قسمان (ضوابط/معايير) + ذيل (خلاصة + نواقص). */
export function evaluateControls(input: ControlsInput): ControlsResult {
  const projectControls = PROJECT_CONTROLS.map((d) => build(d, input));
  const investorCriteria = INVESTOR_CRITERIA.map((d) => build(d, input));
  const all = [...projectControls, ...investorCriteria];

  const missingInputs = Array.from(new Set(all.map((it) => it.requiredInput).filter((v): v is string => Boolean(v))));
  const gaps = all
    .filter((it) => it.fulfillment === "not_met" || it.fulfillment === "needs_input" || it.fulfillment === "needs_action")
    .map((it) => it.title);
  const { eligibility, label } = computeEligibility(input.state, all);

  return { projectControls, investorCriteria, missingInputs, eligibility, eligibilityLabel: label, gaps };
}
