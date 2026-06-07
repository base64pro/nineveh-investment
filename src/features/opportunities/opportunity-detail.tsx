"use client";

import { Dialog } from "@/components/ui/dialog";
import { StateBadge } from "@/features/parcels/state-badge";
import { formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import type { Opportunity } from "@/types/entities";

const NUMERIC = new Set(["area_olk", "area_m2", "area_total_m2", "doc_fee", "views", "announcement_count"]);
const DATE = new Set(["publish_date", "deadline"]);

function val(o: Opportunity, key: string): string {
  const v = (o as unknown as Record<string, unknown>)[key];
  if (DATE.has(key)) return formatDate(typeof v === "string" ? v : null);
  if (NUMERIC.has(key)) return v === null || v === undefined ? NOT_AVAILABLE : formatNumber(Number(v));
  return orNA(v);
}

const SECTIONS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: "الهوية والموقع",
    fields: [
      { key: "parcel_no", label: "رقم القطعة" },
      { key: "muqataa_no", label: "رقم المقاطعة" },
      { key: "muqataa_name", label: "اسم المقاطعة" },
      { key: "district", label: "القضاء" },
      { key: "zoning", label: "التخطيط" },
    ],
  },
  {
    title: "التصنيف والعائدية",
    fields: [
      { key: "sector", label: "القطاع" },
      { key: "project_type", label: "نوع المشروع" },
      { key: "owner", label: "العائدية/المالك" },
    ],
  },
  {
    title: "المساحة",
    fields: [
      { key: "area_olk", label: "أولك" },
      { key: "area_m2", label: "م²" },
      { key: "area_total_m2", label: "الكلية (م²)" },
      { key: "area_factor_note", label: "ملاحظة" },
    ],
  },
  {
    title: "الإعلان",
    fields: [
      { key: "announcement_number", label: "رقم الإعلان" },
      { key: "announcement_type", label: "نوع الإعلان" },
      { key: "publish_date", label: "تاريخ النشر" },
      { key: "deadline", label: "آخر موعد" },
      { key: "opp_status", label: "حالة الإعلان" },
      { key: "doc_fee", label: "أجور الوثائق" },
    ],
  },
  {
    title: "الوصف والشروط",
    fields: [
      { key: "description", label: "الوصف" },
      { key: "raw_details", label: "التفاصيل" },
      { key: "conditions", label: "الشروط" },
      { key: "source_url", label: "المصدر" },
      { key: "notes", label: "ملاحظات" },
    ],
  },
];

export function OpportunityDetail({
  open,
  onClose,
  opportunity,
}: {
  open: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
}) {
  if (!opportunity) return null;
  const available = !(Array.isArray(opportunity.license_ref) && opportunity.license_ref.length > 0);

  return (
    <Dialog open={open} onClose={onClose} title={opportunity.title ?? "تفاصيل الفرصة"} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {available ? (
            <span className="rounded-full bg-state-completed/15 px-2.5 py-0.5 text-xs font-medium text-state-completed ring-1 ring-state-completed/40 shadow-[0_0_12px_-2px] shadow-state-completed/50">
              متاحة
            </span>
          ) : null}
          <StateBadge state="announced" />
        </div>

        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-lg border border-border/60 bg-background/40 p-3">
            <h4 className="mb-2 text-xs font-bold text-primary/80">{section.title}</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {section.fields.map((f) => (
                <div key={f.key} className="flex gap-2 text-sm">
                  <dt className="shrink-0 text-xs text-muted-foreground">{f.label}:</dt>
                  <dd className="min-w-0 break-words">{val(opportunity, f.key)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
