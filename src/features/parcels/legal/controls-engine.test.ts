import { describe, it, expect } from "vitest";
import { evaluateControls, CAPITAL_THRESHOLD_USD, CABINET_THRESHOLD_USD, type ControlsInput, type ControlItem } from "./controls-engine";

// قطعة قيد الإنجاز نموذجية (مستثمر عراقي · رأس مال كافٍ · قطاع صناعي).
const base: ControlsInput = {
  state: "in-progress",
  sector: "industrial",
  capitalUsd: 300_000,
  projectValueUsd: 1_000_000,
  landRight: "تخصيص",
  nationality: "عراقي",
  owner: "الدولة",
  withdrawalReason: null,
};
const inp = (over: Partial<ControlsInput>): ControlsInput => ({ ...base, ...over });
const ctrl = (i: ControlsInput, n: number): ControlItem => evaluateControls(i).projectControls.find((c) => c.number === n)!;
const crit = (i: ControlsInput, n: number): ControlItem => evaluateControls(i).investorCriteria.find((c) => c.number === n)!;

describe("محرّك الضوابط §ج.9 — البنية والاستشهاد", () => {
  it("9 ضوابط مشروع + 6 معايير مستثمر، كلّها إلزامية وباستشهاد", () => {
    const r = evaluateControls(base);
    expect(r.projectControls).toHaveLength(9);
    expect(r.investorCriteria).toHaveLength(6);
    for (const it of [...r.projectControls, ...r.investorCriteria]) {
      expect(it.type).toBe("mandatory");
      expect(it.citation.length).toBeGreaterThan(0);
      expect(it.title.length).toBeGreaterThan(0);
    }
  });

  it("الاستشهادات مطابقة لنصّ §ج.9 (لا معرّف داخلي)", () => {
    expect(ctrl(base, 1).citation).toContain("قانون 13/2006 م.29");
    expect(ctrl(base, 9).citation).toContain("تعليمات 1/2016");
    expect(crit(base, 2).citation).toContain("نظام 2/2009 م.1/ثالثاً");
    expect(crit(base, 6).citation).toContain("قانون 13/2006 م.7/ب");
  });
});

describe("ضوابط المشروع/الأرض (9)", () => {
  it("1) الجدوى والاستثناء: قطاع معروف غير مستثنى ← مستوفٍ؛ بلا قطاع ← مُدخل مطلوب", () => {
    expect(ctrl(base, 1).fulfillment).toBe("met");
    expect(ctrl(inp({ sector: null }), 1).fulfillment).toBe("needs_input");
    expect(ctrl(inp({ sector: null }), 1).requiredInput).toBe("القطاع");
  });

  it("2) حقّ الأرض: معلَنة ← يتطلّب إجراء؛ سكني ← مستوفٍ؛ صناعي+أجنبي ← يتطلّب إجراء؛ بلا جنسية ← مُدخل مطلوب", () => {
    expect(ctrl(inp({ state: "announced" }), 2).fulfillment).toBe("needs_action");
    expect(ctrl(inp({ sector: "housing" }), 2).fulfillment).toBe("met");
    expect(ctrl(inp({ sector: "industrial", nationality: "أجنبي" }), 2).fulfillment).toBe("needs_action");
    expect(ctrl(inp({ nationality: null }), 2).fulfillment).toBe("needs_input");
  });

  it("3) البدل المالي: يتطلّب إجراء مع نسبة القطاع؛ منجزة ← مستوفٍ", () => {
    const c = ctrl(inp({ sector: "tourism" }), 3);
    expect(c.fulfillment).toBe("needs_action");
    expect(c.note).toContain("10%");
    expect(ctrl(inp({ state: "completed" }), 3).fulfillment).toBe("met");
  });

  it("4) التخصيص والتسليم: منجزة ← مستوفٍ؛ مسحوبة ← غير منطبق؛ قيد ← يتطلّب إجراء", () => {
    expect(ctrl(inp({ state: "completed" }), 4).fulfillment).toBe("met");
    expect(ctrl(inp({ state: "withdrawn" }), 4).fulfillment).toBe("not_applicable");
    expect(ctrl(base, 4).fulfillment).toBe("needs_action");
  });

  it("5) إجراءات الإجازة: منجزة ← مستوفٍ؛ مسحوبة ← غير منطبق", () => {
    expect(ctrl(inp({ state: "completed" }), 5).fulfillment).toBe("met");
    expect(ctrl(inp({ state: "withdrawn" }), 5).fulfillment).toBe("not_applicable");
  });

  it("6) الإعفاءات: منجزة ← مستوفٍ (سارية)؛ مسحوبة ← غير منطبق", () => {
    expect(ctrl(inp({ state: "completed" }), 6).fulfillment).toBe("met");
    expect(ctrl(inp({ state: "withdrawn" }), 6).fulfillment).toBe("not_applicable");
  });

  it("7) الالتزامات: قيد ← مُدخل مطلوب؛ منجزة ← مستوفٍ؛ معلَنة ← يتطلّب إجراء", () => {
    expect(ctrl(base, 7).fulfillment).toBe("needs_input");
    expect(ctrl(inp({ state: "completed" }), 7).fulfillment).toBe("met");
    expect(ctrl(inp({ state: "announced" }), 7).fulfillment).toBe("needs_action");
  });

  it("8) العقوبات: مسحوبة ← غير مستوفٍ (بالسبب)؛ غيرها ← غير منطبق", () => {
    const w = ctrl(inp({ state: "withdrawn", withdrawalReason: "إخلال بالالتزامات" }), 8);
    expect(w.fulfillment).toBe("not_met");
    expect(w.note).toContain("إخلال بالالتزامات");
    expect(ctrl(base, 8).fulfillment).toBe("not_applicable");
  });

  it("9) أجور الخدمة: قيد ← يتطلّب إجراء (بالمبالغ اللاتينية)؛ منجزة ← مستوفٍ", () => {
    const c = ctrl(base, 9);
    expect(c.fulfillment).toBe("needs_action");
    expect(c.note).toContain("1,000,000");
    expect(ctrl(inp({ state: "completed" }), 9).fulfillment).toBe("met");
  });
});

