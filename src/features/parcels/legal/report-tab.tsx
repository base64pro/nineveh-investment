"use client";

// التاب 4 — التقرير (عرض داخلي غنيّ §هـ.4). يعرض بيانات القطعة (وفق حالتها) + ملخّص الفحص القانوني.
// تصدير PDF أنيق موحّد الهوية = م6 (طبقة المخرجات §ح). لا كشف تحقّق داخلي.

import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/features/parcels/state-badge";
import { formatArea, formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ParcelState } from "@/types/entities";
import { evaluateControls, type Fulfillment } from "./controls-engine";
import { toControlsInput } from "./controls-tab";

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
const CLASSIFICATION: Field[] = [
  { key: "sector", label: "القطاع" },
  { key: "land_right", label: "نوع الحقّ" },
  { key: "project_type", label: "نوع المشروع" },
];

function Section({ title, fields, entity }: { title: string; fields: Field[]; entity: Record<string, unknown> }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <h4 className="mb-2 text-xs font-bold text-primary/80">{title}</h4>
      <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="flex gap-2 text-sm">
            <dt className="shrink-0 text-xs text-muted-foreground">{f.label}:</dt>
            <dd className="min-w-0 break-words font-medium">{fmt(entity, f.key)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const FCLR: Record<Fulfillment, string> = {
  met: "text-state-completed",
  not_met: "text-state-withdrawn",
  needs_action: "text-state-announced",
  needs_input: "text-state-inprogress",
  not_applicable: "text-muted-foreground",
};
const FLABEL: Record<Fulfillment, string> = {
  met: "مستوفٍ",
  not_met: "غير مستوفٍ",
  needs_action: "يتطلّب إجراء",
  needs_input: "مُدخل مطلوب",
  not_applicable: "غير منطبق",
};

function parcelState(kind: ParcelKind, e: Record<string, unknown>): ParcelState {
  if (kind === "opportunity") return "announced";
  if (kind === "license") return (typeof e.status === "string" ? (e.status as ParcelState) : null) ?? "in-progress";
  return (typeof e.state === "string" ? (e.state as ParcelState) : null) ?? "assumed";
}

export function ReportTab({ kind, entity }: { kind: ParcelKind; entity: Record<string, unknown> }) {
  const state = parcelState(kind, entity);
  const title = orNA(entity[kind === "assumed" ? "name" : "title"] ?? entity.parcel_no);
  const areaKey = kind === "assumed" ? "area_m2" : "area_total_m2";

  const r = evaluateControls(toControlsInput(kind, entity));
  const all = [...r.projectControls, ...r.investorCriteria];
  const counts = (["met", "not_met", "needs_action", "needs_input", "not_applicable"] as Fulfillment[])
    .map((f) => ({ f, n: all.filter((it) => it.fulfillment === f).length }))
    .filter((x) => x.n > 0);

  return (
    <div className="space-y-4">
      {/* رأس التقرير */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-gradient-to-l from-primary/10 to-transparent p-3.5">
        <FileText className="size-5 text-primary/70" />
        <h3 className="text-sm font-bold">{title}</h3>
        <StateBadge state={state} />
        <span className="text-xs text-muted-foreground">
          {sectorLabel(entity.sector as string | null)} · {formatArea(entity[areaKey] as number | null)}
        </span>
        <Button type="button" size="sm" variant="outline" disabled className="ms-auto gap-1.5 opacity-60">
          <FileDown className="size-4" /> تصدير PDF (م6)
        </Button>
      </div>

      <Section title="الهوية والموقع" fields={LOCATION} entity={entity} />
      <Section title="التصنيف" fields={CLASSIFICATION} entity={entity} />
      <Section title="تفاصيل النوع" fields={TYPE_FIELDS[kind]} entity={entity} />

      {/* ملخّص الفحص القانوني */}
      <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
        <h4 className="mb-2 text-xs font-bold text-primary/80">ملخّص الفحص القانوني (§ج.9)</h4>
        <p className="text-sm font-bold">خلاصة الأهلية: {r.eligibilityLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {counts.map(({ f, n }) => (
            <span key={f} className={`rounded-full bg-secondary/50 px-2 py-0.5 text-[11px] ring-1 ring-inset ring-border/60 ${FCLR[f]}`}>
              {FLABEL[f]}: {formatNumber(n)}
            </span>
          ))}
        </div>
        {r.gaps.length ? <p className="mt-2 text-[11px] text-muted-foreground">أبرز النواقص: {r.gaps.join(" · ")}</p> : null}
      </section>

      {entity.notes ? (
        <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
          <h4 className="mb-1.5 text-xs font-bold text-primary/80">ملاحظات</h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{orNA(entity.notes)}</p>
        </section>
      ) : null}
    </div>
  );
}
