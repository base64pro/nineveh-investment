import { describe, expect, it } from "vitest";
import { tableReportBody } from "./table-report";
import { answerToHtml, consultationReportBody } from "./consultation-report";

describe("tableReportBody (حتمي)", () => {
  it("يبني جدولاً بعناوين وصفوف ويُهرّب HTML", () => {
    const { title, html } = tableReportBody({
      title: "تقرير <اختبار>",
      subtitle: "2 سجلّ",
      columns: [
        { key: "a", label: "العمود أ" },
        { key: "b", label: "العمود ب" },
      ],
      rows: [
        { a: "قيمة1", b: "<script>" },
        { a: "قيمة2", b: "" },
      ],
    });
    expect(title).toBe("تقرير <اختبار>");
    expect(html).toContain("تقرير &lt;اختبار&gt;");
    expect(html).toContain("<th>العمود أ</th>");
    expect(html).toContain("&lt;script&gt;"); // مهرّب — لا حقن
    expect(html).toContain("2 سجلّ");
  });

  it("الخلية الغائبة تُعرَض فارغة (لا تأليف)", () => {
    const { html } = tableReportBody({ title: "ت", columns: [{ key: "x", label: "س" }], rows: [{}] });
    expect(html).toContain("<td></td>");
  });
});

describe("answerToHtml (تحويل حرفي)", () => {
  it("يحوّل العناوين والنقاط والعريض دون تغيير النصّ", () => {
    const html = answerToHtml("### العنوان\n- بند **مهم**\n- بند ثانٍ\n\nفقرة باستشهاد قانون 13/2006 م.29");
    expect(html).toContain("<h3>العنوان</h3>");
    expect(html).toContain("<li>بند <strong>مهم</strong></li>");
    expect(html).toContain("<p>فقرة باستشهاد قانون 13/2006 م.29</p>");
  });

  it("يُهرّب أي HTML داخل النص", () => {
    expect(answerToHtml("سطر <b>خام</b>")).toContain("&lt;b&gt;خام&lt;/b&gt;");
  });
});

describe("consultationReportBody", () => {
  it("يبني سؤالاً وإجابة بعنوان افتراضي عند الغياب", () => {
    const { title, html } = consultationReportBody({ title: null, consulted_at: "2026-06-01", question: "س؟", answer: "ج." });
    expect(title).toBe("استشارة قانونية");
    expect(html).toContain("السؤال");
    expect(html).toContain("س؟");
    expect(html).toContain("<p>ج.</p>");
  });
});
