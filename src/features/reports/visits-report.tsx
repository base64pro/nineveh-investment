"use client";

// م7.9 · تقارير الزيارات الميدانية (طلب معتمد): سجلّ الزيارات مُثرى ببيانات رخصته —
// فلاتر مركّبة (مدة زمنية · قضاء · موظف منفّذ · قطاع · حالة القطعة · نوع الزيارة) + تصدير PDF براندد.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, ClipboardList, Download, FilterX, Users } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { exportTable } from "@/lib/export-table";
import { formatDate, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import { licenseStatusLabel } from "@/features/licenses/fields";
import { FilterCombo } from "@/components/ui/filter-combo";
import { ORB } from "@/components/ui/orb";
import { cn } from "@/lib/utils";
import { requestOpenParcelDetail } from "@/features/map/lib/map-nav-store";
import type { License, Visit } from "@/types/entities";

interface VisitRow {
  id: string;
  record_id: number | null;
  visit_date: string;
  visit_type: string;
  staff: string;
  notes: string;
  title: string;
  sector: string; // تسمية عربية
  district: string;
  neighborhood: string;
  status: string; // تسمية عربية
}

const distinct = (vals: (string | null)[]): string[] =>
  Array.from(new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean))).sort();

const EXPORT_COLUMNS = [
  { key: "visit_date", label: "التاريخ", format: (v: unknown) => formatDate(v as string | null) },
  { key: "visit_type", label: "نوع الزيارة" },
  { key: "staff", label: "الموظفون المنفّذون" },
  { key: "title", label: "المشروع/الرخصة" },
  { key: "sector", label: "القطاع" },
  { key: "district", label: "القضاء" },
  { key: "neighborhood", label: "الحي" },
  { key: "status", label: "حالة القطعة" },
  { key: "notes", label: "الملاحظات" },
];

