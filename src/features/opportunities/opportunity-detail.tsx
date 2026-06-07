"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Calendar, FileText, Landmark, MapPin, Ruler, Tag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { StateBadge } from "@/features/parcels/state-badge";
import { formatArea, formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { formatNumber } from "@/lib/format";
import type { Opportunity } from "@/types/entities";

const NUMERIC = new Set(["area_olk", "area_m2", "area_total_m2", "doc_fee", "views", "announcement_count"]);
const DATE = new Set(["publish_date", "deadline"]);

function val(o: Opportunity, key: string): string {
  const v = (o as unknown as Record<string, unknown>)[key];
  if (key === "sector") return sectorLabel(typeof v === "string" ? v : null);
  if (DATE.has(key)) return formatDate(typeof v === "string" ? v : null);
  if (NUMERIC.has(key)) return v === null || v === undefined ? NOT_AVAILABLE : formatNumber(Number(v));
  return orNA(v);
}

const GRID_SECTIONS: { title: string; icon: LucideIcon; fields: { key: string; label: string }[] }[] = [
  {
    title: "الهوية والموقع",
    icon: MapPin,
    fields: [
      { key: "parcel_no", label: "رقم القطعة" },
      { key: "muqataa_no", label: "رقم المقاطعة" },
      { key: "muqataa_name", label: "اسم المقاطعة" },
      { key: "district", label: "القضاء" },
      { key: "neighborhood", label: "الحي" },
      { key: "zoning", label: "التخطيط" },
    ],
  },
  {
    title: "التصنيف والعائدية",
    icon: Tag,
    fields: [
      { key: "sector", label: "القطاع" },
      { key: "project_type", label: "نوع المشروع" },
      { key: "owner", label: "العائدية/المالك" },
    ],
  },
  {
    title: "المساحة",
    icon: Ruler,
    fields: [
      { key: "area_olk", label: "أولك" },
      { key: "area_m2", label: "م²" },
      { key: "area_total_m2", label: "الكلية (م²)" },
      { key: "area_factor_note", label: "ملاحظة" },
    ],
  },
  {
    title: "الإعلان",
    icon: Calendar,
    fields: [
      { key: "announcement_number", label: "رقم الإعلان" },
      { key: "announcement_type", label: "نوع الإعلان" },
      { key: "publish_date", label: "تاريخ النشر" },
      { key: "deadline", label: "آخر موعد" },
      { key: "opp_status", label: "حالة الإعلان" },
      { key: "doc_fee", label: "أجور الوثائق" },
    ],
  },
];

const TEXT_FIELDS = [
  { key: "description", label: "الوصف" },
  { key: "raw_details", label: "التفاصيل" },
  { key: "conditions", label: "الشروط" },
  { key: "notes", label: "ملاحظات" },
];

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 p-2">
      <Icon className="size-4 shrink-0 text-primary/70" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold" title={value}>{value}</div>
      </div>
    </div>
  );
}

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
  const o = opportunity;
  const available = !(Array.isArray(o.license_ref) && o.license_ref.length > 0);

  return (
    <Dialog open={open} onClose={onClose} title={o.title ?? "تفاصيل الفرصة"} size="xl">
      <div className="space-y-5">
        {/* بطاقة موجزة بارزة (هولوكرامية) */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-l from-primary/10 via-card to-card p-4 shadow-[0_0_36px_-14px] shadow-primary/40">
          <div className="flex flex-wrap items-center gap-2">
            {available ? (
              <span className="rounded-full bg-state-completed/15 px-2.5 py-0.5 text-xs font-medium text-state-completed ring-1 ring-state-completed/40 shadow-[0_0_12px_-2px] shadow-state-completed/50">
                متاحة
              </span>
            ) : null}
            <StateBadge state="announced" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Fact icon={MapPin} label="القطعة" value={orNA(o.parcel_no)} />
            <Fact icon={Building2} label="المقاطعة" value={orNA(o.muqataa_no)} />
            <Fact icon={Ruler} label="المساحة الكلية" value={formatArea(o.area_total_m2)} />
            <Fact icon={Landmark} label="القطاع" value={sectorLabel(o.sector)} />
          </div>
        </div>

        {/* أقسام شبكية أنيقة */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GRID_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="rounded-xl border border-border/60 bg-background/40 p-3.5">
                <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
                  <Icon className="size-3.5" /> {section.title}
                </h4>
                <dl className="space-y-1.5">
                  {section.fields.map((f) => (
                    <div key={f.key} className="flex gap-2 text-sm">
                      <dt className="shrink-0 text-xs text-muted-foreground">{f.label}:</dt>
                      <dd className="min-w-0 break-words font-medium">{val(o, f.key)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>

        {/* نصوص بارزة مستقلّة (الوصف/التفاصيل) */}
        <div className="space-y-3">
          {TEXT_FIELDS.map((f) => (
            <section key={f.key} className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
                <FileText className="size-3.5" /> {f.label}
              </h4>
              <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {orNA((o as unknown as Record<string, unknown>)[f.key])}
              </p>
            </section>
          ))}
          {o.source_url ? (
            <a
              href={o.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-primary underline"
            >
              المصدر
            </a>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
