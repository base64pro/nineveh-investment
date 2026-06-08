"use client";

import type { LucideIcon } from "lucide-react";
import { Banknote, Building2, FileText, Landmark, MapPin, Ruler, Tag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { StateBadge } from "@/features/parcels/state-badge";
import { formatArea, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import type { AssumedParcel } from "@/types/entities";

const NUMERIC = new Set(["area_m2", "value"]);

function val(o: AssumedParcel, key: string): string {
  const v = (o as unknown as Record<string, unknown>)[key];
  if (key === "sector") return sectorLabel(typeof v === "string" ? v : null);
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
      { key: "subdistrict", label: "الناحية" },
      { key: "neighborhood", label: "الحي/المنطقة" },
    ],
  },
  {
    title: "التصنيف والعائدية",
    icon: Tag,
    fields: [
      { key: "sector", label: "القطاع" },
      { key: "owner", label: "العائدية/المالك" },
      { key: "land_right", label: "نوع الحقّ" },
    ],
  },
  {
    title: "المساحة والقيمة والوضع",
    icon: Banknote,
    fields: [
      { key: "area_m2", label: "المساحة (م²)" },
      { key: "value", label: "القيمة" },
      { key: "legal_status", label: "الوضع القانوني" },
    ],
  },
];

const TEXT_FIELDS = [
  { key: "annexation_plan", label: "خطة الضمّ" },
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

export function AssumedDetail({
  open,
  onClose,
  parcel,
}: {
  open: boolean;
  onClose: () => void;
  parcel: AssumedParcel | null;
}) {
  if (!parcel) return null;
  const o = parcel;
  const title = o.name ?? (o.parcel_no ? `القطعة ${o.parcel_no}` : "قطعة مفترضة");

  return (
    <Dialog open={open} onClose={onClose} title={title} size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/60 bg-gradient-to-l from-primary/10 via-card to-card p-4 shadow-[0_0_36px_-14px] shadow-primary/40">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge state="assumed" />
            <span className="text-[11px] text-muted-foreground">الحدود تُرسَم على الخريطة (أداة الرسم — م2.4)</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Fact icon={MapPin} label="القطعة" value={orNA(o.parcel_no)} />
            <Fact icon={Building2} label="المقاطعة" value={orNA(o.muqataa_no)} />
            <Fact icon={Ruler} label="المساحة" value={formatArea(o.area_m2)} />
            <Fact icon={Landmark} label="القطاع" value={sectorLabel(o.sector)} />
          </div>
        </div>

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

        <div className="space-y-3">
          {TEXT_FIELDS.map((f) => (
            <section key={f.key} className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
                <FileText className="size-3.5" /> {f.label}
              </h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {orNA((o as unknown as Record<string, unknown>)[f.key])}
              </p>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
