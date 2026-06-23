// م6.1 · باني محتوى تقرير القطعة (HTML) — خادمي/نقي. بيانات القطعة وفق حالتها + الفحص القانوني **باستشهاد**.
// §ح: أرقام لاتينية · «غير متوفّر» للناقص · **لا معرّف داخلي** · لا كشف تحقّق.
import { evaluateControls, type ControlItem, type Fulfillment } from "@/features/parcels/legal/controls-engine";
import { parcelStateOf, toControlsInput } from "@/features/parcels/legal/parcel-input";
import { domainLabel } from "@/features/criteria/fields";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import { formatArea, formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import { answerToHtml } from "./consultation-report";

// نطاقات التقرير (§هـ.4): قطعة / تاب بعينه / شامل.
export type ReportScope = "parcel" | "controls" | "recommendations" | "criteria" | "full";

export interface PinnedInsights {
  recommendations: string | null;
  recommendations_at: string | null;
  criteria: { name: string; domain: string; purpose: string; items: { description: string; basis: string; weight: string; support_indicator: string }[] } | null;
  criteria_at: string | null;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const STATE_COLOR: Record<string, string> = { announced: "#C7A24E", "in-progress": "#5775A8", completed: "#5E977A", withdrawn: "#B5616A", assumed: "#22C3F3" };
const STATE_LABEL: Record<string, string> = { announced: "معلَنة", "in-progress": "قيد الإنجاز", completed: "منجزة", withdrawn: "مسحوبة", assumed: "مفترضة" };
const FLABEL: Record<Fulfillment, string> = { met: "مستوفٍ", not_met: "غير مستوفٍ", needs_action: "يتطلّب إجراء", needs_input: "مُدخل مطلوب", not_applicable: "غير منطبق" };

// مدخل المحرّك وحالة القطعة من الوحدة الموحَّدة parcel-input (لا نسخ محلية).

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

const IJTIHAD = `<div style="border:1px solid #9dbf9d;background:#f0f6f0;border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:10.5px;font-weight:600;color:#3f7a5c">🟩 محتوى مولّد بالذكاء — رأي استنتاجي غير مُلزِم؛ الضوابط الإلزامية في قسم الفحص القانوني.</div>`;

function recommendationsHtml(ins: PinnedInsights | undefined): string {
  if (!ins?.recommendations) {
    return `<section><h2>التوصيات الذكية 🟩</h2><p style="margin:0;font-size:11px;color:#6b7a99">${NOT_AVAILABLE} — لم تُولَّد توصيات لهذه القطعة بعد.</p></section>`;
  }
  return `<section class="qa-a"><h2>التوصيات الذكية 🟩</h2>${IJTIHAD}<div style="font-size:10px;color:#6b7a99;margin-bottom:6px">ثُبِّتت بتاريخ ${esc(formatDate(ins.recommendations_at))}</div>${answerToHtml(ins.recommendations)}</section>`;
}

function criteriaHtml(ins: PinnedInsights | undefined): string {
  const d = ins?.criteria;
  if (!d) {
    return `<section><h2>المعايير المولّدة 🟩</h2><p style="margin:0;font-size:11px;color:#6b7a99">${NOT_AVAILABLE} — لم تُولَّد معايير لهذه القطعة بعد.</p></section>`;
  }
  const items = d.items
    .map(
      (it, i) =>
        `<div class="ctrl"><div class="top"><span class="t">${i + 1}. ${esc(it.description)}</span>${it.weight ? `<span class="tag encouraged">الوزن: ${esc(it.weight)}</span>` : ""}</div>${it.basis ? `<div class="note">الأساس: ${esc(it.basis)}</div>` : ""}${it.support_indicator ? `<div class="note">مؤشّر الدعم: ${esc(it.support_indicator)}</div>` : ""}</div>`,
    )
    .join("");
  return `<section><h2>المعايير المولّدة 🟩 — ${esc(d.name)} (${esc(domainLabel(d.domain) || d.domain)})</h2>${IJTIHAD}${d.purpose ? `<div style="font-size:10.5px;color:#51607a;margin-bottom:6px">${esc(d.purpose)}</div>` : ""}<div style="font-size:10px;color:#6b7a99;margin-bottom:6px">ثُبِّتت بتاريخ ${esc(formatDate(ins?.criteria_at ?? null))}</div>${items}</section>`;
}

const SCOPE_TITLE: Record<ReportScope, string> = {
  parcel: "تقرير قطعة",
  controls: "الضوابط والمعايير القانونية",
  recommendations: "التوصيات الذكية",
  criteria: "المعايير المولّدة",
  full: "تقرير شامل",
};

/** يبني محتوى تقرير القطعة وفق النطاق (§هـ.4: قطعة / تاب / شامل) — الناقص «غير متوفّر» لا يُختلَق. */
export function parcelReportBody(
  kind: ParcelKind,
  entity: Record<string, unknown>,
  opts?: { scope?: ReportScope; insights?: PinnedInsights },
): { title: string; html: string } {
  const scope: ReportScope = opts?.scope ?? "full";
  const state = parcelStateOf(kind, entity);
  const name = orNA(entity[kind === "assumed" ? "name" : "title"] ?? entity.parcel_no);
  const areaKey = kind === "assumed" ? "area_m2" : "area_total_m2";

  const head = `<div class="title"><h1>${esc(`${SCOPE_TITLE[scope]} — ${name}`)}</h1><div class="meta"><span class="badge" style="background:${STATE_COLOR[state]}">${STATE_LABEL[state]}</span><span>${esc(sectorLabel(str(entity.sector)))}</span><span>${esc(formatArea(num(entity[areaKey])))}</span></div></div>`;

  const parts: string[] = [head];
  if (scope === "parcel" || scope === "full") {
    parts.push(sectionHtml("الهوية والموقع", LOCATION, entity), sectionHtml("التصنيف", CLASSIFICATION, entity), sectionHtml("تفاصيل النوع", TYPE_FIELDS[kind], entity));
    if (entity.notes) parts.push(`<section><h2>ملاحظات</h2><div style="white-space:pre-wrap;font-size:11px">${esc(orNA(entity.notes))}</div></section>`);
  }
  if (scope === "controls" || scope === "full") {
    const r = evaluateControls(toControlsInput(kind, entity));
    parts.push(
      `<section><h2>خلاصة الفحص القانوني (§ج.9)</h2><p style="font-weight:600;margin:0">خلاصة الأهلية: ${esc(r.eligibilityLabel)}</p>${r.gaps.length ? `<div class="gaps">أبرز النواقص: ${esc(r.gaps.join(" · "))}</div>` : ""}</section>`,
      `<section><h2>أولاً — ضوابط المشروع/الأرض</h2>${controlsHtml(r.projectControls)}</section>`,
      `<section><h2>ثانياً — معايير المستثمر/الشركة</h2>${controlsHtml(r.investorCriteria)}</section>`,
    );
  }
  if (scope === "recommendations" || scope === "full") parts.push(recommendationsHtml(opts?.insights));
  if (scope === "criteria" || scope === "full") parts.push(criteriaHtml(opts?.insights));

  return { title: `${SCOPE_TITLE[scope]} — ${name}`, html: parts.join("") };
}
