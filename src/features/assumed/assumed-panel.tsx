"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  CheckCheck,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FilterX,
  Home,
  Landmark,
  ListChecks,
  MapPinned,
  Pencil,
  Plus,
  Ruler,
  Scale,
  Tag,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { useSettings } from "@/features/settings/use-settings";
import { cn } from "@/lib/utils";
import { exportTable } from "@/lib/export-table";
import { exportParcelPdf } from "@/lib/export-parcel-pdf";
import { formatArea, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import { NINEVEH_DISTRICTS, NINEVEH_SUBDISTRICTS } from "@/lib/nineveh-geo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterCombo } from "@/components/ui/filter-combo";
import { LiveLocationButton } from "@/components/ui/live-location-button";
import { StateBadge } from "@/features/parcels/state-badge";
import { AssumedForm } from "./assumed-form";
import { deleteAssumed } from "./actions";
import { requestFlyTo, requestOpenParcelDetail } from "@/features/map/lib/map-nav-store";
import { ASSUMED_EXPORT_COLUMNS } from "./fields";
import type { AssumedParcel } from "@/types/entities";

const distinct = (values: (string | null)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

const ORB =
  "relative grid place-items-center rounded-full text-foreground bg-[radial-gradient(circle_at_50%_28%,#4f6498,#2a3a5c)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.32),0_10px_22px_-8px_rgba(0,0,0,0.7)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_15px_28px_-8px_rgba(0,0,0,0.85)] active:translate-y-0 active:scale-95";

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

export function AssumedPanel() {
  const { data, isLoading, isError, refetch } = useTable<AssumedParcel>("assumed_parcels");
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssumedParcel | null>(null);

  const all = useMemo(() => [...(data ?? [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")), [data]); // الأحدث أولاً (افتراضي معتمد)
  const { data: fo } = useFieldOptions(); // القاموس الموحّد (م7.7) — نفس القيم في كل منسدلات النظام
  const sectors = useMemo(() => distinct([...all.map((o) => o.sector), ...(fo?.sector ?? [])]), [all, fo]);
  const sectorLabelOptions = useMemo(() => Array.from(new Set(sectors.map(sectorLabel))).sort(), [sectors]);
  const districts = useMemo(() => distinct([...all.map((o) => o.district), ...(fo?.district ?? [])]), [all, fo]);
  const subdistricts = useMemo(() => distinct([...all.map((o) => o.subdistrict), ...(fo?.subdistrict ?? [])]), [all, fo]);
  const neighborhoods = useMemo(() => distinct([...all.map((o) => o.neighborhood), ...(fo?.neighborhood ?? [])]), [all, fo]);
  const districtOptions = useMemo(() => Array.from(new Set([...NINEVEH_DISTRICTS, ...districts])).sort(), [districts]);
  const subdistrictOptions = useMemo(() => Array.from(new Set([...NINEVEH_SUBDISTRICTS, ...subdistricts])).sort(), [subdistricts]);

  const optionSets = useMemo(
    () => ({
      sector: sectors,
      district: districtOptions,
      subdistrict: subdistrictOptions,
      neighborhood: neighborhoods,
      muqataa_name: distinct([...all.map((o) => o.muqataa_name), ...(fo?.muqataa_name ?? [])]),
      land_right: distinct([...all.map((o) => o.land_right), ...(fo?.land_right ?? [])]),
    }),
    [all, fo, sectors, districtOptions, subdistrictOptions, neighborhoods],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const secNeedle = sector.trim();
    const dNeedle = district.trim().toLowerCase();
    const subNeedle = subdistrict.trim().toLowerCase();
    const nNeedle = neighborhood.trim().toLowerCase();
    return all.filter((o) => {
      if (secNeedle && !sectorLabel(o.sector).includes(secNeedle)) return false;
      if (dNeedle && !(o.district ?? "").toLowerCase().includes(dNeedle)) return false;
      if (subNeedle && !(o.subdistrict ?? "").toLowerCase().includes(subNeedle)) return false;
      if (nNeedle && !(o.neighborhood ?? "").toLowerCase().includes(nNeedle)) return false;
      if (needle) {
        const hay = `${o.parcel_no ?? ""} ${o.owner ?? ""} ${o.muqataa_name ?? ""} ${o.subdistrict ?? ""} ${o.neighborhood ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, sector, district, subdistrict, neighborhood]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((o) => o.id)));
  }
  const hasFilters = Boolean(q || sector || district || subdistrict || neighborhood);
  function clearFilters() {
    setQ("");
    setSector("");
    setDistrict("");
    setSubdistrict("");
    setNeighborhood("");
  }
  const { data: settingsData } = useSettings();
  const exportFormat = settingsData?.settings.default_export ?? "pdf";
  async function onExport() {
    const rows = selected.size ? filtered.filter((o) => selected.has(o.id)) : filtered;
    const ok = await exportTable(exportFormat, "assumed_parcels.csv", "تقرير الفرص المفترضة", rows as unknown as Record<string, unknown>[], [...ASSUMED_EXPORT_COLUMNS]);
    if (!ok) toast.error("تعذّر تصدير الـPDF — حاول مجدداً");
  }
  async function onDelete(o: AssumedParcel) {
    if (!window.confirm(`حذف القطعة المفترضة «${o.parcel_no ?? "بلا رقم"}»؟`)) return;
    const res = await deleteAssumed(o.id);
    if (res.ok) {
      toast.success("حُذِفت القطعة المفترضة");
      void queryClient.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (قطعة/مالك/مقاطعة)…"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {/* تصفية متقدّمة (٤ حقول): قطاع · قضاء · ناحية · حي — combobox أنيق */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          <FilterCombo value={sector} onChange={setSector} options={sectorLabelOptions} placeholder="قطاع" />
          <FilterCombo value={district} onChange={setDistrict} options={districtOptions} placeholder="قضاء" />
          <FilterCombo value={subdistrict} onChange={setSubdistrict} options={subdistrictOptions} placeholder="ناحية" />
          <FilterCombo value={neighborhood} onChange={setNeighborhood} options={neighborhoods} placeholder="حي" />
        </div>
        {/* ثلاث دوائر إجراء: تصدير · إضافة · تحديد الكل */}
        <div className="relative flex items-center justify-center gap-3 pt-1">
          <span className="absolute start-0 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {filtered.length}/{all.length}{selected.size ? ` · ${selected.size}` : ""}
          </span>
          <button type="button" onClick={() => void onExport()} title={`تصدير ${exportFormat === "pdf" ? "PDF" : "CSV"}`} aria-label="تصدير" className={cn(ORB, "size-12")}>
            <Download className="size-4" />
          </button>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} title="قطعة مفترضة جديدة" aria-label="قطعة مفترضة جديدة" className={cn(ORB, "size-12")}>
            <Plus className="size-5" />
          </button>
          <button type="button" onClick={toggleAll} title={allFilteredSelected ? "إلغاء تحديد الكل" : "تحديد الكل"} aria-label="تحديد/إلغاء تحديد الكل" className={cn(ORB, "size-12")}>
            {allFilteredSelected ? <CheckCheck className="size-4" /> : <ListChecks className="size-4" />}
          </button>
          <button type="button" onClick={clearFilters} disabled={!hasFilters} title="مسح التصفية (عودة للكل)" aria-label="مسح التصفية" className={cn(ORB, "size-12", !hasFilters && "opacity-40")}>
            <FilterX className="size-4" />
          </button>
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : null}

        {isError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">تعذّر تحميل البيانات.</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>إعادة المحاولة</Button>
          </div>
        ) : null}

        {!isLoading && !isError && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا فرص مفترضة بعد — أضِف قطعة مفترضة (وتُرسَم حدودها على الخريطة لاحقاً).</p>
        ) : null}

        <ul className="space-y-2.5">
          {filtered.map((o) => {
            const isOpen = expanded.has(o.id);
            const title = o.name ?? (o.parcel_no ? `القطعة ${o.parcel_no}` : "قطعة مفترضة");
            return (
              <li
                key={o.id}
                className="group relative overflow-hidden rounded-xl [content-visibility:auto] [contain-intrinsic-size:auto_120px] border border-foreground/30 ring-1 ring-inset ring-foreground/10 bg-gradient-to-br from-card/85 via-card/55 to-card/35 shadow-sm transition-all duration-200 hover:border-foreground/50 hover:ring-foreground/20 hover:shadow-[0_12px_34px_-14px] hover:shadow-foreground/10"
              >
                <span className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-state-assumed to-state-assumed/20" aria-hidden />

                <div className="flex items-start gap-2 ps-4 pe-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 size-4 shrink-0 cursor-pointer accent-state-assumed"
                    aria-label="تحديد"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(o.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(o.id); } }}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 py-2.5 text-start"
                  >
                    <div className="flex w-full items-start gap-2">
                      <h4 className={cn("min-w-0 flex-1 text-[15px] font-semibold leading-snug", isOpen ? "line-clamp-2" : "truncate")}>
                        {title}
                      </h4>
                      <LiveLocationButton onClick={() => requestFlyTo(o.id)} />
                      <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
                    </div>
                    <div className="flex w-full items-center gap-2">
                      {o.sector ? <Chip icon={Tag} value={sectorLabel(o.sector)} /> : null}
                      <span className="ms-auto">
                        <StateBadge state="assumed" />
                      </span>
                    </div>
                  </div>
                </div>

                {isOpen ? (
                  <div className="px-3.5 pb-3.5 ps-4">
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Cell icon={Building2} label="المقاطعة" value={orNA(o.muqataa_no)} />
                      <Cell icon={Landmark} label="القضاء" value={orNA(o.district)} />
                      <Cell icon={MapPinned} label="الناحية" value={orNA(o.subdistrict)} />
                      <Cell icon={Home} label="الحي/المنطقة" value={orNA(o.neighborhood)} />
                      <Cell icon={Ruler} label="المساحة" value={formatArea(o.area_m2)} />
                      <Cell icon={Banknote} label="القيمة" value={o.value === null ? orNA(null) : formatNumber(o.value)} />
                      <Cell icon={User} label="العائدية" value={orNA(o.owner)} />
                      <Cell icon={Scale} label="نوع الحقّ" value={orNA(o.land_right)} />
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2.5">
                      <Button size="sm" variant="outline" onClick={() => requestOpenParcelDetail({ kind: "assumed", id: o.id, readOnly: true })} title="عرض التفاصيل">
                        <Eye className="size-3.5" /> عرض
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => requestOpenParcelDetail({ kind: "assumed", id: o.id, readOnly: false })} title="تعديل">
                        <Pencil className="size-3.5" /> تعديل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void exportParcelPdf("assumed", o.id, o.name ?? o.parcel_no)} title="تصدير بطاقة القطعة PDF">
                        <FileText className="size-3.5" /> PDF
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

      <AssumedForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} optionSets={optionSets} />
    </div>
  );
}
