"use client";

// م5.3 → م7.5 · التقارير الذكية المبهرة (§هـ.5) — **حتمية بالكامل** (أرقام من البيانات الفعلية، لا تأليف).
// KPI بعدّ متحرك + شرائط تقدّم · رسوم متوهّجة بدخول متدرّج · أعلى 5 (نقر ← السجلّ) · دلتا سنوية ·
// فلاتر لحظية · تصدير PDF بغلاف براندد ورسم داخل التقرير (أو CSV وفق الإعدادات).

import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, BarChart3, Building2, Coins, Crown, Download, FilterX, Layers, Ruler, TrendingUp } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { useSettings } from "@/features/settings/use-settings";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { formatArea, NOT_AVAILABLE } from "@/lib/display";
import { sectorCode, sectorLabel } from "@/lib/sectors";
import { exportTable, type ExportChart } from "@/lib/export-table";
import { Combo } from "@/components/ui/combo";
import { FilterCombo } from "@/components/ui/filter-combo";
import { ORB } from "@/components/ui/orb";
import { cn } from "@/lib/utils";
import { requestOpenCompany, requestOpenSection } from "@/features/shell/shell-store";
import { requestOpenParcelDetail } from "@/features/map/lib/map-nav-store";
import type { AssumedParcel, Company, License, Opportunity } from "@/types/entities";
import {
  applyFilters,
  bySector,
  byDistrict,
  byState,
  byYear,
  EMPTY_FILTERS,
  normalize,
  type ReportFilters,
  totals,
} from "./report-aggregations";
import { CategoryBar, StatePie, YearLine } from "./report-charts";
import { VisitsReport } from "./visits-report";

const STATE_META: Record<string, { label: string; color: string; section: string; status?: string }> = {
  announced: { label: "معلَنة", color: "#C7A24E", section: "opportunities" },
  "in-progress": { label: "قيد الإنجاز", color: "#5775A8", section: "licenses", status: "in-progress" },
  completed: { label: "منجزة", color: "#5E977A", section: "licenses", status: "completed" },
  withdrawn: { label: "مسحوبة", color: "#B5616A", section: "licenses", status: "withdrawn" },
  assumed: { label: "مفترضة", color: "#8B6FB0", section: "opportunity-design" },
};

const STATE_OPTIONS = [
  { value: "", label: "كل الحالات" },
  ...Object.entries(STATE_META).map(([value, m]) => ({ value, label: m.label })),
];

const distinct = (vals: (string | null)[]): string[] =>
  Array.from(new Set(vals.filter((v): v is string => Boolean(v)))).sort();

const cols = (keys: string[]) => keys.map((k) => ({ key: k, label: k }));

/** بطاقة KPI بعدّ متحرك. */
function Kpi({ icon: Icon, label, value, format, onClick }: { icon: typeof Ruler; label: string; value: number | null; format: (n: number) => string; onClick?: () => void }) {
  const display = useCountUp(value ?? 0);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-2.5 text-start transition",
        onClick ? "hover:border-foreground/40 hover:shadow-[0_8px_24px_-12px] hover:shadow-foreground/20 active:scale-[0.98]" : "cursor-default",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-inset ring-border/40 text-[#9fc0e8]">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-extrabold tabular-nums leading-none text-foreground">
          {value === null ? NOT_AVAILABLE : format(display)}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

/** بطاقة حالة بعدّ متحرك + شريط تقدّم نسبي. */
function StateCard({ stateKey, count, total, onClick }: { stateKey: string; count: number; total: number; onClick: () => void }) {
  const m = STATE_META[stateKey]!;
  const display = useCountUp(count);
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${m.label} — انتقل للمصدر`}
      className="flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-card/40 px-1 py-1.5 transition hover:bg-white/5 active:scale-95"
    >
      <span className="size-2 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px -1px ${m.color}` }} />
      <span className="text-sm font-bold tabular-nums text-foreground">{formatNumber(display)}</span>
      <span className="text-[8px] leading-none text-muted-foreground">{m.label}</span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-white/8">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: m.color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </span>
    </button>
  );
}

