// م5.3 · تجميعات التقارير — **دوالّ نقية حتمية** (الأرقام من البيانات الفعلية، لا تأليف، §هـ.5 التقارير الذكية).
import type { AssumedParcel, Company, License, Opportunity } from "@/types/entities";

export type ParcelKind = "opportunity" | "license" | "assumed";

// سجل موحّد للقطع (فرصة/رخصة/مفترضة) لأغراض التجميع.
export interface NormRecord {
  kind: ParcelKind;
  state: string; // announced | in-progress | completed | withdrawn | assumed
  sector: string | null;
  district: string | null;
  area: number; // م² (0 إن غير متوفّر)
  year: string | null; // سنة الإعلان/الإصدار (YYYY) إن توفّرت
  value: number; // رأس المال/القيمة (0 إن غير متوفّر)
}

export interface ReportFilters {
  state: string;
  sector: string;
  district: string;
  yearFrom: string;
  yearTo: string;
}

export const EMPTY_FILTERS: ReportFilters = { state: "", sector: "", district: "", yearFrom: "", yearTo: "" };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const yearOf = (d: string | null | undefined): string | null => {
  const s = (d ?? "").slice(0, 4);
  return /^\d{4}$/.test(s) ? s : null;
};

/** يوحّد الكيانات الثلاثة في سجلات قابلة للتجميع (الشركات تُعامَل منفصلة). */
export function normalize(opps: Opportunity[], lics: License[], assumed: AssumedParcel[]): NormRecord[] {
  const out: NormRecord[] = [];
  for (const o of opps)
    out.push({ kind: "opportunity", state: "announced", sector: o.sector, district: o.district, area: num(o.area_total_m2), year: yearOf(o.publish_date), value: 0 });
  for (const l of lics)
    out.push({ kind: "license", state: l.status, sector: l.sector, district: l.district, area: num(l.area_total_m2), year: yearOf(l.issue_date), value: num(l.capital) });
  for (const a of assumed)
    out.push({ kind: "assumed", state: "assumed", sector: a.sector, district: a.district, area: num(a.area_m2), year: null, value: num(a.value) });
  return out;
}

export function applyFilters(recs: NormRecord[], f: ReportFilters): NormRecord[] {
  return recs.filter(
    (r) =>
      (!f.state || r.state === f.state) &&
      (!f.sector || r.sector === f.sector) &&
      (!f.district || r.district === f.district) &&
      (!f.yearFrom || (r.year !== null && r.year >= f.yearFrom)) &&
      (!f.yearTo || (r.year !== null && r.year <= f.yearTo)),
  );
}

export interface Totals {
  count: number;
  area: number;
  value: number;
  byState: Record<string, number>;
}

const STATES = ["announced", "in-progress", "completed", "withdrawn", "assumed"] as const;

export function totals(recs: NormRecord[]): Totals {
  const byState: Record<string, number> = Object.fromEntries(STATES.map((s) => [s, 0]));
  let area = 0;
  let value = 0;
  for (const r of recs) {
    byState[r.state] = (byState[r.state] ?? 0) + 1;
    area += r.area;
    value += r.value;
  }
  return { count: recs.length, area, value, byState };
}

// تجميع عددي عام (مفتاح ← عدد + مساحة)، مرتّب تنازلياً بالعدد.
function groupBy(recs: NormRecord[], key: (r: NormRecord) => string | null): { key: string; count: number; area: number }[] {
  const map = new Map<string, { count: number; area: number }>();
  for (const r of recs) {
    const k = key(r);
    if (!k) continue;
    const cur = map.get(k) ?? { count: 0, area: 0 };
    cur.count += 1;
    cur.area += r.area;
    map.set(k, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count);
}

export const bySector = (recs: NormRecord[]) => groupBy(recs, (r) => r.sector);
export const byDistrict = (recs: NormRecord[]) => groupBy(recs, (r) => r.district);

/** توزيع الحالات (للرسم الدائري) — يحفظ ترتيب الحالات الخمس. */
export function byState(recs: NormRecord[]): { state: string; count: number }[] {
  const t = totals(recs);
  return STATES.map((s) => ({ state: s, count: t.byState[s] ?? 0 })).filter((x) => x.count > 0);
}

/** الاتجاه الزمني (سنة ← فرص/رخص) — مرتّب تصاعدياً بالسنة. */
export function byYear(recs: NormRecord[]): { year: string; opportunities: number; licenses: number }[] {
  const map = new Map<string, { opportunities: number; licenses: number }>();
  for (const r of recs) {
    if (!r.year) continue;
    const cur = map.get(r.year) ?? { opportunities: 0, licenses: 0 };
    if (r.kind === "opportunity") cur.opportunities += 1;
    else if (r.kind === "license") cur.licenses += 1;
    map.set(r.year, cur);
  }
  return [...map.entries()].map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year.localeCompare(b.year));
}

/** توزيع الشركات حسب القطاع (مرتّب تنازلياً). */
export function companiesBySector(companies: Company[]): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const c of companies) {
    if (!c.sector) continue;
    map.set(c.sector, (map.get(c.sector) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
