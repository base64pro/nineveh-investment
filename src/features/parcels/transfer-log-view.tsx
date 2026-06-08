"use client";

// عرض «البيانات المنقولة من حالات سابقة» (§هـ.4 · م3.5) — اللقطات الكاملة المحفوظة في transfer_log
// عند النقل بين الأقسام (صفر فقدان). للقراءة فقط. company_ref لا يُعرَض (§ح).

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";

export interface TransferEntry {
  from_kind?: string;
  moved_at?: string;
  data?: Record<string, unknown>;
}

const KIND_AR: Record<string, string> = { opportunity: "فرصة", license: "رخصة", assumed: "مفترضة" };
const STATUS_AR: Record<string, string> = { "in-progress": "قيد الإنجاز", completed: "منجزة", withdrawn: "مسحوبة", announced: "معلَنة", assumed: "مفترضة" };

// قائمة بيضاء بالحقول المعروضة (لا معرّفات داخلية/إحالات — §ح).
const LABELS: Record<string, string> = {
  title: "العنوان", name: "الاسم", license_number: "رقم الرخصة", status: "الحالة",
  sector: "القطاع", project_type: "نوع المشروع", parcel_no: "رقم القطعة", muqataa_no: "رقم المقاطعة",
  muqataa_name: "اسم المقاطعة", district: "القضاء", subdistrict: "الناحية", neighborhood: "الحي/المنطقة",
  area_olk: "المساحة (أولك)", area_m2: "المساحة (م²)", area_total_m2: "المساحة الكلية (م²)",
  owner: "العائدية/المالك", land_right: "نوع الحقّ", zoning: "التخطيط",
  investor_name: "المستثمر", investor_nationality: "جنسية المستثمر", capital: "رأس المال", value: "القيمة",
  lease_rate: "بدل الإيجار", term_years: "مدة العقد (سنوات)", issue_date: "تاريخ الإصدار",
  completion_date: "تاريخ الإنجاز", withdrawal_date: "تاريخ السحب", withdrawal_reason: "سبب السحب",
  renewal_date: "تاريخ التجديد", announcement_number: "رقم الإعلان", announcement_type: "نوع الإعلان",
  publish_date: "تاريخ النشر", deadline: "آخر موعد", opp_status: "حالة الإعلان", doc_fee: "أجور الوثائق",
  annexation_plan: "خطة الضمّ", legal_status: "الوضع القانوني", description: "الوصف", raw_details: "التفاصيل",
  notes: "ملاحظات",
};
const NUMERIC = new Set(["capital", "value", "area_olk", "area_m2", "area_total_m2", "lease_rate", "term_years", "doc_fee"]);
const DATES = new Set(["issue_date", "completion_date", "withdrawal_date", "renewal_date", "publish_date", "deadline"]);

function fmt(key: string, v: unknown): string {
  if (key === "sector") return sectorLabel(typeof v === "string" ? v : null);
  if (key === "status") return STATUS_AR[String(v)] ?? orNA(v);
  if (DATES.has(key)) return formatDate(typeof v === "string" ? v.slice(0, 10) : null);
  if (NUMERIC.has(key)) return typeof v === "number" ? formatNumber(v) : NOT_AVAILABLE;
  return orNA(v);
}

function entryFields(data: Record<string, unknown>): { label: string; value: string }[] {
  return Object.keys(LABELS)
    .filter((k) => {
      const v = data[k];
      return v !== null && v !== undefined && String(v).trim() !== "";
    })
    .map((k) => ({ label: LABELS[k]!, value: fmt(k, data[k]) }));
}

export function TransferLogView({ log }: { log: TransferEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!log.length) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3 sm:col-span-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-xs font-bold text-foreground/80">
        <History className="size-4 text-primary/70" />
        بيانات منقولة من حالات سابقة ({formatNumber(log.length)})
        <ChevronDown className={`ms-auto size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {log.map((e, i) => {
            const fields = entryFields(e.data ?? {});
            return (
              <div key={i} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
                <p className="mb-1.5 text-[11px] font-medium text-primary/70">
                  من {KIND_AR[e.from_kind ?? ""] ?? orNA(e.from_kind)}
                  {e.moved_at ? ` · ${formatDate(String(e.moved_at).slice(0, 10))}` : ""}
                </p>
                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.label} className="flex gap-1.5 text-xs">
                      <dt className="shrink-0 text-muted-foreground">{f.label}:</dt>
                      <dd className="min-w-0 break-words font-medium">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
