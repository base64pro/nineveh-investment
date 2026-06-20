"use client";

// م8.3/م8.4/م8.6 · شريط مؤشّرات الجوال: أقراص زجاجية بأرقام بارزة (عدّ متحرك) **ثابتة على صفّين (3+3)**
// تظهر كلها دفعةً واحدة بلا تمرير أفقي ولا حركة marquee. النقر ينقل للقسم (§هـ.1).
// يُعيد استخدام CHIPS وuseCountUp وNUM_GRADIENT (مشتركة مع الديسكتوب — لا تُعدَّل).

import { useDashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestOpenSection } from "./shell-store";
import { CHIPS, NUM_GRADIENT } from "./headbar";

function Pill({ dot, value, label, onClick }: { dot: string; value: number; label: string; onClick: () => void }) {
  const display = useCountUp(value);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} — انتقل للقسم`}
      dir="rtl"
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(148,175,209,0.28)] bg-white/[0.05] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-white/[0.04] transition active:scale-95"
    >
      <span className={cn("size-2 shrink-0 rounded-full shadow-[0_0_8px_1px] shadow-current", dot)} />
      <span className={cn("text-[16px] font-extrabold tabular-nums leading-none tracking-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]", NUM_GRADIENT)}>{formatNumber(display)}</span>
      <span className="text-[10px] font-medium leading-none text-foreground/75">{label}</span>
    </button>
  );
}

export function MobileKpis() {
  const { data: stats } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;
  const items = CHIPS.map((c) => ({ ...c, value: z(stats?.[c.key]) }));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] bg-gradient-to-b from-[hsl(221_42%_7%/0.82)] via-[hsl(221_42%_7%/0.45)] to-transparent py-2 md:hidden">
      {/* صفّان ثابتان (3+3) — كل الأقراص ظاهرة دفعةً واحدة بلا تمرير أفقي؛ dir=rtl ليبدأ الترتيب يميناً */}
      <div dir="rtl" className="pointer-events-auto mx-auto grid max-w-[27rem] grid-cols-3 place-items-center gap-x-2 gap-y-1.5 px-2">
        {items.map((c) => (
          <Pill
            key={c.key}
            dot={c.dot}
            value={c.value}
            label={c.shortLabel ?? c.label}
            onClick={() => requestOpenSection(c.section, c.status)}
          />
        ))}
      </div>
    </div>
  );
}