function Section({ icon: Icon, title, children, extra }: { icon: typeof Ruler; title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-xl border border-border/60 bg-background/30 p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
          <Icon className="size-3.5" /> {title}
        </h4>
        {extra}
      </div>
      {children}
    </motion.section>
  );
}

// تبويبا التقارير (م7.9): التحليلات · تقارير الزيارات
function ReportsTabs({ view, onView }: { view: "analytics" | "visits"; onView: (v: "analytics" | "visits") => void }) {
  const TAB = "flex-1 rounded-xl py-1.5 text-xs font-bold transition active:scale-[0.98]";
  return (
    <div className="shrink-0 border-b border-border/60 p-2">
      <div className="flex gap-1 rounded-2xl bg-background/40 p-1 ring-1 ring-inset ring-border/50">
        <button
          type="button"
          onClick={() => onView("analytics")}
          className={cn(TAB, view === "analytics" ? "bg-primary/20 text-primary ring-1 ring-inset ring-primary/40 shadow-[0_0_14px_-5px_rgba(148,175,209,0.9)]" : "text-muted-foreground hover:bg-white/6 hover:text-foreground")}
        >
          لوحة التحليلات
        </button>
        <button
          type="button"
          onClick={() => onView("visits")}
          className={cn(TAB, view === "visits" ? "bg-primary/20 text-primary ring-1 ring-inset ring-primary/40 shadow-[0_0_14px_-5px_rgba(148,175,209,0.9)]" : "text-muted-foreground hover:bg-white/6 hover:text-foreground")}
        >
          تقارير الزيارات
        </button>
      </div>
    </div>
  );
}

