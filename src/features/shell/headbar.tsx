"use client";

// الهيدبار (§هـ.1/2 · م7.2+) — داشبورد فائق بجرافيك هولوكرامي:
// من md فأعلى: **مستوى أفقي واحد** — البحث · شريط الأرقام الزجاجي · عنوان رئيس الهيئة · صورته.
// على الجوال (<md): صفّ مكثّف (بحث دائري + صورة) ثم شريط أرقام مصغّر يسع الشاشة.
// أرقام بعدّ متحرك وتدرّج ضوئي · خط توهّج قاعدي · حتمية (§هـ.1).

import { useState } from "react";
import { motion } from "framer-motion";
import { Ruler, Search, User } from "lucide-react";
import { useDashboardStats, type DashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openSearch } from "@/features/search/search-store";
import { requestOpenSection } from "./shell-store";

interface ChipDef {
  key: keyof DashboardStats;
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

// رقم بتدرّج ضوئي (أبيض ← أزرق ثلجي) — التوقيع البصري الهولوكرامي
const NUM_GRADIENT = "bg-gradient-to-b from-white via-[#e3edfb] to-[#9fc0e8] bg-clip-text text-transparent";

function Chip({ def, value, index }: { def: ChipDef; value: number; index: number }) {
  const display = useCountUp(value);
  return (
    <button
      type="button"
      onClick={() => requestOpenSection(def.section, def.status)}
      title={`${def.label} — انتقل للقسم`}
      className="group relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 transition hover:bg-white/6 active:scale-95 md:px-2.5 md:py-2 lg:px-3 xl:px-4 2xl:px-6"
    >
      <span className="flex items-center gap-1 md:gap-1.5">
        <motion.span
          aria-hidden
          animate={{ opacity: [1, 0.45, 1], scale: [1, 1.25, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
          className={cn("size-1.5 shrink-0 rounded-full shadow-[0_0_9px_1px] shadow-current md:size-2", def.dot)}
        />
        {/* انسياب مستمر متناغم للأرقام (طفوّ لطيف متعاقب الأطوار) */}
        <motion.span
          animate={{ y: [0, -1.6, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
          className={cn("text-sm font-extrabold tabular-nums leading-none tracking-tight md:text-base lg:text-[17px] xl:text-lg 2xl:text-2xl", NUM_GRADIENT)}
        >
          {formatNumber(display)}
        </motion.span>
      </span>
      <span className="max-w-full truncate text-[8px] leading-none text-muted-foreground transition group-hover:text-foreground/85 md:text-[9px] lg:text-[10px] 2xl:text-[11px]">
        <span className="md:hidden">{def.shortLabel ?? def.label}</span>
        <span className="hidden md:inline">{def.label}</span>
      </span>
      {/* وميض سفلي عند المرور */}
      <span className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(148,175,209,0.85)] to-transparent opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

function AreaChip({ value }: { value: number }) {
  const display = useCountUp(Math.round(value), 1.1);
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 md:px-2 lg:px-3 xl:px-4 2xl:px-6" title="إجمالي المساحات (مساحة القطعة المشتركة تُحسب مرّة)">
      <span className="flex items-center gap-1 md:gap-1.5">
        <Ruler className="size-3 shrink-0 text-[#9fc0e8]/80 md:size-3.5" />
        <span className={cn("text-sm font-extrabold tabular-nums leading-none tracking-tight md:text-[15px] lg:text-base xl:text-lg 2xl:text-2xl", NUM_GRADIENT)}>
          {formatNumber(display)}
        </span>
      </span>
      <span className="text-[8px] leading-none text-muted-foreground md:text-[9px] lg:text-[10px] 2xl:text-[11px]">م² إجمالي</span>
    </div>
  );
}

/** شريط الأرقام الزجاجي — شرائح بفواصل ضوئية، يتمدّد بفخامة مع اتساع الشاشة. */
function CountersBar({ stats }: { stats: DashboardStats | undefined }) {
  const z = (n: number | undefined): number => n ?? 0;
  return (
    <div className="relative flex max-w-full items-stretch divide-x divide-[rgba(148,175,209,0.16)] overflow-hidden rounded-2xl border border-[rgba(148,175,209,0.4)] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_-14px_rgba(0,0,0,0.7),0_0_22px_-10px_rgba(148,175,209,0.5)]">
      {/* لمعة ضوئية واضحة تعبر الشريط باستمرار (موشن حيّ) */}
      <motion.span
        aria-hidden
        initial={{ x: "-140%" }}
        animate={{ x: "1100%" }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
        className="pointer-events-none absolute inset-y-0 w-24 -skew-x-12 bg-gradient-to-l from-transparent via-white/[0.12] to-transparent"
      />
      {CHIPS.map((c, i) => (
        <Chip key={c.key} def={c} value={z(stats?.[c.key])} index={i} />
      ))}
      <AreaChip value={z(stats?.total_area_m2)} />
    </div>
  );
}

function DirectorAvatar() {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[rgba(148,175,209,0.6)] shadow-[0_0_18px_-3px_rgba(148,175,209,0.8)] lg:size-10 2xl:size-12">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/director.jpeg" alt="السيد رئيس الهيئة" onError={() => setOk(false)} className="size-full object-cover" />
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
    <div className="relative bg-[linear-gradient(180deg,hsl(220_38%_16%/0.97),hsl(220_36%_12%/0.95))] shadow-[0_6px_24px_-10px_rgba(0,0,0,0.7)] backdrop-blur">
      {/* شفق هولوكرامي حيّ ينجرف بوضوح + خط توهّج قاعدي تجري عليه لمعة أنيقة مريحة (موشن مستمر) */}
      <motion.span
        aria-hidden
        animate={{ x: ["-9%", "9%", "-9%"], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 -left-[12%] w-[124%] bg-[radial-gradient(58%_150%_at_50%_-30%,rgba(148,175,209,0.22),transparent_72%)]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(148,175,209,0.75)] to-transparent" />
      <motion.span
        aria-hidden
        initial={{ left: "-18%" }}
        animate={{ left: "112%" }}
        transition={{ duration: 9.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
        className="pointer-events-none absolute -bottom-[2px] h-[4px] w-32 -translate-x-1/2 rounded-full bg-gradient-to-l from-transparent via-[#cfe3ff]/85 to-transparent blur-[1.5px]"
      />

      {/* المستوى الأفقي الواحد (md+): بحث · الأرقام · العنوان · الصورة */}
      {/* ارتفاع أكبر على التابلت (8–13″): عناصر واضحة بارتفاع منطقي متّسق */}
      <div className="relative flex h-12 items-center gap-2 px-2.5 md:h-[68px] md:gap-2.5 md:px-3 xl:h-[68px] 2xl:h-20 2xl:gap-4 2xl:px-6">
        {/* البحث: دائري على الجوال · حقل بارز من md */}
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
          className="hidden h-9 shrink-0 items-center gap-2 rounded-xl border border-[rgba(148,175,209,0.45)] bg-white/5 px-2.5 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[rgba(148,175,209,0.9)] hover:bg-white/10 hover:text-foreground hover:shadow-[0_0_18px_-6px_rgba(148,175,209,0.8)] md:flex md:w-36 lg:w-44 xl:w-56 2xl:h-11 2xl:w-72 2xl:px-3"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate text-right text-[11px] lg:text-xs 2xl:text-sm">ابحث في نينوى…</span>
          <kbd className="hidden rounded bg-black/25 px-1.5 py-0.5 text-[9px] lg:inline">Ctrl K</kbd>
        </button>

        {/* الأرقام — على نفس المستوى من md فأعلى */}
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <CountersBar stats={stats} />
        </div>

        {/* فاصل ضوئي قبل الهوية */}
        <span aria-hidden className="hidden h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.45)] to-transparent md:block 2xl:h-10" />

        {/* عنوان رئيس الهيئة + الصورة */}
        <div className="ms-auto flex shrink-0 items-center gap-2 md:ms-0 md:gap-2.5">
          <div className="hidden text-right leading-tight md:block">
            <div className="whitespace-nowrap text-[11px] font-bold tracking-tight text-foreground lg:text-xs xl:text-sm 2xl:text-base">
              هيئة استثمار نينوى
            </div>
            <div className="whitespace-nowrap text-[9px] text-muted-foreground lg:text-[10px] 2xl:text-xs">
              مكتب السيد رئيس الهيئة الأستاذ حارث البخو
            </div>
          </div>
          <DirectorAvatar />
        </div>
      </div>

      {/* صفّ الأرقام للجوال فقط (<md) */}
      <div className="relative flex justify-center px-2 pb-2 md:hidden">
        <CountersBar stats={stats} />
      </div>
    </div>
  );
}