export function VisitsReport() {
  const { data: visits, isLoading } = useTable<Visit>("visits");
  const { data: licenses } = useTable<License>("licenses");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [district, setDistrict] = useState("");
  const [staff, setStaff] = useState("");
  const [sector, setSector] = useState("");
  const [status, setStatus] = useState("");
  const [vtype, setVtype] = useState("");

  // إثراء كل زيارة ببيانات رخصتها (المصدر المشترك §هـ.2) — الأحدث أولاً
  const rows = useMemo<VisitRow[]>(() => {
    const byId = new Map((licenses ?? []).map((l) => [String(l.record_id), l]));
    return (visits ?? [])
      .map((v) => {
        const l = byId.get(v.parcel_ref);
        return {
          id: v.id,
          record_id: l?.record_id ?? null,
          visit_date: v.visit_date ?? "",
          visit_type: (v.visit_type ?? "").trim(),
          staff: (v.staff ?? "").trim(),
          notes: (v.notes ?? "").trim(),
          title: (l?.title ?? "").trim(),
          sector: l?.sector ? sectorLabel(l.sector) : "",
          district: (l?.district ?? "").trim(),
          neighborhood: (l?.neighborhood ?? "").trim(),
          status: licenseStatusLabel(l?.status),
        };
      })
      .sort((a, b) => b.visit_date.localeCompare(a.visit_date));
  }, [visits, licenses]);

  const districtOptions = useMemo(() => distinct(rows.map((r) => r.district)), [rows]);
  const staffOptions = useMemo(() => distinct(rows.map((r) => r.staff)), [rows]);
  const sectorOptions = useMemo(() => distinct(rows.map((r) => r.sector)), [rows]);
  const statusOptions = useMemo(() => distinct(rows.map((r) => r.status)), [rows]);
  const typeOptions = useMemo(() => distinct(rows.map((r) => r.visit_type)), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (from && r.visit_date.slice(0, 10) < from) return false;
      if (to && r.visit_date.slice(0, 10) > to) return false;
      if (district && !r.district.includes(district.trim())) return false;
      if (staff && !r.staff.includes(staff.trim())) return false;
      if (sector && !r.sector.includes(sector.trim())) return false;
      if (status && r.status !== status.trim()) return false;
      if (vtype && !r.visit_type.includes(vtype.trim())) return false;
      return true;
    });
  }, [rows, from, to, district, staff, sector, status, vtype]);

  const hasFilters = Boolean(from || to || district || staff || sector || status || vtype);
  function clearFilters(): void {
    setFrom("");
    setTo("");
    setDistrict("");
    setStaff("");
    setSector("");
    setStatus("");
    setVtype("");
  }

  async function onExport(): Promise<void> {
    const ok = await exportTable(
      "pdf",
      "visits-report.csv",
      "تقرير الزيارات الميدانية",
      filtered as unknown as Record<string, unknown>[],
      EXPORT_COLUMNS,
    );
    if (!ok) toast.error("تعذّر تصدير PDF — حاول مجدداً");
  }

  const DATE_INPUT =
    "w-full rounded-lg border border-input bg-background/60 px-2 py-1.5 text-xs outline-none transition focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-3 p-3">
      {/* شريط الفلاتر المركّبة */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground/90">
          <CalendarRange className="size-4 text-primary/70" /> تصفية الزيارات
          <span className="ms-auto rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary ring-1 ring-inset ring-primary/35">
            {formatNumber(filtered.length)} / {formatNumber(rows.length)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] text-muted-foreground">من تاريخ</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={DATE_INPUT} />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-muted-foreground">إلى تاريخ</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={DATE_INPUT} />
          </div>
          <FilterCombo value={district} onChange={setDistrict} options={districtOptions} placeholder="القضاء/المنطقة" />
          <FilterCombo value={staff} onChange={setStaff} options={staffOptions} placeholder="الموظف المنفّذ" />
          <FilterCombo value={sector} onChange={setSector} options={sectorOptions} placeholder="القطاع" />
          <FilterCombo value={status} onChange={setStatus} options={statusOptions} placeholder="حالة القطعة" />
          <FilterCombo value={vtype} onChange={setVtype} options={typeOptions} placeholder="نوع الزيارة" />
          <div className="flex items-center gap-1.5">
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                title="مسح التصفية"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/60 py-1.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <FilterX className="size-3.5" /> مسح
              </button>
            ) : null}
            <button type="button" onClick={() => void onExport()} title="تصدير تقرير الزيارات PDF" aria-label="تصدير PDF" className={cn(ORB, "size-10 shrink-0")}>
              <Download className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* سجلّ الزيارات (الأحدث أولاً) */}
      {isLoading ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">يحمَّل سجلّ الزيارات…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-muted-foreground">
          <ClipboardList className="size-8 opacity-40" />
          <p className="text-sm">{rows.length === 0 ? "لا زيارات مسجّلة بعد — تُضاف من نافذة القطعة (قيد الإنجاز/منجزة)" : "لا زيارات مطابقة للتصفية"}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border border-border/60 bg-card/50 p-2.5 transition hover:border-primary/40">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/12 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary ring-1 ring-inset ring-primary/30">
                  {formatDate(r.visit_date)}
                </span>
                <span className="text-[11px] font-semibold text-foreground/90">{orNA(r.visit_type)}</span>
                <span className="ms-auto text-[10px] text-muted-foreground">{orNA(r.status)}</span>
              </div>
              <button
                type="button"
                onClick={() => r.record_id !== null && requestOpenParcelDetail({ kind: "license", id: String(r.record_id), readOnly: true })}
                className="mt-1 block w-full truncate text-right text-xs font-bold text-foreground transition hover:text-primary"
                title={r.title}
              >
                {orNA(r.title)}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="size-3" /> {orNA(r.staff)}</span>
                {r.sector ? <span>{r.sector}</span> : null}
                {r.district ? <span>{r.district}</span> : null}
                {r.neighborhood ? <span>{r.neighborhood}</span> : null}
              </div>
              {r.notes ? <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/75">{r.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
