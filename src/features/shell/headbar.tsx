"use client";

// الهيدبار (§هـ.1/2) — شريط علوي = داشبورد: عدّادات لحظية **حتمية** قابلة للنقر ← مصدرها. (البحث الفائق في م5.2.)

import { Ruler, Search } from "lucide-react";
import { useDashboardStats } from "@/lib/data/use-dashboard-stats";
import { formatNumber } from "@/lib/format";
import { openSearch } from "@/features/search/search-store";
import { requestOpenSection } from "./shell-store";

function Counter({ label, value, color, onClick }: { label: string; value: number; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} — انتقل للقسم`}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-white/5 active:scale-95"
    >
      <span className={`size-2 shrink-0 rounded-full ${color} shadow-[0_0_6px_-1px] shadow-current`} />
      <span className="text-sm font-bold tabular-nums text-foreground">{formatNumber(value)}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  );
}

export function Headbar() {
  const { data: s } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;

  return (
    <div className="flex h-12 items-center gap-1 border-b border-[rgba(148,175,209,0.4)] bg-[hsl(220_36%_14%_/_0.92)] px-3 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.6)] backdrop-blur">
      <span className="me-1 shrink-0 text-sm font-bold tracking-tight text-foreground">نينوى · الاستثمار</span>
      <button
        type="button"
        onClick={openSearch}
        title="بحث فائق (Ctrl K)"
        className="flex shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-white/5 px-2.5 py-1 text-muted-foreground transition hover:border-border hover:bg-white/10 hover:text-foreground"
      >
        <Search className="size-3.5" />
        <span className="text-[11px]">بحث…</span>
        <kbd className="hidden rounded bg-black/20 px-1 text-[9px] md:inline">Ctrl K</kbd>
      </button>
      <div className="scroll-slim flex flex-1 items-center gap-0.5 overflow-x-auto">
        <Counter label="معلَنة" value={z(s?.announced)} color="bg-state-announced" onClick={() => requestOpenSection("opportunities")} />
        <Counter label="قيد" value={z(s?.lic_in_progress)} color="bg-state-inprogress" onClick={() => requestOpenSection("licenses", "in-progress")} />
        <Counter label="منجزة" value={z(s?.lic_completed)} color="bg-state-completed" onClick={() => requestOpenSection("licenses", "completed")} />
        <Counter label="مسحوبة" value={z(s?.lic_withdrawn)} color="bg-state-withdrawn" onClick={() => requestOpenSection("licenses", "withdrawn")} />
        <Counter label="مفترضة" value={z(s?.assumed)} color="bg-state-assumed" onClick={() => requestOpenSection("opportunity-design")} />
        <Counter label="شركات" value={z(s?.companies)} color="bg-primary/70" onClick={() => requestOpenSection("companies")} />
        <div className="ms-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground" title="إجمالي المساحات">
          <Ruler className="size-3.5" />
          <span className="text-sm font-bold tabular-nums text-foreground">{formatNumber(Math.round(z(s?.total_area_m2)))}</span>
          <span className="text-[11px]">م²</span>
        </div>
      </div>
    </div>
  );
}
