import { describe, it, expect } from "vitest";
import { formatNumber, toLatinDigits, NOT_AVAILABLE } from "./format";

describe("طبقة العرض — الأرقام لاتينية دائماً (§ح.3)", () => {
  it("ينسّق الأعداد بأرقام لاتينية وفواصل آلاف", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(491)).toBe("491");
  });

  it("يحوّل الأرقام العربية-الهندية إلى لاتينية", () => {
    expect(toLatinDigits("٤٩١")).toBe("491");
    expect(toLatinDigits("١٤٦")).toBe("146");
  });

  it("يحوّل الأرقام الفارسية إلى لاتينية", () => {
    expect(toLatinDigits("۲۷")).toBe("27");
  });

  it("يترك الأرقام اللاتينية كما هي", () => {
    expect(toLatinDigits("125 سجلاً")).toBe("125 سجلاً");
  });

  it("ثابت «غير متوفّر» مضبوط (§ح.4)", () => {
    expect(NOT_AVAILABLE).toBe("غير متوفّر");
  });
});