describe("معايير المستثمر/الشركة (6)", () => {
  it("1) الصفة المؤهَّلة: معلَنة ← يتطلّب إجراء (مستقبلي)؛ قيد ← مستوفٍ", () => {
    expect(crit(inp({ state: "announced" }), 1).fulfillment).toBe("needs_action");
    expect(crit(base, 1).fulfillment).toBe("met");
  });

  it("2) عتبة رأس المال: ≥250 ألف ← مستوفٍ؛ <250 ألف ← غير مستوفٍ؛ بلا قيمة (قيد) ← مُدخل مطلوب", () => {
    expect(crit(inp({ capitalUsd: CAPITAL_THRESHOLD_USD }), 2).fulfillment).toBe("met");
    expect(crit(inp({ capitalUsd: 249_999 }), 2).fulfillment).toBe("not_met");
    expect(crit(inp({ capitalUsd: null }), 2).fulfillment).toBe("needs_input");
    expect(crit(inp({ capitalUsd: null, state: "announced" }), 2).fulfillment).toBe("needs_action");
  });

  it("3) القطاع غير المستثنى: معروف ← مستوفٍ؛ بلا قطاع ← مُدخل مطلوب", () => {
    expect(crit(base, 3).fulfillment).toBe("met");
    expect(crit(inp({ sector: null }), 3).fulfillment).toBe("needs_input");
  });

  it("4) الكفاءة المالية: قيد ← مُدخل مطلوب؛ منجزة ← مستوفٍ؛ معلَنة ← يتطلّب إجراء", () => {
    expect(crit(base, 4).fulfillment).toBe("needs_input");
    expect(crit(inp({ state: "completed" }), 4).fulfillment).toBe("met");
    expect(crit(inp({ state: "announced" }), 4).fulfillment).toBe("needs_action");
  });

  it("5) سجلّ المشاريع: قيد ← مُدخل مطلوب؛ منجزة ← مستوفٍ", () => {
    expect(crit(base, 5).fulfillment).toBe("needs_input");
    expect(crit(inp({ state: "completed" }), 5).fulfillment).toBe("met");
  });

  it("6) عتبة الموافقة العليا: >250 مليون ← يتطلّب إجراء (شرطي)؛ ≤250 مليون ← غير منطبق؛ بلا قيمة ← غير منطبق", () => {
    const over = crit(inp({ projectValueUsd: CABINET_THRESHOLD_USD + 1 }), 6);
    expect(over.fulfillment).toBe("needs_action");
    expect(over.conditional).toBe(true);
    expect(crit(inp({ projectValueUsd: CABINET_THRESHOLD_USD }), 6).fulfillment).toBe("not_applicable");
    expect(crit(inp({ projectValueUsd: null }), 6).fulfillment).toBe("not_applicable");
  });
});

describe("خلاصة الأهلية + التكييف بالحالات الخمس", () => {
  it("معلَنة/مفترضة ← إطار مستقبلي (future)", () => {
    expect(evaluateControls(inp({ state: "announced" })).eligibility).toBe("future");
    expect(evaluateControls(inp({ state: "assumed" })).eligibility).toBe("future");
  });

  it("قيد الإنجاز ← يتطلّب إجراء (مدخلات توثيقية ناقصة)", () => {
    expect(evaluateControls(base).eligibility).toBe("needs_action");
  });

  it("منجزة مكتملة البيانات ← مؤهّلة", () => {
    expect(evaluateControls(inp({ state: "completed" })).eligibility).toBe("eligible");
  });

  it("رأس مال دون العتبة ← غير مؤهّلة (ضابط إلزامي غير مستوفٍ)", () => {
    const r = evaluateControls(inp({ state: "completed", capitalUsd: 100_000 }));
    expect(r.eligibility).toBe("not_eligible");
    expect(r.gaps).toContain("عتبة رأس المال");
  });

  it("مسحوبة ← غير مؤهّلة (العقوبات غير مستوفاة)", () => {
    expect(evaluateControls(inp({ state: "withdrawn" })).eligibility).toBe("not_eligible");
  });

  it("المدخلات الناقصة الحرجة تُرصد ولا تُفترَض (قيد بلا قطاع/جنسية)", () => {
    const r = evaluateControls(inp({ sector: null, nationality: null, capitalUsd: null }));
    expect(r.missingInputs).toContain("القطاع");
    expect(r.missingInputs).toContain("جنسية المستثمر");
    expect(r.missingInputs).toContain("رأس المال (دولار)");
  });
});
