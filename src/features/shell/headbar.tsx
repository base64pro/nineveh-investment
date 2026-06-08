"use client";

// الهيدبار (§هـ.1/2) — داشبورد: بحث بارز (يمين) · عدّادات حتمية أكبر (وسط) · هوية الهيئة وصورة المدير (يسار).

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
      className="flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 transition hover:bg-white/5 active:scale-95"
    >
      <span className={`size-2.5 shrink-0 rounded-full ${color} shadow-[0_0_9px_-1px] shadow-current`} />
      <span className="flex flex-col items-start leading-none">
        <span className="text-lg font-extrabold tabular-nums tracking-tight text-foreground">{formatNumber(value)}</span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

// إطار صورة المدير — يعرض /director.png حين تُرفع (بمعالجة لونية متّسقة)، وإلا أيقونة بديلة.
function DirectorAvatar() {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-full ring-2 ring-[rgba(148,175,209,0.55)] shadow-[0_0_16px_-3px_rgba(148,175,209,0.7)]">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/director.png"
          alt="المدير العام"
          onError={() => setOk(false)}
          className="size-full object-cover [filter:grayscale(0.35)_contrast(1.05)]"
        />
      ) : (
        <span className="grid size-full place-items-center bg-[rgba(148,175,209,0.14)] text-muted-foreground">
          <User className="size-5" />
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-primary/30 to-transparent" />
    </div>
  );
}

export function Headbar() {
  const { data: s } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;

  return (
    <div className="flex h-14 items-center gap-2 border-b border-[rgba(148,175,209,0.4)] bg-[hsl(220_36%_14%_/_0.94)] px-3 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.6)] backdrop-blur">
      {/* البحث الفائق — حقل بارز (يمين/البداية) */}
      <button
        type="button"
        onClick={openSearch}
        title="بحث فائق (Ctrl K)"
        className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[rgba(148,175,209,0.45)] bg-white/5 px-3 text-muted-foreground transition hover:border-[rgba(148,175,209,0.85)] hover:bg-white/10 hover:text-foreground sm:w-56"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-right text-xs">ابحث في نينوى…</span>
        <kbd className="hidden rounded bg-black/25 px-1.5 py-0.5 text-[9px] sm:inline">Ctrl K</kbd>
      </button>

      {/* العدّادات الحتمية (وسط) */}
      <div className="scroll-slim flex flex-1 items-center justify-center gap-0.5 overflow-x-auto">
        <Counter label="معلَنة" value={z(s?.announced)} color="bg-state-announced" onClick={() => requestOpenSection("opportunities")} />
        <Counter label="قيد الإنجاز" value={z(s?.lic_in_progress)} color="bg-state-inprogress" onClick={() => requestOpenSection("licenses", "in-progress")} />
        <Counter label="منجزة" value={z(s?.lic_completed)} color="bg-state-completed" onClick={() => requestOpenSection("licenses", "completed")} />
        <Counter label="مسحوبة" value={z(s?.lic_withdrawn)} color="bg-state-withdrawn" onClick={() => requestOpenSection("licenses", "withdrawn")} />
        <Counter label="مفترضة" value={z(s?.assumed)} color="bg-state-assumed" onClick={() => requestOpenSection("opportunity-design")} />
        <Counter label="شركات" value={z(s?.companies)} color="bg-primary/70" onClick={() => requestOpenSection("companies")} />
        <div className="flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5" title="إجمالي المساحات">
          <Ruler className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col items-start leading-none">
            <span className="text-lg font-extrabold tabular-nums tracking-tight text-foreground">{formatNumber(Math.round(z(s?.total_area_m2)))}</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">م² إجمالي</span>
          </span>
        </div>
      </div>

      {/* هوية الهيئة + صورة المدير (يسار/النهاية) */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="hidden text-right leading-tight md:block">
          <div className="text-sm font-bold tracking-tight text-foreground">هيئة استثمار نينوى</div>
          <div className="text-[10px] text-muted-foreground">مكتب المدير العام · الأستاذ حارث البخو</div>
        </div>
        <DirectorAvatar />
      </div>
    </div>
  );
}
