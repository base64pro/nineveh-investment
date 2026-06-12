"use client";

// الهيدبار (§هـ.1/2 · م7.2) — داشبورد بثلاثة مستويات تجاوب مصمَّمة (لا التفاف عشوائي):
// • xl+ (حاسوب/شاشات كبيرة): صفّ واحد فسيح — بحث · شريط عدّادات زجاجي وسط · هوية وصورة المدير.
// • md..xl (لوحي): صفّان متوازنان — (بحث · هوية) ثم شريط العدّادات كاملاً.
// • <md (جوال): مكثّف أنيق — (زرّ بحث دائري · صورة) ثم شريط عدّادات مصغّر يسع الشاشة.
// الأرقام بعدّ متحرك · شرائح بألوان الحالات · حتمية (§هـ.1).

import { useState } from "react";
import { Ruler, Search, User } from "lucide-react";
import { useDashboardStats, type DashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openSearch } from "@/features/search/search-store";
import { requestOpenSection } from "./shell-store";

interface ChipDef {
  key: keyof DashboardStats | "area";
  label: string;
  shortLabel?: string;
  dot: string;
  section: string;
  status?: string;
}

const CHIPS: ChipDef[] = [
  { key: "announced", label: "معلَنة", dot: "bg-state-announced", section: "opportunities" },
  { key: "lic_in_progress", label: "قيد الإنجاز", shortLabel: "قيد", dot: "bg-state-inprogress", section: "licenses", status: "in-progress" },
  { key: "lic_completed", label: "منجزة", dot: "bg-state-completed", section: "licenses", status: "completed" },
  { key: "lic_withdrawn", label: "مسحوبة", dot: "bg-state-withdrawn", section: "licenses", status: "withdrawn" },
  { key: "assumed", label: "مفترضة", dot: "bg-state-assumed", section: "opportunity-design" },
  { key: "companies", label: "شركات", dot: "bg-primary/70", section: "companies" },
];

function Chip({ def, value }: { def: ChipDef; value: number }) {
  const display = useCountUp(value);
  return (
    <button
      type="button"
      onClick={() => requestOpenSection(def.section, def.status)}
      title={`${def.label} — انتقل للقسم`}
      className="group flex min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 transition hover:bg-white/6 active:scale-95 sm:px-3 xl:px-4 2xl:px-6"
    >
      <span className="flex items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full shadow-[0_0_8px_0px] shadow-current sm:size-2", def.dot)} />
        <span className="text-sm font-extrabold tabular-nums leading-none tracking-tight text-foreground sm:text-base xl:text-lg 2xl:text-2xl">
          {formatNumber(display)}
        </span>
      </span>
      <span className="max-w-full truncate text-[8px] leading-none text-muted-foreground transition group-hover:text-foreground/80 sm:text-[10px] 2xl:text-[11px]">
        <span className="sm:hidden">{def.shortLabel ?? def.label}</span>
        <span className="hidden sm:inline">{def.label}</span>
      </span>
    </button>
  );
}

function AreaChip({ value }: { value: number }) {
  const display = useCountUp(Math.round(value), 1.1);
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 sm:px-3 xl:px-4 2xl:px-6" title="إجمالي المساحات (مساحة القطعة المشتركة تُحسب مرّة)">
      <span className="flex items-center gap-1.5">
        <Ruler className="size-3 shrink-0 text-muted-foreground sm:size-3.5" />
        <span className="text-sm font-extrabold tabular-nums leading-none tracking-tight text-foreground sm:text-base xl:text-lg 2xl:text-2xl">
          {formatNumber(display)}
        </span>
      </span>
      <span className="text-[8px] leading-none text-muted-foreground sm:text-[10px] 2xl:text-[11px]">م² إجمالي</span>
    </div>
  );
}

/** شريط العدّادات الزجاجي الموحّد — شرائح مفصولة بفواصل متدرّجة، يتمدّد بفخامة على الشاشات الكبيرة. */
function CountersBar({ stats }: { stats: DashboardStats | undefined }) {
  const z = (n: number | undefined): number => n ?? 0;
  return (
    <div className="flex max-w-full items-stretch divide-x divide-[rgba(148,175,209,0.16)] overflow-hidden rounded-2xl border border-[rgba(148,175,209,0.35)] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.6)]">
      {CHIPS.map((c) => (
        <Chip key={c.key} def={c} value={z(stats?.[c.key as keyof DashboardStats])} />
      ))}
      <AreaChip value={z(stats?.total_area_m2)} />
    </div>
  );
}

// إطار صورة المدير — /director.jpeg بألوانها الطبيعية وإطار هولوكرامي.
function DirectorAvatar() {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[rgba(148,175,209,0.55)] shadow-[0_0_16px_-3px_rgba(148,175,209,0.7)] xl:size-10 2xl:size-12">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/director.jpeg" alt="المدير العام" onError={() => setOk(false)} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center bg-[rgba(148,175,209,0.14)] text-muted-foreground">
          <User className="size-5" />
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function Headbar() {
  const { data: stats } = useDashboardStats();

  return (
    <div className="border-b border-[rgba(148,175,209,0.4)] bg-[hsl(220_36%_14%_/_0.94)] shadow-[0_4px_18px_-8px_rgba(0,0,0,0.6)] backdrop-blur">
      {/* الصفّ الرئيس: بحث · (عدّادات على xl+) · هوية */}
      <div className="flex h-12 items-center gap-2 px-2.5 sm:px-3 xl:h-16 2xl:h-20 2xl:px-6">
        {/* البحث: دائري مكثّف على الجوال · حقل بارز من اللوحي فأعلى */}
        <button
          type="button"
          onClick={openSearch}
          title="بحث فائق (Ctrl K)"
          aria-label="بحث فائق"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-[rgba(148,175,209,0.45)] bg-white/5 text-muted-foreground transition hover:border-[rgba(148,175,209,0.85)] hover:bg-white/10 hover:text-foreground active:scale-95 md:hidden"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          onClick={openSearch}
          title="بحث فائق (Ctrl K)"
          className="hidden h-9 shrink-0 items-center gap-2 rounded-xl border border-[rgba(148,175,209,0.45)] bg-white/5 px-3 text-muted-foreground transition hover:border-[rgba(148,175,209,0.85)] hover:bg-white/10 hover:text-foreground md:flex md:w-48 xl:w-56 2xl:h-11 2xl:w-72"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-right text-xs 2xl:text-sm">ابحث في نينوى…</span>
          <kbd className="rounded bg-black/25 px-1.5 py-0.5 text-[9px]">Ctrl K</kbd>
        </button>

        {/* العدّادات وسط الصفّ — على الشاشات الواسعة فقط */}
        <div className="hidden min-w-0 flex-1 justify-center xl:flex">
          <CountersBar stats={stats} />
        </div>

        {/* الهوية + صورة المدير (يسار) */}
        <div className="ms-auto flex shrink-0 items-center gap-2.5 xl:ms-0">
          <div className="hidden text-right leading-tight md:block">
            <div className="text-xs font-bold tracking-tight text-foreground xl:text-sm 2xl:text-base">هيئة استثمار نينوى</div>
            <div className="text-[10px] text-muted-foreground 2xl:text-xs">مكتب المدير العام · الأستاذ حارث البخو</div>
          </div>
          <DirectorAvatar />
        </div>
      </div>

      {/* صفّ العدّادات — للجوال واللوحي (دون xl): شريط واحد متوازن يسع الشاشة بلا التفاف ولا تمرير */}
      <div className="flex justify-center px-2 pb-2 xl:hidden">
        <CountersBar stats={stats} />
      </div>
    </div>
  );
}
