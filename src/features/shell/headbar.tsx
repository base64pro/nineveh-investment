"use client";

// الهيدبار (§هـ.1/2) — داشبورد متجاوب: بحث + عدّادات + هوية وصورة المدير.
// تجاوب متقدّم: صفّ واحد على الشاشات الكبيرة، ويلتفّ لصفوف على التابلت/الجوال **بلا تمرير أفقي**.

import { useState } from "react";
import { Ruler, Search, User } from "lucide-react";
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
      className="flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1 transition hover:bg-white/5 active:scale-95"
    >
      <span className={`size-2.5 shrink-0 rounded-full ${color} shadow-[0_0_9px_-1px] shadow-current`} />
      <span className="flex flex-col items-start leading-none">
        <span className="text-base font-extrabold tabular-nums tracking-tight text-foreground sm:text-lg">{formatNumber(value)}</span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

// إطار صورة المدير — /director.png حين تُرفع (بمعالجة لونية متّسقة)، وإلا أيقونة بديلة.
function DirectorAvatar() {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[rgba(148,175,209,0.55)] shadow-[0_0_16px_-3px_rgba(148,175,209,0.7)] sm:size-10">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/director.jpeg"
          alt="المدير العام"
          onError={() => setOk(false)}
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center bg-[rgba(148,175,209,0.14)] text-muted-foreground">
          <User className="size-5" />
        </span>
      )}
      {/* حلقة داخلية خفيفة للإطار الهولوكرامي — لا تُغيّر ألوان الصورة الطبيعية */}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
    </div>
  );
}

export function Headbar() {
  const { data: s } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[rgba(148,175,209,0.4)] bg-[hsl(220_36%_14%_/_0.94)] px-3 py-2 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.6)] backdrop-blur xl:h-14 xl:flex-nowrap xl:gap-2 xl:py-0">
      {/* البحث الفائق (يمين على الكبيرة) */}
      <button
        type="button"
        onClick={openSearch}
        title="بحث فائق (Ctrl K)"
        className="order-1 flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[rgba(148,175,209,0.45)] bg-white/5 px-3 text-muted-foreground transition hover:border-[rgba(148,175,209,0.85)] hover:bg-white/10 hover:text-foreground sm:w-52"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-right text-xs">ابحث في نينوى…</span>
        <kbd className="hidden rounded bg-black/25 px-1.5 py-0.5 text-[9px] sm:inline">Ctrl K</kbd>
      </button>

      {/* هوية الهيئة + صورة المدير (يسار على الكبيرة · مع البحث بصفّ واحد على الجوال) */}
      <div className="order-2 ms-auto flex shrink-0 items-center gap-2.5 xl:order-3 xl:ms-0">
        <div className="hidden text-right leading-tight md:block">
          <div className="text-xs font-bold tracking-tight text-foreground sm:text-sm">هيئة استثمار نينوى</div>
          <div className="text-[10px] text-muted-foreground">مكتب المدير العام · الأستاذ حارث البخو</div>
        </div>
        <DirectorAvatar />
      </div>

      {/* العدّادات الحتمية — صفّ كامل يلتفّ على الجوال/التابلت، مرن وسط على الكبيرة (بلا تمرير أفقي) */}
      <div className="order-3 flex w-full flex-wrap items-center justify-center gap-x-0.5 gap-y-1 xl:order-2 xl:w-auto xl:flex-1 xl:flex-nowrap">
        <Counter label="معلَنة" value={z(s?.announced)} color="bg-state-announced" onClick={() => requestOpenSection("opportunities")} />
        <Counter label="قيد" value={z(s?.lic_in_progress)} color="bg-state-inprogress" onClick={() => requestOpenSection("licenses", "in-progress")} />
        <Counter label="منجزة" value={z(s?.lic_completed)} color="bg-state-completed" onClick={() => requestOpenSection("licenses", "completed")} />
        <Counter label="مسحوبة" value={z(s?.lic_withdrawn)} color="bg-state-withdrawn" onClick={() => requestOpenSection("licenses", "withdrawn")} />
        <Counter label="مفترضة" value={z(s?.assumed)} color="bg-state-assumed" onClick={() => requestOpenSection("opportunity-design")} />
        <Counter label="شركات" value={z(s?.companies)} color="bg-primary/70" onClick={() => requestOpenSection("companies")} />
        <div className="flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1" title="إجمالي المساحات">
          <Ruler className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col items-start leading-none">
            <span className="text-base font-extrabold tabular-nums tracking-tight text-foreground sm:text-lg">{formatNumber(Math.round(z(s?.total_area_m2)))}</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">م² إجمالي</span>
          </span>
        </div>
      </div>
    </div>
  );
}
