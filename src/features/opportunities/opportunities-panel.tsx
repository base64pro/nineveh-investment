"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Download,
  Eye,
  Home,
  MapPin,
  Pencil,
  Plus,
  Ruler,
  Tag,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { exportCsv } from "@/lib/export-csv";
import { formatArea, orNA } from "@/lib/display";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/features/parcels/state-badge";
import { OpportunityForm } from "./opportunity-form";
import { OpportunityDetail } from "./opportunity-detail";
import { deleteOpportunity } from "./actions";
import { OPPORTUNITY_EXPORT_COLUMNS } from "./fields";
import type { Opportunity } from "@/types/entities";

const isAvailable = (o: Opportunity): boolean => !(Array.isArray(o.license_ref) && o.license_ref.length > 0);
const distinct = (values: (string | null)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

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

export function OpportunitiesPanel() {
  const { data, isLoading, isError, refetch } = useTable<Opportunity>("opportunities");
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [muqataa, setMuqataa] = useState("");
  const [oppStatus, setOppStatus] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [detail, setDetail] = useState<Opportunity | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const sectors = useMemo(() => distinct(all.map((o) => o.sector)), [all]);
  const districts = useMemo(() => distinct(all.map((o) => o.district)), [all]);
  const muqataas = useMemo(() => distinct(all.map((o) => o.muqataa_no)), [all]);
  const neighborhoods = useMemo(() => distinct(all.map((o) => o.neighborhood)), [all]);
  const statuses = useMemo(() => distinct(all.map((o) => o.opp_status)), [all]);
  const availableCount = useMemo(() => all.filter(isAvailable).length, [all]);

  const optionSets = useMemo(
    () => ({
      sector: sectors,
      project_type: distinct(all.map((o) => o.project_type)),
      district: districts,
      neighborhood: neighborhoods,
      muqataa_name: distinct(all.map((o) => o.muqataa_name)),
      announcement_type: distinct(all.map((o) => o.announcement_type)),
      opp_status: statuses,
    }),
    [all, sectors, districts, neighborhoods, statuses],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((o) => {
      if (sector && o.sector !== sector) return false;
      if (district && o.district !== district) return false;
      if (neighborhood && o.neighborhood !== neighborhood) return false;
      if (muqataa && o.muqataa_no !== muqataa) return false;
      if (oppStatus && o.opp_status !== oppStatus) return false;
      if (availableOnly && !isAvailable(o)) return false;
      if (needle) {
        const hay = `${o.title ?? ""} ${o.parcel_no ?? ""} ${o.owner ?? ""} ${o.muqataa_name ?? ""} ${o.neighborhood ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, sector, district, neighborhood, muqataa, oppStatus, availableOnly]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.record_id));

  function toggleOne(id: number) {
    setSelected((prev) => {
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
    exportCsv("opportunities.csv", rows as unknown as Record<string, unknown>[], [...OPPORTUNITY_EXPORT_COLUMNS]);
  }
  async function onDelete(o: Opportunity) {
    if (!window.confirm(`حذف الفرصة «${o.title ?? "بلا عنوان"}»؟`)) return;
    const res = await deleteOpportunity(o.record_id);
    if (res.ok) {
      toast.success("حُذِفت الفرصة");
      void queryClient.invalidateQueries({ queryKey: ["table", "opportunities"] });
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
          placeholder="بحث (عنوان/قطعة/مالك/مقاطعة)…"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {/* فلترة متقدّمة (§ب.2.6): قطاع · قضاء · مقاطعة · حالة الإعلان · متاحة */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل القطاعات</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل الأقضية</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل الأحياء</option>
            {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={muqataa} onChange={(e) => setMuqataa(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل المقاطعات</option>
            {muqataas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={oppStatus} onChange={(e) => setOppStatus(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">كل حالات الإعلان</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="size-3.5" />
            المتاحة فقط
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} title="إضافة فرصة">
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
            متاحة {availableCount} · معروض {filtered.length}/{all.length}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
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
          {filtered.map((o) => (
            <li
              key={o.record_id}
              className="group relative overflow-hidden rounded-xl border border-border/80 ring-1 ring-inset ring-foreground/5 bg-gradient-to-br from-card/85 via-card/55 to-card/35 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-state-announced/50 hover:ring-state-announced/20 hover:shadow-[0_12px_34px_-14px] hover:shadow-state-announced/40"
            >
              {/* شريط الحالة الجانبي (معلَنة) */}
              <span
                className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-state-announced to-state-announced/20"
                aria-hidden
              />
              <div className="p-3.5 ps-4">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(o.record_id)}
                    onChange={() => toggleOne(o.record_id)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-state-announced"
                    aria-label="تحديد"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="line-clamp-2 text-[15px] font-semibold leading-snug">{orNA(o.title)}</h4>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isAvailable(o) ? (
                          <span className="rounded-full bg-state-completed/15 px-2 py-0.5 text-[10px] font-medium text-state-completed ring-1 ring-state-completed/40 shadow-[0_0_10px_-2px] shadow-state-completed/50">
                            متاحة
                          </span>
                        ) : null}
                        <StateBadge state="announced" />
                      </div>
                    </div>

                    {o.sector || o.neighborhood ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {o.sector ? <Chip icon={Tag} value={o.sector} /> : null}
                        {o.neighborhood ? <Chip icon={Home} value={o.neighborhood} /> : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Cell icon={MapPin} label="القطعة" value={orNA(o.parcel_no)} />
                  <Cell icon={Building2} label="المقاطعة" value={orNA(o.muqataa_no)} />
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
            </li>
          ))}
        </ul>
      </div>

      <OpportunityForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} optionSets={optionSets} />
      <OpportunityDetail open={detail !== null} onClose={() => setDetail(null)} opportunity={detail} />
    </div>
  );
}
