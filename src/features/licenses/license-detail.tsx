"use client";

import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Banknote, Building2, Calendar, FileText, Landmark, MapPin, Ruler, Tag, UserCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { StateBadge } from "@/features/parcels/state-badge";
import { formatArea, formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { formatNumber } from "@/lib/format";
import { licenseStatusLabel } from "./fields";
import type { License } from "@/types/entities";

const NUMERIC = new Set(["area_olk", "area_m2", "area_total_m2", "capital", "lease_rate", "term_years"]);
const DATE = new Set(["issue_date", "renewal_date", "completion_date", "withdrawal_date"]);

function val(o: License, key: string): string {
  const v = (o as unknown as Record<string, unknown>)[key];
  if (key === "sector") return sectorLabel(typeof v === "string" ? v : null);
  if (key === "status") return licenseStatusLabel(v) || NOT_AVAILABLE;
  if (DATE.has(key)) return formatDate(typeof v === "string" ? v : null);
  if (NUMERIC.has(key)) return v === null || v === undefined ? NOT_AVAILABLE : formatNumber(Number(v));
  return orNA(v);
}

const GRID_SECTIONS: { title: string; icon: LucideIcon; fields: { key: string; label: string }[] }[] = [
  {
    title: "الهوية والموقع",
    icon: MapPin,
    fields: [
      { key: "license_number", label: "رقم الرخصة" },
      { key: "parcel_no", label: "رقم القطعة" },
      { key: "muqataa_no", label: "رقم المقاطعة" },
      { key: "muqataa_name", label: "اسم المقاطعة" },
      { key: "district", label: "القضاء" },
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
      { key: "land_right", label: "نوع الحقّ" },
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
    title: "المستثمر والمالية",
    icon: Banknote,
    fields: [
      { key: "investor_name", label: "المستثمر" },
      { key: "investor_nationality", label: "الجنسية" },
      { key: "capital", label: "رأس المال" },
      { key: "lease_rate", label: "بدل الإيجار" },
      { key: "term_years", label: "مدة العقد (سنوات)" },
    ],
  },
  {
    title: "الحالة والتواريخ",
    icon: Calendar,
    fields: [
      { key: "status", label: "الحالة" },
      { key: "issue_date", label: "تاريخ الإصدار" },
      { key: "renewal_date", label: "تاريخ التجديد" },
      { key: "completion_date", label: "تاريخ الإنجاز" },
      { key: "withdrawal_date", label: "تاريخ السحب" },
    ],
  },
];

const TEXT_FIELDS = [
  { key: "description", label: "الوصف" },
  { key: "raw_details", label: "التفاصيل" },
  { key: "withdrawal_reason", label: "سبب السحب" },
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

export function LicenseDetail({
  open,
  onClose,
  license,
}: {
  open: boolean;
  onClose: () => void;
  license: License | null;
}) {
  if (!license) return null;
  const o = license;

  return (
    <Dialog open={open} onClose={onClose} title={o.title ?? "تفاصيل الرخصة"} size="xl">
      <div className="space-y-5">
        {/* بطاقة موجزة بارزة (هولوكرامية) */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-l from-primary/10 via-card to-card p-4 shadow-[0_0_36px_-14px] shadow-primary/40">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge state={o.status} />
            {o.license_number ? (
              <span className="rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs text-secondary-foreground">
                رقم الرخصة: {orNA(o.license_number)}
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Fact icon={BadgeCheck} label="رقم الرخصة" value={orNA(o.license_number)} />
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

        {/* نصوص بارزة مستقلّة */}
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
              className="inline-flex items-center gap-1 text-xs text-primary underline"
            >
              <UserCircle className="size-3.5" /> المصدر
            </a>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
