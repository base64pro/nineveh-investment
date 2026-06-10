"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  Briefcase,
  Building2,
  CheckCheck,
  ChevronDown,
  Download,
  Eye,
  FilterX,
  Globe,
  Hash,
  Landmark,
  ListChecks,
  Mail,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { useSettings } from "@/features/settings/use-settings";
import { cn } from "@/lib/utils";
import { exportTable } from "@/lib/export-table";
import { orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { sectorLabel } from "@/lib/sectors";
import { governorateLabel } from "@/lib/governorates";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterCombo } from "@/components/ui/filter-combo";
import { Combo } from "@/components/ui/combo";
import { onOpenCompany } from "@/features/shell/shell-store";
import { CompanyForm } from "./company-form";
import { CompanyDetail } from "./company-detail";
import { deleteCompany } from "./actions";
import { COMPANY_EXPORT_COLUMNS, isEligible } from "./fields";
import type { Company } from "@/types/entities";

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

export function CompaniesPanel() {
  const { data, isLoading, isError, refetch } = useTable<Company>("companies");
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [activity, setActivity] = useState("");
  const [elig, setElig] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [detail, setDetail] = useState<Company | null>(null);

  // فتح تفاصيل شركة بعينها من البحث الفائق (§هـ.2.ج «فتح بياناته») — يصمد أمام تأخّر تحميل البيانات
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  useEffect(() => onOpenCompany(setOpenCompanyId), []);
  useEffect(() => {
    if (!openCompanyId || !data) return;
    const c = data.find((x) => x.id === openCompanyId);
    if (c) setDetail(c);
    setOpenCompanyId(null);
  }, [openCompanyId, data]);

  const all = useMemo(() => data ?? [], [data]);
  const sectors = useMemo(() => distinct(all.map((o) => o.sector)), [all]);
  const sectorLabelOptions = useMemo(() => Array.from(new Set(sectors.map(sectorLabel))).sort(), [sectors]);
  const companyTypes = useMemo(() => distinct(all.map((o) => o.company_type)), [all]);
  const activities = useMemo(() => distinct(all.map((o) => o.activity)), [all]);
  const govLabelOptions = useMemo(
    () => Array.from(new Set(distinct(all.map((o) => o.governorate)).map(governorateLabel))).sort(),
    [all],
  );

  const optionSets = useMemo(
    () => ({
      sector: sectors,
      company_type: companyTypes,
      activity: activities,
      governorate: distinct(all.map((o) => o.governorate)),
    }),
    [all, sectors, companyTypes, activities],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const secNeedle = sector.trim();
    const typeNeedle = companyType.trim().toLowerCase();
    const govNeedle = governorate.trim();
    const actNeedle = activity.trim().toLowerCase();
    return all.filter((o) => {
      if (secNeedle && !sectorLabel(o.sector).includes(secNeedle)) return false;
      if (typeNeedle && !(o.company_type ?? "").toLowerCase().includes(typeNeedle)) return false;
      if (govNeedle && !governorateLabel(o.governorate).includes(govNeedle)) return false;
      if (actNeedle && !(o.activity ?? "").toLowerCase().includes(actNeedle)) return false;
      if (elig === "eligible" && !isEligible(o)) return false;
      if (elig === "excluded" && !o.is_excluded) return false;
      if (elig === "non_excluded" && o.is_excluded) return false;
      if (needle) {
        const hay = `${o.name ?? ""} ${o.registration_no ?? ""} ${o.manager ?? ""} ${o.activity ?? ""} ${o.company_type ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, sector, companyType, governorate, activity, elig]);

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
  const hasFilters = Boolean(q || sector || companyType || governorate || activity || elig);
  function clearFilters() {
    setQ("");
    setSector("");
    setCompanyType("");
    setGovernorate("");
    setActivity("");
    setElig("");
  }
  const { data: settingsData } = useSettings();
  const exportFormat = settingsData?.settings.default_export ?? "pdf";
  async function onExport() {
    const rows = selected.size ? filtered.filter((o) => selected.has(o.id)) : filtered;
    const ok = await exportTable(exportFormat, "companies.csv", "تقرير الشركات", rows as unknown as Record<string, unknown>[], [...COMPANY_EXPORT_COLUMNS]);
    if (!ok) toast.error("تعذّر تصدير الـPDF — حاول مجدداً");
  }
  async function onDelete(o: Company) {
    if (!window.confirm(`حذف الشركة «${o.name}»؟`)) return;
    const res = await deleteCompany(o.id);
    if (res.ok) {
      toast.success("حُذِفت الشركة");
      void queryClient.invalidateQueries({ queryKey: ["table", "companies"] });
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
          placeholder="بحث (اسم/رقم قيد/مدير/نشاط)…"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {/* تصفية متقدّمة (٤ حقول): قطاع · نوع · محافظة · نشاط — combobox أنيق */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          <FilterCombo value={sector} onChange={setSector} options={sectorLabelOptions} placeholder="قطاع" />
          <FilterCombo value={companyType} onChange={setCompanyType} options={companyTypes} placeholder="نوع" />
          <FilterCombo value={governorate} onChange={setGovernorate} options={govLabelOptions} placeholder="محافظة" />
          <FilterCombo value={activity} onChange={setActivity} options={activities} placeholder="نشاط" />
        </div>
        {/* صفّ الإجراءات: العدّاد + الأهلية + ثلاث دوائر */}
        <div className="relative flex items-center justify-center gap-3 pt-1">
          <span className="absolute start-0 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {filtered.length}/{all.length}{selected.size ? ` · ${selected.size}` : ""}
          </span>
          <button type="button" onClick={() => void onExport()} title={`تصدير ${exportFormat === "pdf" ? "PDF" : "CSV"}`} aria-label="تصدير" className={cn(ORB, "size-12")}>
            <Download className="size-4" />
          </button>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} title="إضافة شركة" aria-label="إضافة شركة" className={cn(ORB, "size-12")}>
            <Plus className="size-5" />
          </button>
          <button type="button" onClick={toggleAll} title={allFilteredSelected ? "إلغاء تحديد الكل" : "تحديد الكل"} aria-label="تحديد/إلغاء تحديد الكل" className={cn(ORB, "size-12")}>
            {allFilteredSelected ? <CheckCheck className="size-4" /> : <ListChecks className="size-4" />}
          </button>
          <button type="button" onClick={clearFilters} disabled={!hasFilters} title="مسح التصفية (عودة للكل)" aria-label="مسح التصفية" className={cn(ORB, "size-12", !hasFilters && "opacity-40")}>
            <FilterX className="size-4" />
          </button>
          <div className="absolute end-0 top-1/2 w-28 -translate-y-1/2" title="تصفية الأهلية">
            <Combo
              value={elig}
              onChange={setElig}
              options={[
                { value: "", label: "كل الأهلية" },
                { value: "eligible", label: "مؤهّلة" },
                { value: "non_excluded", label: "غير مستثناة" },
                { value: "excluded", label: "مستثناة" },
              ]}
              ariaLabel="تصفية الأهلية"
            />
          </div>
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
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
            const isOpen = expanded.has(o.id);
            const accent = o.is_excluded
              ? "from-state-withdrawn to-state-withdrawn/20"
              : isEligible(o)
                ? "from-state-completed to-state-completed/20"
                : "from-[rgba(148,175,209,0.6)] to-[rgba(148,175,209,0.1)]";
            return (
              <li
                key={o.id}
                className="group relative overflow-hidden rounded-xl border border-foreground/30 ring-1 ring-inset ring-foreground/10 bg-gradient-to-br from-card/85 via-card/55 to-card/35 shadow-sm transition-all duration-200 hover:border-foreground/50 hover:ring-foreground/20 hover:shadow-[0_12px_34px_-14px] hover:shadow-foreground/10"
              >
                <span className={cn("absolute inset-y-0 start-0 w-1 bg-gradient-to-b", accent)} aria-hidden />

                <div className="flex items-start gap-2 ps-4 pe-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 size-4 shrink-0 cursor-pointer accent-state-completed"
                    aria-label="تحديد"
                  />
                  <button
                    type="button"
                    onClick={() => toggleExpand(o.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 flex-col gap-1.5 py-2.5 text-start"
                  >
                    <div className="flex w-full items-start gap-2">
                      <h4 className={cn("min-w-0 flex-1 text-[15px] font-semibold leading-snug", isOpen ? "line-clamp-2" : "truncate")}>
                        {orNA(o.name)}
                      </h4>
                      <ChevronDown
                        className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
                        aria-hidden
                      />
                    </div>
                    <div className="flex w-full items-center gap-2">
                      {o.sector ? <Chip icon={Tag} value={sectorLabel(o.sector)} /> : null}
                      {o.is_excluded ? (
                        <span className="ms-auto rounded-full bg-state-withdrawn/15 px-2 py-0.5 text-[10px] font-medium text-state-withdrawn ring-1 ring-state-withdrawn/40">مستثناة</span>
                      ) : isEligible(o) ? (
                        <span className="ms-auto rounded-full bg-state-completed/15 px-2 py-0.5 text-[10px] font-medium text-state-completed ring-1 ring-state-completed/40">مؤهّلة</span>
                      ) : null}
                    </div>
                  </button>
                </div>

                {isOpen ? (
                  <div className="px-3.5 pb-3.5 ps-4">
                    {o.phone || o.email || o.website ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {o.phone ? <Chip icon={Phone} value={o.phone} /> : null}
                        {o.email ? <Chip icon={Mail} value={o.email} /> : null}
                        {o.website ? <Chip icon={Globe} value={o.website} /> : null}
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Cell icon={Building2} label="نوع الشركة" value={orNA(o.company_type)} />
                      <Cell icon={Briefcase} label="النشاط" value={orNA(o.activity)} />
                      <Cell icon={Hash} label="رقم القيد" value={orNA(o.registration_no)} />
                      <Cell icon={Landmark} label="المحافظة" value={governorateLabel(o.governorate)} />
                      <Cell icon={User} label="المدير" value={orNA(o.manager)} />
                      <Cell icon={Banknote} label="رأس المال ($)" value={o.capital_usd === null ? orNA(null) : formatNumber(o.capital_usd)} />
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

      <CompanyForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} optionSets={optionSets} />
      <CompanyDetail open={detail !== null} onClose={() => setDetail(null)} company={detail} />
    </div>
  );
}
