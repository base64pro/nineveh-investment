"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Ruler,
  Tag,
  Trash2,
  User,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { cn } from "@/lib/utils";
import { exportCsv } from "@/lib/export-csv";
import { formatArea, formatDate, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/features/parcels/state-badge";
import { LicenseForm } from "./license-form";
import { LicenseDetail } from "./license-detail";
import { deleteLicense } from "./actions";
import { LICENSE_EXPORT_COLUMNS } from "./fields";
import type { License } from "@/types/entities";

const distinct = (values: (string | null)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

// التصفيات الأربع (§هـ.1): الكل · قيد · منجزة · مسحوبة — بألوان الحالات.
const STATUS_TABS: { value: string; label: string; active: string }[] = [
  { value: "", label: "الكل", active: "bg-primary/15 text-foreground ring-1 ring-border" },
  { value: "in-progress", label: "قيد", active: "bg-state-inprogress/20 text-state-inprogress ring-1 ring-state-inprogress/40" },
  { value: "completed", label: "منجزة", active: "bg-state-completed/20 text-state-completed ring-1 ring-state-completed/40" },
  { value: "withdrawn", label: "مسحوبة", active: "bg-state-withdrawn/20 text-state-withdrawn ring-1 ring-state-withdrawn/40" },
];

const STATUS_ACCENT: Record<string, string> = {
  "in-progress": "from-state-inprogress to-state-inprogress/20",
  completed: "from-state-completed to-state-completed/20",
  withdrawn: "from-state-withdrawn to-state-withdrawn/20",
};

function Cell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2 py-1.5">
      <Icon className="size-3.5 shrink-0 text-primary/60" />
      <div className="min-w-0">
        <div className="text-[10px] leading-none text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-xs font-semibold" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5 text-[11px] text-secondary-foreground">
      <Icon className="size-3 opacity-70" /> {value}
    </span>
  );
}

