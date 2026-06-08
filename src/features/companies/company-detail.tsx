"use client";

import type { LucideIcon } from "lucide-react";
import { Banknote, FileText, Landmark, MapPin, Phone, Tag, Users } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import { governorateLabel } from "@/lib/governorates";
import { isEligible } from "./fields";
import type { Company } from "@/types/entities";

const NUMERIC = new Set(["capital_iqd", "capital_usd"]);

function val(o: Company, key: string): string {
  const v = (o as unknown as Record<string, unknown>)[key];
  if (key === "sector") return sectorLabel(typeof v === "string" ? v : null);
  if (key === "governorate") return governorateLabel(typeof v === "string" ? v : null);
  if (key === "is_excluded") return v === true ? "نعم" : "لا";
  if (key === "meets_250k_threshold") return v === true ? "نعم" : v === false ? "لا" : NOT_AVAILABLE;
  if (NUMERIC.has(key)) return v === null || v === undefined ? NOT_AVAILABLE : formatNumber(Number(v));
  return orNA(v);
}

const GRID_SECTIONS: { title: string; icon: LucideIcon; fields: { key: string; label: string }[] }[] = [
  {
    title: "الهوية والتصنيف",
    icon: Tag,
    fields: [
      { key: "company_type", label: "نوع الشركة" },
      { key: "sector", label: "القطاع" },
      { key: "activity", label: "النشاط" },
      { key: "registration_no", label: "رقم القيد" },
      { key: "file_no", label: "رقم الإضبارة" },
    ],
  },
  {
    title: "المالية والأهلية",
    icon: Banknote,
    fields: [
      { key: "capital_iqd", label: "رأس المال (دينار)" },
      { key: "capital_usd", label: "رأس المال (دولار)" },
      { key: "is_excluded", label: "مستثناة قانوناً" },
      { key: "meets_250k_threshold", label: "تستوفي عتبة 250 ألف" },
    ],
  },
  {
    title: "الاتصال والموقع",
    icon: Phone,
    fields: [
      { key: "manager", label: "المدير" },
      { key: "phone", label: "الهاتف" },
      { key: "email", label: "البريد الإلكتروني" },
      { key: "governorate", label: "المحافظة" },
      { key: "address", label: "العنوان" },
    ],
  },
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

function shareholderText(s: unknown): string {
  if (s === null || s === undefined) return "";
  if (typeof s === "string") return s;
  if (typeof s === "object") return Object.values(s as Record<string, unknown>).filter(Boolean).join(" · ");
  return String(s);
}

export function CompanyDetail({
  open,
  onClose,
  company,
}: {
  open: boolean;
  onClose: () => void;
  company: Company | null;
}) {
  if (!company) return null;
  const o = company;
  const sources = Array.isArray(o.source) ? o.source.map(String).filter(Boolean) : [];
  const shareholders = Array.isArray(o.shareholders) ? o.shareholders : [];

  return (
    <Dialog open={open} onClose={onClose} title={o.name ?? "تفاصيل الشركة"} size="xl">
      <div className="space-y-5">
        {/* بطاقة موجزة */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-l from-primary/10 via-card to-card p-4 shadow-[0_0_36px_-14px] shadow-primary/40">
          <div className="flex flex-wrap items-center gap-2">
            {o.is_excluded ? (
              <span className="rounded-full bg-state-withdrawn/15 px-2.5 py-0.5 text-xs font-medium text-state-withdrawn ring-1 ring-state-withdrawn/40">
                مستثناة قانوناً
              </span>
            ) : isEligible(o) ? (
              <span className="rounded-full bg-state-completed/15 px-2.5 py-0.5 text-xs font-medium text-state-completed ring-1 ring-state-completed/40">
                مؤهّلة
              </span>
            ) : null}
            {o.meets_250k_threshold === true ? (
              <span className="rounded-full bg-state-completed/15 px-2.5 py-0.5 text-xs font-medium text-state-completed ring-1 ring-state-completed/40">
                تستوفي العتبة
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Fact icon={Tag} label="القطاع" value={sectorLabel(o.sector)} />
            <Fact icon={Landmark} label="المحافظة" value={governorateLabel(o.governorate)} />
            <Fact icon={Banknote} label="رأس المال ($)" value={o.capital_usd === null ? NOT_AVAILABLE : formatNumber(o.capital_usd)} />
            <Fact icon={FileText} label="رقم القيد" value={orNA(o.registration_no)} />
          </div>
        </div>

        {/* أقسام شبكية */}
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
          {o.website ? (
            <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
              <h4 className="mb-1.5 text-xs font-bold text-primary/80">الموقع الإلكتروني</h4>
              <a href={o.website} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline">
                {o.website}
              </a>
            </section>
          ) : null}
        </div>

        {/* المساهمون والمصدر */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
              <Users className="size-3.5" /> المساهمون والنسب
            </h4>
            {shareholders.length ? (
              <ul className="space-y-1 text-sm">
                {shareholders.map((s, i) => (
                  <li key={i} className="break-words">{shareholderText(s)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{NOT_AVAILABLE}</p>
            )}
          </section>
          <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
              <MapPin className="size-3.5" /> المصدر
            </h4>
            {sources.length ? (
              <ul className="space-y-1 text-sm">
                {sources.map((s, i) => (
                  <li key={i} className="break-words text-foreground/90">{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{NOT_AVAILABLE}</p>
            )}
          </section>
        </div>

        {/* ملاحظات + سجلّ المشاريع (يُثرى لاحقاً) */}
        <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
            <FileText className="size-3.5" /> ملاحظات
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{orNA(o.notes)}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            سجلّ المشاريع/الخبرة: {o.projects.length ? `${formatNumber(o.projects.length)} مشروعاً` : "يُثرى لاحقاً"}
            {o.updated_at_label ? ` · ${o.updated_at_label}` : ""}
          </p>
        </section>
      </div>
    </Dialog>
  );
}
