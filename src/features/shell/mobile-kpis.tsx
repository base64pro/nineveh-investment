"use client";

// م8.2 · شريط مؤشّرات الجوال: شريط أفقي رفيع نصف-شفاف مثبّت مباشرة تحت الهيدبار (يعلو حافة الخريطة العليا فقط).
// ستة مؤشّرات (نقطة لونية + رقم بعدّ متحرك + تسمية مختصرة) لا تحجب وسط الخريطة. النقر ينقل للقسم (§هـ.1).
// يُعيد استخدام CHIPS وuseCountUp وNUM_GRADIENT (مشتركة مع نسخة الديسكتوب — لا تُعدَّل).

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
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 transition active:scale-95"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full shadow-[0_0_5px_0] shadow-current", dot)} />
      <span className={cn("text-[12px] font-bold tabular-nums leading-none", NUM_GRADIENT)}>{formatNumber(display)}</span>
      <span className="text-[9px] leading-none text-muted-foreground/85">{label}</span>
    </button>
  );
}

export function MobileKpis() {
  const { data: stats } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] md:hidden">
      <div className="pointer-events-auto flex items-center gap-0.5 overflow-x-auto bg-gradient-to-b from-[hsl(221_42%_7%/0.7)] via-[hsl(221_42%_7%/0.4)] to-transparent px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((c) => (
          <Pill
            key={c.key}
            dot={c.dot}
            value={z(stats?.[c.key])}
            label={c.shortLabel ?? c.label}
            onClick={() => requestOpenSection(c.section, c.status)}
          />
        ))}
      </div>
    </div>
  );
}
