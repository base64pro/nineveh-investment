// م6.1 · باني محتوى تقرير القطعة (HTML) — خادمي/نقي. بيانات القطعة وفق حالتها + الفحص القانوني **باستشهاد**.
// §ح: أرقام لاتينية · «غير متوفّر» للناقص · **لا معرّف داخلي** · لا كشف تحقّق.
import { evaluateControls, type ControlItem, type ControlsInput, type Fulfillment } from "@/features/parcels/legal/controls-engine";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ParcelState } from "@/types/entities";
import { formatArea, formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const STATE_COLOR: Record<string, string> = { announced: "#C7A24E", "in-progress": "#5775A8", completed: "#5E977A", withdrawn: "#B5616A", assumed: "#8B6FB0" };
const STATE_LABEL: Record<string, string> = { announced: "معلَنة", "in-progress": "قيد الإنجاز", completed: "منجزة", withdrawn: "مسحوبة", assumed: "مفترضة" };
const FLABEL: Record<Fulfillment, string> = { met: "مستوفٍ", not_met: "غير مستوفٍ", needs_action: "يتطلّب إجراء", needs_input: "مُدخل مطلوب", not_applicable: "غير منطبق" };

function parcelState(kind: ParcelKind, e: Record<string, unknown>): ParcelState {
  if (kind === "opportunity") return "announced";
  if (kind === "license") return (str(e.status) as ParcelState | null) ?? "in-progress";
  return (str(e.state) as ParcelState | null) ?? "assumed";
}
function toInput(kind: ParcelKind, e: Record<string, unknown>): ControlsInput {
  const capitalUsd = kind === "license" ? num(e.capital) : kind === "assumed" ? num(e.value) : null;
  return {
    state: parcelState(kind, e),
    sector: str(e.sector),
    capitalUsd,
    projectValueUsd: capitalUsd,
    landRight: str(e.land_right),
    nationality: str(e.investor_nationality),
    owner: str(e.owner),
    withdrawalReason: str(e.withdrawal_reason),
  };
}

const NUMERIC = new Set(["capital", "value", "area_m2", "area_total_m2", "area_olk", "lease_rate", "term_years", "doc_fee"]);
const DATEK = new Set(["publish_date", "deadline", "issue_date", "completion_date", "withdrawal_date", "renewal_date"]);
function fmt(e: Record<string, unknown>, key: string): string {
  const v = e[key];
  if (key === "sector") return sectorLabel(typeof v === "string" ? v : null);
  if (DATEK.has(key)) return formatDate(typeof v === "string" ? v : null);
  if (NUMERIC.has(key)) return typeof v === "number" ? formatNumber(v) : NOT_AVAILABLE;
  return orNA(v);
}

type Field = { key: string; label: string };
const LOCATION: Field[] = [
  { key: "parcel_no", label: "رقم القطعة" },
  { key: "muqataa_no", label: "رقم المقاطعة" },
  { key: "muqataa_name", label: "اسم المقاطعة" },
  { key: "district", label: "القضاء" },
  { key: "subdistrict", label: "الناحية" },
  { key: "neighborhood", label: "الحي/المنطقة" },
  { key: "owner", label: "العائدية/المالك" },
];
const CLASSIFICATION: Field[] = [
  { key: "sector", label: "القطاع" },
  { key: "land_right", label: "نوع الحقّ" },
  { key: "project_type", label: "نوع المشروع" },
];
const TYPE_FIELDS: Record<ParcelKind, Field[]> = {
  opportunity: [
    { key: "announcement_number", label: "رقم الإعلان" },
    { key: "announcement_type", label: "نوع الإعلان" },
    { key: "publish_date", label: "تاريخ النشر" },
    { key: "deadline", label: "آخر موعد" },
  ],
  license: [
    { key: "license_number", label: "رقم الرخصة" },
    { key: "investor_name", label: "المستثمر" },
    { key: "investor_nationality", label: "جنسية المستثمر" },
    { key: "capital", label: "رأس المال" },
    { key: "issue_date", label: "تاريخ الإصدار" },
    { key: "completion_date", label: "تاريخ الإنجاز" },
    { key: "withdrawal_reason", label: "سبب السحب" },
  ],
  assumed: [
    { key: "value", label: "القيمة" },
    { key: "annexation_plan", label: "خطة الضمّ" },
    { key: "legal_status", label: "الوضع القانوني" },
  ],
};

function sectionHtml(title: string, fields: Field[], e: Record<string, unknown>): string {
  const rows = fields.map((f) => `<div class="row"><span class="k">${esc(f.label)}</span><span class="v">${esc(fmt(e, f.key))}</span></div>`).join("");
  return `<section><h2>${esc(title)}</h2><div class="grid">${rows}</div></section>`;
}

function controlsHtml(items: ControlItem[]): string {
  return items
    .map(
      (it) =>
        `<div class="ctrl"><div class="top"><span class="t">${esc(it.title)}</span><span class="tag ${it.type === "mandatory" ? "mandatory" : "encouraged"}">${it.type === "mandatory" ? "إلزامي" : "مشجّع"}</span></div><div class="cite">${esc(it.citation)} · <span class="${it.fulfillment}">${FLABEL[it.fulfillment]}</span></div>${it.note ? `<div class="note">${esc(it.note)}</div>` : ""}</div>`,
    )
    .join("");
}

/** يبني محتوى تقرير القطعة (عنوان + بيانات + فحص قانوني). */
export function parcelReportBody(kind: ParcelKind, entity: Record<string, unknown>): { title: string; html: string } {
  const state = parcelState(kind, entity);
  const name = orNA(entity[kind === "assumed" ? "name" : "title"] ?? entity.parcel_no);
  const areaKey = kind === "assumed" ? "area_m2" : "area_total_m2";
  const r = evaluateControls(toInput(kind, entity));

  const head = `<div class="title"><h1>${esc(name)}</h1><div class="meta"><span class="badge" style="background:${STATE_COLOR[state]}">${STATE_LABEL[state]}</span><span>${esc(sectorLabel(str(entity.sector)))}</span><span>${esc(formatArea(num(entity[areaKey])))}</span></div></div>`;
  const summary = `<section><h2>خلاصة الفحص القانوني (§ج.9)</h2><p style="font-weight:600;margin:0">خلاصة الأهلية: ${esc(r.eligibilityLabel)}</p>${r.gaps.length ? `<div class="gaps">أبرز النواقص: ${esc(r.gaps.join(" · "))}</div>` : ""}</section>`;
  const project = `<section><h2>أولاً — ضوابط المشروع/الأرض</h2>${controlsHtml(r.projectControls)}</section>`;
  const investor = `<section><h2>ثانياً — معايير المستثمر/الشركة</h2>${controlsHtml(r.investorCriteria)}</section>`;
  const notes = entity.notes ? `<section><h2>ملاحظات</h2><div style="white-space:pre-wrap;font-size:11px">${esc(orNA(entity.notes))}</div></section>` : "";

  const html = head + sectionHtml("الهوية والموقع", LOCATION, entity) + sectionHtml("التصنيف", CLASSIFICATION, entity) + sectionHtml("تفاصيل النوع", TYPE_FIELDS[kind], entity) + summary + project + investor + notes;
  return { title: `تقرير قطعة — ${name}`, html };
}