export function ReportsPanel() {
  const { data: oppsData } = useTable<Opportunity>("opportunities");
  const { data: licsData } = useTable<License>("licenses");
  const { data: asmData } = useTable<AssumedParcel>("assumed_parcels");
  const { data: compData } = useTable<Company>("companies");

  const [view, setView] = useState<"analytics" | "visits">("analytics");
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const all = useMemo(() => normalize(oppsData ?? [], licsData ?? [], asmData ?? []), [oppsData, licsData, asmData]);
  const sectorOptions = useMemo(() => Array.from(new Set(distinct(all.map((r) => r.sector)).map(sectorLabel))).sort(), [all]);
  const { data: fo } = useFieldOptions(); // القاموس الموحّد (م7.7)
  const districtOptions = useMemo(() => distinct([...all.map((r) => r.district), ...(fo?.district ?? [])]), [all, fo]);
  const yearOptions = useMemo(() => distinct(all.map((r) => r.year)), [all]);

  const applied = useMemo<ReportFilters>(
    () => ({ ...filters, sector: filters.sector ? (sectorCode(filters.sector) ?? filters.sector) : "" }),
    [filters],
  );
  const recs = useMemo(() => applyFilters(all, applied), [all, applied]);
  const t = useMemo(() => totals(recs), [recs]);

  const pieData = useMemo(
    () => byState(recs).map((s) => ({ state: s.state, label: STATE_META[s.state]?.label ?? s.state, count: s.count, color: STATE_META[s.state]?.color ?? "#5775A8" })),
    [recs],
  );
  const sectorData = useMemo(() => bySector(recs).slice(0, 8).map((g) => ({ label: sectorLabel(g.key), count: g.count })), [recs]);
  const districtData = useMemo(() => byDistrict(recs).slice(0, 8).map((g) => ({ label: g.key, count: g.count })), [recs]);
  const yearData = useMemo(() => byYear(recs), [recs]);

  // دلتا سنوية حتمية: مجموع (فرص+رخص) آخر سنة مقابل التي قبلها
  const yearDelta = useMemo(() => {
    if (yearData.length < 2) return null;
    const last = yearData[yearData.length - 1]!;
    const prev = yearData[yearData.length - 2]!;
    const a = last.opportunities + last.licenses;
    const b = prev.opportunities + prev.licenses;
    return { year: last.year, prevYear: prev.year, delta: a - b };
  }, [yearData]);

  // أعلى 5 (حتمية): رخص برأس المال · شركات برأس المال — النقر يفتح السجلّ
  const topLicenses = useMemo(
    () => (licsData ?? []).filter((l) => typeof l.capital === "number" && l.capital > 0).sort((a, b) => (b.capital ?? 0) - (a.capital ?? 0)).slice(0, 5),
    [licsData],
  );
  const topCompanies = useMemo(
    () => (compData ?? []).filter((c) => typeof c.capital_usd === "number" && c.capital_usd > 0).sort((a, b) => (b.capital_usd ?? 0) - (a.capital_usd ?? 0)).slice(0, 5),
    [compData],
  );

  const hasFilters = Boolean(filters.state || filters.sector || filters.district || filters.yearFrom || filters.yearTo);
  const set = (p: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...p }));

  const { data: settingsData } = useSettings();
  const exportFormat = settingsData?.settings.default_export ?? "pdf";
  async function doExport(csvName: string, title: string, rows: Record<string, unknown>[], keys: string[], chart?: ExportChart): Promise<void> {
    const ok = await exportTable(exportFormat, csvName, title, rows, cols(keys), chart);
    if (!ok) toast.error("تعذّر تصدير الـPDF — حاول مجدداً");
  }
  function exportParcels() {
    const rows = recs.map((r) => ({
      النوع: r.kind === "opportunity" ? "فرصة" : r.kind === "license" ? "رخصة" : "مفترضة",
      الحالة: STATE_META[r.state]?.label ?? r.state,
      القطاع: sectorLabel(r.sector),
      القضاء: r.district ?? "غير متوفّر",
      "المساحة م²": r.area,
      السنة: r.year ?? "غير متوفّر",
      القيمة: r.value,
    }));
    void doExport("تقرير-القطع.csv", "تقرير القطع", rows, ["النوع", "الحالة", "القطاع", "القضاء", "المساحة م²", "السنة", "القيمة"], {
      title: "توزيع الحالات",
      items: pieData.map((p) => ({ label: p.label, value: p.count })),
    });
  }
  function exportSectoral() {
    const g = bySector(recs);
    const rows = g.map((x) => ({ القطاع: sectorLabel(x.key), العدد: x.count, "المساحة م²": Math.round(x.area) }));
    void doExport("تقرير-قطاعي.csv", "التقرير القطاعي", rows, ["القطاع", "العدد", "المساحة م²"], {
      title: "التوزيع القطاعي (عدد القطع)",
      items: g.slice(0, 10).map((x) => ({ label: sectorLabel(x.key), value: x.count })),
    });
  }
  function exportSpatial() {
    const g = byDistrict(recs);
    const rows = g.map((x) => ({ القضاء: x.key, العدد: x.count, "المساحة م²": Math.round(x.area) }));
    void doExport("تقرير-مكاني.csv", "التقرير المكاني", rows, ["القضاء", "العدد", "المساحة م²"], {
      title: "التوزيع المكاني (عدد القطع)",
      items: g.slice(0, 10).map((x) => ({ label: x.key, value: x.count })),
    });
  }

  if (view === "visits") {
    return (
      <div className="flex h-full flex-col">
        <ReportsTabs view={view} onView={setView} />
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
          <VisitsReport />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ReportsTabs view={view} onView={setView} />
      {/* الفلاتر المتقدّمة — تنعكس لحظياً */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <Combo value={filters.state} onChange={(v) => set({ state: v })} options={STATE_OPTIONS} ariaLabel="الحالة" />
          <FilterCombo value={filters.sector} onChange={(v) => set({ sector: v })} options={sectorOptions} placeholder="قطاع" />
          <FilterCombo value={filters.district} onChange={(v) => set({ district: v })} options={districtOptions} placeholder="قضاء" />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-24"><FilterCombo value={filters.yearFrom} onChange={(v) => set({ yearFrom: v })} options={yearOptions} placeholder="من سنة" /></div>
          <div className="w-24"><FilterCombo value={filters.yearTo} onChange={(v) => set({ yearTo: v })} options={yearOptions} placeholder="إلى سنة" /></div>
          <span className="ms-auto text-[10px] font-semibold tabular-nums text-muted-foreground">{formatNumber(recs.length)} قطعة</span>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasFilters} title="مسح التصفية" aria-label="مسح التصفية" className={cn(ORB, "size-9", !hasFilters && "opacity-40")}>
            <FilterX className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/* لوحة العدّادات (KPIs بعدّ متحرك) */}
        <div className="grid grid-cols-2 gap-1.5">
          <Kpi icon={Layers} label="إجمالي القطع" value={t.count} format={formatNumber} />
          <Kpi icon={Building2} label="الشركات" value={(compData ?? []).length} format={formatNumber} onClick={() => requestOpenSection("companies")} />
          <Kpi icon={Ruler} label="إجمالي المساحات" value={Math.round(t.area)} format={(n) => formatArea(n)} />
          <Kpi icon={Coins} label="إجمالي القيم ($)" value={t.value > 0 ? Math.round(t.value) : null} format={formatNumber} />
        </div>

        {/* بطاقات الحالات: عدّ متحرك + شريط نسبة */}
        <div className="grid grid-cols-5 gap-1">
          {Object.keys(STATE_META).map((st) => (
            <StateCard key={st} stateKey={st} count={t.byState[st] ?? 0} total={t.count} onClick={() => requestOpenSection(STATE_META[st]!.section, STATE_META[st]!.status)} />
          ))}
        </div>

        <Section icon={BarChart3} title="توزيع الحالات">
          <StatePie data={pieData} onSlice={(st) => requestOpenSection(STATE_META[st]?.section ?? "", STATE_META[st]?.status)} />
        </Section>

        <Section icon={BarChart3} title="حسب القطاع (انقر للتصفية)">
          <CategoryBar data={sectorData} color="#5775A8" onPick={(label) => set({ sector: label })} />
        </Section>

        <Section icon={BarChart3} title="حسب القضاء (انقر للتصفية)">
          <CategoryBar data={districtData} color="#5E977A" onPick={(label) => set({ district: label })} />
        </Section>

        <Section
          icon={TrendingUp}
          title="الاتجاه الزمني (فرص · رخص)"
          extra={
            yearDelta ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  yearDelta.delta >= 0
                    ? "bg-state-completed/15 text-state-completed ring-state-completed/40"
                    : "bg-state-withdrawn/15 text-state-withdrawn ring-state-withdrawn/40",
                )}
                title={`${yearDelta.year} مقابل ${yearDelta.prevYear}`}
              >
                {yearDelta.delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {formatNumber(Math.abs(yearDelta.delta))} عن {yearDelta.prevYear}
              </span>
            ) : null
          }
        >
          <YearLine data={yearData} />
        </Section>

        {/* أعلى 5 — حتمية، النقر يفتح السجلّ */}
        <Section icon={Crown} title="أعلى 5 رخص رأسمالاً ($)">
          {topLicenses.length ? (
            <ul className="space-y-1">
              {topLicenses.map((l, i) => (
                <li key={l.record_id}>
                  <button
                    type="button"
                    onClick={() => requestOpenParcelDetail({ kind: "license", id: String(l.record_id) })}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition hover:bg-white/5 active:scale-[0.99]"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-state-inprogress/20 text-[10px] font-bold text-state-inprogress">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{l.title ?? l.license_number ?? "رخصة"}</span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#9fc0e8]">{formatNumber(l.capital ?? 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">{NOT_AVAILABLE}</p>
          )}
        </Section>

        <Section icon={Crown} title="أعلى 5 شركات رأسمالاً ($)">
          {topCompanies.length ? (
            <ul className="space-y-1">
              {topCompanies.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      requestOpenSection("companies");
                      requestOpenCompany(c.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition hover:bg-white/5 active:scale-[0.99]"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.name}</span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#9fc0e8]">{formatNumber(c.capital_usd ?? 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">{NOT_AVAILABLE}</p>
          )}
        </Section>

        {/* تقارير جاهزة — PDF بغلاف ورسم (أو CSV وفق الإعدادات) */}
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { fn: exportParcels, label: "القطع" },
            { fn: exportSectoral, label: "قطاعي" },
            { fn: exportSpatial, label: "مكاني" },
          ] as const).map((b) => (
            <button key={b.label} type="button" onClick={b.fn} className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/50 py-2 text-[11px] font-semibold transition hover:bg-accent hover:shadow-[0_0_16px_-6px_rgba(148,175,209,0.7)]">
              <Download className="size-3.5" /> {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
