import { describe, expect, it } from "vitest";
import type { AssumedParcel, License, Opportunity } from "@/types/entities";
import { applyFilters, bySector, byState, byYear, EMPTY_FILTERS, normalize, totals } from "./report-aggregations";

const opp = (o: Partial<Opportunity>): Opportunity =>
  ({ sector: null, district: null, area_total_m2: 0, publish_date: null, ...o }) as unknown as Opportunity;
const lic = (o: Partial<License>): License =>
  ({ sector: null, district: null, area_total_m2: 0, status: "in-progress", issue_date: null, capital: 0, ...o }) as unknown as License;
const asm = (o: Partial<AssumedParcel>): AssumedParcel =>
  ({ sector: null, district: null, area_m2: 0, value: 0, state: "assumed", ...o }) as unknown as AssumedParcel;

describe("report-aggregations (حتمي)", () => {
  it("normalize يوحّد الأنواع الثلاثة بحالاتها وسنواتها", () => {
    const recs = normalize(
      [opp({ sector: "industrial", area_total_m2: 100, publish_date: "2025-03-01" })],
      [lic({ status: "completed", area_total_m2: 50, issue_date: "2024-01-01", capital: 300000 })],
      [asm({ sector: "housing", area_m2: 20 })],
    );
    expect(recs).toHaveLength(3);
    expect(recs[0]).toMatchObject({ kind: "opportunity", state: "announced", year: "2025", area: 100 });
    expect(recs[1]).toMatchObject({ kind: "license", state: "completed", year: "2024", value: 300000 });
    expect(recs[2]).toMatchObject({ kind: "assumed", state: "assumed", year: null });
  });

  it("لا عدّ مزدوج: فرصة على نفس قطعة رخصة تُحسب مساحتها مرّة واحدة (لدى الرخصة)", () => {
    const recs = normalize(
      [opp({ parcel_no: "65", muqataa_no: "12", area_total_m2: 5000 }), opp({ parcel_no: "99", area_total_m2: 300 })],
      [lic({ parcel_no: "65", muqataa_no: "12", area_total_m2: 5000 })],
      [],
    );
    const t = totals(recs);
    expect(t.count).toBe(3); // السجلات تبقى ثلاثة (الفرصة لا تختفي)
    expect(t.area).toBe(5300); // 5000 (رخصة) + 300 (فرصة مستقلة) — لا 10300
  });

  it("totals يجمع المساحة/القيمة ويعدّ الحالات", () => {
    const recs = normalize([opp({ area_total_m2: 100 })], [lic({ status: "completed", area_total_m2: 50, capital: 300000 })], []);
    const t = totals(recs);
    expect(t).toMatchObject({ count: 2, area: 150, value: 300000 });
    expect(t.byState.announced).toBe(1);
    expect(t.byState.completed).toBe(1);
  });

  it("applyFilters يفلتر بالحالة/القطاع/السنة", () => {
    const recs = normalize(
      [opp({ sector: "industrial", publish_date: "2025-01-01" }), opp({ sector: "housing", publish_date: "2023-01-01" })],
      [],
      [],
    );
    expect(applyFilters(recs, { ...EMPTY_FILTERS, sector: "industrial" })).toHaveLength(1);
    expect(applyFilters(recs, { ...EMPTY_FILTERS, state: "announced" })).toHaveLength(2);
    expect(applyFilters(recs, { ...EMPTY_FILTERS, yearFrom: "2024" })).toHaveLength(1);
  });

  it("bySector يجمع ويرتّب تنازلياً بالعدد", () => {
    const recs = normalize([opp({ sector: "industrial" }), opp({ sector: "industrial" }), opp({ sector: "housing" })], [], []);
    const g = bySector(recs);
    expect(g[0]).toMatchObject({ key: "industrial", count: 2 });
    expect(g[1]).toMatchObject({ key: "housing", count: 1 });
  });

  it("byState يحفظ ترتيب الحالات الخمس ويُسقِط الأصفار", () => {
    const recs = normalize([opp({})], [lic({ status: "withdrawn" })], []);
    expect(byState(recs).map((x) => x.state)).toEqual(["announced", "withdrawn"]);
  });

  it("byYear يفصل الفرص عن الرخص ويرتّب تصاعدياً", () => {
    const recs = normalize([opp({ publish_date: "2025-01-01" })], [lic({ issue_date: "2024-01-01" }), lic({ issue_date: "2025-01-01" })], []);
    expect(byYear(recs)).toEqual([
      { year: "2024", opportunities: 0, licenses: 1 },
      { year: "2025", opportunities: 1, licenses: 1 },
    ]);
  });
});
