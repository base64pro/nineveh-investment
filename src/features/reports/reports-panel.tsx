"use client";

// م5.3 · التقارير الذكية (§هـ.5) — **حتمي بالكامل** (أرقام من البيانات الفعلية، لا تأليف، لا كشف تحقّق).
// لوحات KPI + رسوم Recharts + فلاتر متقدّمة تنعكس لحظياً + تصدير + النقر ينتقل للمصدر.

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BarChart3, Building2, Coins, Download, FilterX, Layers, Ruler } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { useSettings } from "@/features/settings/use-settings";
import { formatNumber } from "@/lib/format";
import { formatArea } from "@/lib/display";
import { sectorCode, sectorLabel } from "@/lib/sectors";
import { exportTable } from "@/lib/export-table";
import { Combo } from "@/components/ui/combo";
import { FilterCombo } from "@/components/ui/filter-combo";
import { ORB } from "@/components/ui/orb";
import { cn } from "@/lib/utils";
import { requestOpenSection } from "@/features/shell/shell-store";
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

function Kpi({ icon: Icon, label, value, hint, onClick, color }: { icon: typeof Ruler; label: string; value: string; hint?: string; onClick?: () => void; color?: string }) {
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
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-inset ring-border/40" style={color ? { color } : undefined}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-extrabold tabular-nums leading-none text-foreground">{value}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{label}</span>
        {hint ? <span className="block truncate text-[9px] text-muted-foreground/70">{hint}</span> : null}
      </span>
    </button>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Ruler; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/30 p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary/80">
        <Icon className="size-3.5" /> {title}
      </h4>
      {children}
    </section>
  );
}

export function ReportsPanel() {
  const { data: oppsData } = useTable<Opportunity>("opportunities");
  const { data: licsData } = useTable<License>("licenses");
  const { data: asmData } = useTable<AssumedParcel>("assumed_parcels");
  const { data: compData } = useTable<Company>("companies");

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const all = useMemo(() => normalize(oppsData ?? [], licsData ?? [], asmData ?? []), [oppsData, licsData, asmData]);
  const sectorOptions = useMemo(() => Array.from(new Set(distinct(all.map((r) => r.sector)).map(sectorLabel))).sort(), [all]);
  const districtOptions = useMemo(() => distinct(all.map((r) => r.district)), [all]);
  const yearOptions = useMemo(() => distinct(all.map((r) => r.year)), [all]);

  // الفلتر المطبَّق: تحويل تسمية القطاع المعروضة ← رمز للمطابقة الحتمية
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

  const hasFilters = Boolean(filters.state || filters.sector || filters.district || filters.yearFrom || filters.yearTo);
  const set = (p: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...p }));

  const { data: settingsData } = useSettings();
  const exportFormat = settingsData?.settings.default_export ?? "pdf";
  async function doExport(csvName: string, title: string, rows: Record<string, unknown>[], keys: string[]): Promise<void> {
    const ok = await exportTable(exportFormat, csvName, title, rows, cols(keys));
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
    void doExport("تقرير-القطع.csv", "تقرير القطع", rows, ["النوع", "الحالة", "القطاع", "القضاء", "المساحة م²", "السنة", "القيمة"]);
  }
  function exportSectoral() {
    const rows = bySector(recs).map((g) => ({ القطاع: sectorLabel(g.key), العدد: g.count, "المساحة م²": Math.round(g.area) }));
    void doExport("تقرير-قطاعي.csv", "التقرير القطاعي", rows, ["القطاع", "العدد", "المساحة م²"]);
  }
  function exportSpatial() {
    const rows = byDistrict(recs).map((g) => ({ القضاء: g.key, العدد: g.count, "المساحة م²": Math.round(g.area) }));
    void doExport("تقرير-مكاني.csv", "التقرير المكاني", rows, ["القضاء", "العدد", "المساحة م²"]);
  }

  return (
    <div className="flex h-full flex-col">
      {/* الفلاتر المتقدّمة (§هـ.5) — تنعكس لحظياً */}
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
        {/* لوحة العدّادات (KPIs) */}
        <div className="grid grid-cols-2 gap-1.5">
          <Kpi icon={Layers} label="إجمالي القطع" value={formatNumber(t.count)} />
          <Kpi icon={Building2} label="الشركات" value={formatNumber((compData ?? []).length)} onClick={() => requestOpenSection("companies")} />
          <Kpi icon={Ruler} label="إجمالي المساحات" value={formatArea(t.area)} />
          <Kpi icon={Coins} label="إجمالي القيم" value={t.value > 0 ? `${formatNumber(Math.round(t.value))} $` : "غير متوفّر"} />
        </div>

        {/* عدّادات الحالات (قابلة للنقر ← المصدر) */}
        <div className="grid grid-cols-5 gap-1">
          {Object.entries(STATE_META).map(([st, m]) => (
            <button
              key={st}
              type="button"
              onClick={() => requestOpenSection(m.section, m.status)}
              title={`${m.label} — انتقل للمصدر`}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-border/50 bg-card/40 py-1.5 transition hover:bg-white/5 active:scale-95"
            >
              <span className="size-2 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px -1px ${m.color}` }} />
              <span className="text-sm font-bold tabular-nums text-foreground">{formatNumber(t.byState[st] ?? 0)}</span>
              <span className="text-[8px] leading-none text-muted-foreground">{m.label}</span>
            </button>
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

        <Section icon={BarChart3} title="الاتجاه الزمني (فرص · رخص)">
          <YearLine data={yearData} />
        </Section>

        {/* تقارير جاهزة — تصدير CSV (PDF في م6) */}
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={exportParcels} className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/50 py-2 text-[11px] font-semibold transition hover:bg-accent">
            <Download className="size-3.5" /> القطع
          </button>
          <button type="button" onClick={exportSectoral} className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/50 py-2 text-[11px] font-semibold transition hover:bg-accent">
            <Download className="size-3.5" /> قطاعي
          </button>
          <button type="button" onClick={exportSpatial} className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card/50 py-2 text-[11px] font-semibold transition hover:bg-accent">
            <Download className="size-3.5" /> مكاني
          </button>
        </div>
      </div>
    </div>
  );
}
