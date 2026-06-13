import { describe, expect, it } from "vitest";
import { normalizeLicenseStatusForSave } from "./fields";

// إصلاح «انقلاب الحالة عند الحفظ»: التحديث بلا حالة يجب ألّا يمسّ الحالة المخزّنة إطلاقاً.
describe("normalizeLicenseStatusForSave", () => {
  it("تحديث بلا حالة ← يحذف المفتاح (لا مساس بالمخزّن)", () => {
    const out = normalizeLicenseStatusForSave({ title: "م", status: null }, true);
    expect("status" in out).toBe(false);
    expect(out.title).toBe("م");
  });

  it("تحديث بحالة صريحة ← تمرّ كما هي", () => {
    const out = normalizeLicenseStatusForSave({ status: "completed" }, true);
    expect(out.status).toBe("completed");
  });

  it("إنشاء بلا حالة ← الافتراضي «قيد الإنجاز» (العمود إلزامي)", () => {
    const out = normalizeLicenseStatusForSave({ title: "جديد" }, false);
    expect(out.status).toBe("in-progress");
  });

  it("إنشاء بحالة صريحة ← تُحترم", () => {
    const out = normalizeLicenseStatusForSave({ status: "withdrawn" }, false);
    expect(out.status).toBe("withdrawn");
  });

  it("لا يعدّل كائن المدخلات (نقاء)", () => {
    const input: Record<string, unknown> = { status: "" };
    void normalizeLicenseStatusForSave(input, true);
    expect(input.status).toBe("");
  });
});