export function LicensesPanel() {
  const { data, isLoading, isError, refetch } = useTable<License>("licenses");
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [muqataa, setMuqataa] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [detail, setDetail] = useState<License | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const sectors = useMemo(() => distinct(all.map((o) => o.sector)), [all]);
  const districts = useMemo(() => distinct(all.map((o) => o.district)), [all]);
  const muqataas = useMemo(() => distinct(all.map((o) => o.muqataa_no)), [all]);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { "in-progress": 0, completed: 0, withdrawn: 0 };
    for (const l of all) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [all]);

  const optionSets = useMemo(
    () => ({
      sector: sectors,
      project_type: distinct(all.map((o) => o.project_type)),
      district: districts,
      muqataa_name: distinct(all.map((o) => o.muqataa_name)),
      land_right: distinct(all.map((o) => o.land_right)),
      investor_nationality: distinct(all.map((o) => o.investor_nationality)),
    }),
    [all, sectors, districts],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((o) => {
      if (status && o.status !== status) return false;
      if (sector && o.sector !== sector) return false;
      if (district && o.district !== district) return false;
      if (muqataa && o.muqataa_no !== muqataa) return false;
      if (needle) {
        const hay = `${o.title ?? ""} ${o.license_number ?? ""} ${o.owner ?? ""} ${o.investor_name ?? ""} ${o.parcel_no ?? ""} ${o.muqataa_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, status, sector, district, muqataa]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.record_id));

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((o) => o.record_id)));
  }
  function onExport() {
    const rows = selected.size ? filtered.filter((o) => selected.has(o.record_id)) : filtered;
    exportCsv("licenses.csv", rows as unknown as Record<string, unknown>[], [...LICENSE_EXPORT_COLUMNS]);
  }
  async function onDelete(o: License) {
    if (!window.confirm(`حذف الرخصة «${o.title ?? o.license_number ?? "بلا عنوان"}»؟`)) return;
    const res = await deleteLicense(o.record_id);
    if (res.ok) {
      toast.success("حُذِفت الرخصة");
      void queryClient.invalidateQueries({ queryKey: ["table", "licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        {/* التصفيات الأربع (§هـ.1) */}
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => {
            const isActive = status === t.value;
            const count = t.value === "" ? all.length : statusCounts[t.value] ?? 0;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatus(t.value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
                  isActive ? t.active : "text-muted-foreground hover:bg-accent",
                )}
              >
                {t.label}
                <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (عنوان/رقم رخصة/مالك/مستثمر/قطعة)…"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {/* فلترة متقدّمة: قطاع · قضاء · مقاطعة */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل القطاعات</option>
            {sectors.map((s) => <option key={s} value={s}>{sectorLabel(s)}</option>)}
          </select>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل الأقضية</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={muqataa} onChange={(e) => setMuqataa(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل المقاطعات</option>
            {muqataas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} title="إضافة رخصة">
            <Plus className="size-3.5" /> إضافة
          </Button>
          <Button size="sm" variant="outline" onClick={onExport} title="تصدير CSV">
            <Download className="size-3.5" /> تصدير{selected.size ? ` (${selected.size})` : ""}
          </Button>
          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="size-3.5" />
            تحديد الكل
          </label>
          <span className="ms-auto text-xs text-muted-foreground">
            معروض {filtered.length}/{all.length}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : null}

        {isError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">تعذّر تحميل البيانات.</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>إعادة المحاولة</Button>
          </div>
        ) : null}

        {!isLoading && !isError && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا نتائج.</p>
        ) : null}

        <ul className="space-y-2.5">
          {filtered.map((o) => {
            const isOpen = expanded.has(o.record_id);
            return (
              <li
                key={o.record_id}
                className="group relative overflow-hidden rounded-xl border border-foreground/30 ring-1 ring-inset ring-foreground/10 bg-gradient-to-br from-card/85 via-card/55 to-card/35 shadow-sm transition-all duration-200 hover:border-foreground/50 hover:ring-foreground/20 hover:shadow-[0_12px_34px_-14px] hover:shadow-foreground/10"
              >
                {/* شريط الحالة الجانبي بلون حالة الرخصة */}
                <span
                  className={cn("absolute inset-y-0 start-0 w-1 bg-gradient-to-b", STATUS_ACCENT[o.status] ?? "from-border to-border/20")}
                  aria-hidden
                />

                {/* رأس البطاقة (دائم): العنوان + القطاع + الحالة — النقر يطوي/يفتح */}
                <div className="flex items-start gap-2 ps-4 pe-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.record_id)}
                    onChange={() => toggleOne(o.record_id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 size-4 shrink-0 cursor-pointer accent-state-inprogress"
                    aria-label="تحديد"
                  />
                  <button
                    type="button"
                    onClick={() => toggleExpand(o.record_id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 flex-col gap-1.5 py-2.5 text-start"
                  >
                    <div className="flex w-full items-start gap-2">
                      <h4 className={cn("min-w-0 flex-1 text-[15px] font-semibold leading-snug", isOpen ? "line-clamp-2" : "truncate")}>
                        {orNA(o.title)}
                      </h4>
                      <ChevronDown
                        className={cn(
                          "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="flex w-full items-center gap-2">
                      {o.sector ? <Chip icon={Tag} value={sectorLabel(o.sector)} /> : null}
                      <span className="ms-auto">
                        <StateBadge state={o.status} />
                      </span>
                    </div>
                  </button>
                </div>

                {/* جسم البطاقة (عند الفتح فقط) */}
                {isOpen ? (
                  <div className="px-3.5 pb-3.5 ps-4">
                    {o.investor_name || o.issue_date ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {o.investor_name ? <Chip icon={UserCircle} value={o.investor_name} /> : null}
                        {o.issue_date ? <Chip icon={Calendar} value={formatDate(o.issue_date)} /> : null}
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Cell icon={BadgeCheck} label="رقم الرخصة" value={orNA(o.license_number)} />
                      <Cell icon={MapPin} label="القطعة" value={orNA(o.parcel_no)} />
                      <Cell icon={Ruler} label="المساحة الكلية" value={formatArea(o.area_total_m2)} />
                      <Cell icon={User} label="العائدية" value={orNA(o.owner)} />
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2.5">
                      <Button size="sm" variant="outline" onClick={() => setDetail(o)} title="عرض التفاصيل">
                        <Eye className="size-3.5" /> عرض
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(o); setFormOpen(true); }} title="تعديل">
                        <Pencil className="size-3.5" /> تعديل
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void onDelete(o)} title="حذف" className="ms-auto">
                        <Trash2 className="size-3.5" /> حذف
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <LicenseForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} optionSets={optionSets} />
      <LicenseDetail open={detail !== null} onClose={() => setDetail(null)} license={detail} />
    </div>
  );
}
