"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  Calendar,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FilterX,
  Home,
  Landmark,
  ListChecks,
  MapPin,
  MapPinned,
  Pencil,
  PenTool,
  Plus,
  Ruler,
  Tag,
  Trash2,
  User,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { useSettings } from "@/features/settings/use-settings";
import { cn } from "@/lib/utils";
import { exportTable } from "@/lib/export-table";
import { formatArea, formatDate, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { NINEVEH_DISTRICTS, NINEVEH_SUBDISTRICTS } from "@/lib/nineveh-geo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { FilterCombo } from "@/components/ui/filter-combo";
import { LiveLocationButton } from "@/components/ui/live-location-button";
import { ORB } from "@/components/ui/orb";
import { requestFlyTo, requestOpenParcelDetail, requestStartDraw } from "@/features/map/lib/map-nav-store";
import { StateBadge } from "@/features/parcels/state-badge";
import { LicenseForm } from "./license-form";
import { VisitsLog } from "./visits/visits-log";
import { deleteLicense } from "./actions";
import { LICENSE_EXPORT_COLUMNS } from "./fields";
import type { License } from "@/types/entities";

const distinct = (values: (string | null)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

// التصفيات الأربع (§هـ.1): الكل · قيد · منجزة · مسحوبة — أزرار متساوية بألوان الحالات وتوهّج (العدّادات في دوائر عائمة).
const STATUS_TABS: { value: string; label: string; active: string }[] = [
  { value: "", label: "الكل", active: "bg-foreground/15 text-foreground ring-foreground/40 shadow-[0_0_18px_-5px_rgba(148,175,209,0.7)]" },
  { value: "in-progress", label: "قيد", active: "bg-state-inprogress/25 text-state-inprogress ring-state-inprogress/60 shadow-[0_0_18px_-5px_rgba(87,117,168,0.85)]" },
  { value: "completed", label: "منجزة", active: "bg-state-completed/25 text-state-completed ring-state-completed/60 shadow-[0_0_18px_-5px_rgba(94,151,122,0.85)]" },
  { value: "withdrawn", label: "مسحوبة", active: "bg-state-withdrawn/25 text-state-withdrawn ring-state-withdrawn/60 shadow-[0_0_18px_-5px_rgba(181,97,106,0.85)]" },
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

export function LicensesPanel({
  status,
  setStatus,
}: {
  status: string;
  setStatus: (s: string) => void;
}) {
  const { data, isLoading, isError, refetch } = useTable<License>("licenses");
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [visitsFor, setVisitsFor] = useState<License | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const sectors = useMemo(() => distinct(all.map((o) => o.sector)), [all]);
  const sectorLabelOptions = useMemo(() => Array.from(new Set(sectors.map(sectorLabel))).sort(), [sectors]);
  const districts = useMemo(() => distinct(all.map((o) => o.district)), [all]);
  const subdistricts = useMemo(() => distinct(all.map((o) => o.subdistrict)), [all]);
  const neighborhoods = useMemo(() => distinct(all.map((o) => o.neighborhood)), [all]);
  const districtOptions = useMemo(
    () => Array.from(new Set([...NINEVEH_DISTRICTS, ...districts])).sort(),
    [districts],
  );
  const subdistrictOptions = useMemo(
    () => Array.from(new Set([...NINEVEH_SUBDISTRICTS, ...subdistricts])).sort(),
    [subdistricts],
  );
  const optionSets = useMemo(
    () => ({
      sector: sectors,
      project_type: distinct(all.map((o) => o.project_type)),
      district: districtOptions,
      subdistrict: subdistrictOptions,
      neighborhood: neighborhoods,
      muqataa_name: distinct(all.map((o) => o.muqataa_name)),
      land_right: distinct(all.map((o) => o.land_right)),
      investor_nationality: distinct(all.map((o) => o.investor_nationality)),
    }),
    [all, sectors, districtOptions, subdistrictOptions, neighborhoods],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const secNeedle = sector.trim();
    const dNeedle = district.trim().toLowerCase();
    const subNeedle = subdistrict.trim().toLowerCase();
    const nNeedle = neighborhood.trim().toLowerCase();
    return all.filter((o) => {
      if (status && o.status !== status) return false;
      if (secNeedle && !sectorLabel(o.sector).includes(secNeedle)) return false;
      if (dNeedle && !(o.district ?? "").toLowerCase().includes(dNeedle)) return false;
      if (subNeedle && !(o.subdistrict ?? "").toLowerCase().includes(subNeedle)) return false;
      if (nNeedle && !(o.neighborhood ?? "").toLowerCase().includes(nNeedle)) return false;
      if (needle) {
        const hay = `${o.title ?? ""} ${o.license_number ?? ""} ${o.owner ?? ""} ${o.investor_name ?? ""} ${o.parcel_no ?? ""} ${o.muqataa_name ?? ""} ${o.subdistrict ?? ""} ${o.neighborhood ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, status, sector, district, subdistrict, neighborhood]);

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
  const hasFilters = Boolean(q || sector || district || subdistrict || neighborhood || status);
  function clearFilters() {
    setQ("");
    setSector("");
    setDistrict("");
    setSubdistrict("");
    setNeighborhood("");
    setStatus("");
  }
  const { data: settingsData } = useSettings();
  const exportFormat = settingsData?.settings.default_export ?? "pdf";
  async function onExport() {
    const rows = selected.size ? filtered.filter((o) => selected.has(o.record_id)) : filtered;
    const ok = await exportTable(exportFormat, "licenses.csv", "تقرير الرخص الاستثمارية", rows as unknown as Record<string, unknown>[], [...LICENSE_EXPORT_COLUMNS]);
    if (!ok) toast.error("تعذّر تصدير الـPDF — حاول مجدداً");
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
        {/* التصفيات الأربع (§هـ.1) — متساوية ومبهرة؛ العدّادات في دوائر عائمة بجانب السايدبار */}
        <div className="grid grid-cols-4 gap-1.5">
          {STATUS_TABS.map((t) => {
            const isActive = status === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatus(t.value)}
                className={cn(
                  "rounded-lg px-2 py-2.5 text-xs font-bold ring-1 ring-inset transition",
                  isActive
                    ? t.active
                    : "bg-secondary/40 text-muted-foreground ring-border/40 shadow-[0_2px_6px_-3px_rgba(0,0,0,0.5)] hover:bg-accent hover:text-foreground",
                )}
              >
                {t.label}
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
        {/* تصفية متقدّمة (٤ حقول): قطاع · قضاء · ناحية · حي — combobox أنيق */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          <FilterCombo value={sector} onChange={setSector} options={sectorLabelOptions} placeholder="قطاع" />
          <FilterCombo value={district} onChange={setDistrict} options={districtOptions} placeholder="قضاء" />
          <FilterCombo value={subdistrict} onChange={setSubdistrict} options={subdistrictOptions} placeholder="ناحية" />
          <FilterCombo value={neighborhood} onChange={setNeighborhood} options={neighborhoods} placeholder="حي" />
        </div>
        {/* ثلاث دوائر إجراء متساوية متقاربة بصفّ واحد: تصدير (يمين) · إضافة (وسط) · تحديد الكل (يسار) */}
        <div className="relative flex items-center justify-center gap-3 pt-1">
          <span className="absolute start-0 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {filtered.length}/{all.length}{selected.size ? ` · ${selected.size}` : ""}
          </span>
          <button type="button" onClick={() => void onExport()} title={`تصدير ${exportFormat === "pdf" ? "PDF" : "CSV"}`} aria-label="تصدير" className={cn(ORB, "size-12")}>
            <Download className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            title="إضافة رخصة"
            aria-label="إضافة رخصة"
            className={cn(ORB, "size-12")}
          >
            <Plus className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggleAll}
            title={allFilteredSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
            aria-label="تحديد/إلغاء تحديد الكل"
            className={cn(ORB, "size-12")}
          >
            {allFilteredSelected ? <CheckCheck className="size-4" /> : <ListChecks className="size-4" />}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            title="مسح التصفية (عودة للكل)"
            aria-label="مسح التصفية"
            className={cn(ORB, "size-12", !hasFilters && "opacity-40")}
          >
            <FilterX className="size-4" />
          </button>
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
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
                className="group relative overflow-hidden rounded-xl [content-visibility:auto] [contain-intrinsic-size:auto_120px] border border-foreground/30 ring-1 ring-inset ring-foreground/10 bg-gradient-to-br from-card/85 via-card/55 to-card/35 shadow-sm transition-all duration-200 hover:border-foreground/50 hover:ring-foreground/20 hover:shadow-[0_12px_34px_-14px] hover:shadow-foreground/10"
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
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(o.record_id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(o.record_id); } }}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 py-2.5 text-start"
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
                      <LiveLocationButton onClick={() => requestFlyTo(o.parcel_no ?? "")} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisitsFor(o);
                        }}
                        title="سجلّ الزيارات"
                        aria-label="سجلّ الزيارات"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white shadow-sm ring-1 ring-inset ring-white/30 transition hover:scale-105 hover:bg-white/25 hover:ring-white/50 active:scale-95"
                      >
                        <ClipboardList className="size-3.5" />
                      </button>
                      <span className="ms-auto">
                        <StateBadge state={o.status} />
                      </span>
                    </div>
                  </div>
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
                      <Cell icon={Landmark} label="القضاء" value={orNA(o.district)} />
                      <Cell icon={MapPinned} label="الناحية" value={orNA(o.subdistrict)} />
                      <Cell icon={Home} label="الحي/المنطقة" value={orNA(o.neighborhood)} />
                      <Cell icon={Building2} label="المقاطعة" value={orNA(o.muqataa_no)} />
                      <Cell icon={Ruler} label="المساحة الكلية" value={formatArea(o.area_total_m2)} />
                      <Cell icon={User} label="العائدية" value={orNA(o.owner)} />
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2.5">
                      <Button size="sm" variant="outline" onClick={() => requestOpenParcelDetail({ kind: "license", id: String(o.record_id), readOnly: true })} title="عرض التفاصيل">
                        <Eye className="size-3.5" /> عرض
                      </Button>
                      {o.parcel_no ? (
                        <Button size="sm" variant="outline" onClick={() => { if (o.parcel_no) requestStartDraw({ parcel_no: o.parcel_no, muqataa_no: o.muqataa_no, label: o.title ?? o.license_number ?? "القطعة" }); }} title="ارسم حدودها واربطها على الخريطة">
                          <PenTool className="size-3.5" /> ارسم
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => requestOpenParcelDetail({ kind: "license", id: String(o.record_id), readOnly: false })} title="تعديل">
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
      <Dialog
        open={visitsFor !== null}
        onClose={() => setVisitsFor(null)}
        title={`سجلّ الزيارات — ${visitsFor?.title ?? visitsFor?.license_number ?? "رخصة"}`}
        size="lg"
      >
        {visitsFor ? <VisitsLog parcelRef={String(visitsFor.record_id)} /> : null}
      </Dialog>
    </div>
  );
}
