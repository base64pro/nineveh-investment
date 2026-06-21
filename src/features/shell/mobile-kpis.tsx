"use client";

// م8.3/م8.4/م8.6/م8.7 · شريط مؤشّرات الجوال: ستة أقراص زجاجية بأرقام بارزة (عدّ متحرك) **في صفّ واحد**
// متطابقة الحجم تماماً (شبكة 6 أعمدة متساوية) — كلها ظاهرة دفعةً واحدة بلا تمرير أفقي. النقر ينقل للقسم (§هـ.1).
// يُعيد استخدام CHIPS وuseCountUp وNUM_GRADIENT (مشتركة مع الديسكتوب — لا تُعدَّل).

import { useDashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestOpenSection } from "./shell-store";
import { CHIPS, NUM_GRADIENT } from "./headbar";
import { useMapBase } from "@/features/map/lib/map-base-store";

function Pill({ dot, value, label, onClick, lightMap }: { dot: string; value: number; label: string; onClick: () => void; lightMap: boolean }) {
  const display = useCountUp(value);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} — انتقل للقسم`}
      dir="rtl"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1 ring-1 ring-inset backdrop-blur-md transition active:scale-95",
        // م8.10 · فوق الخريطة الفاتحة: قرص كحلي ممتلئ ليبرز؛ في الداكن/القمر: زجاج أبيض كما هو
        lightMap
          ? "border-[rgba(159,192,232,0.6)] bg-[hsl(221_44%_13%/0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_-8px_rgba(0,0,0,0.55)] ring-white/[0.06]"
          : "border-[rgba(148,175,209,0.42)] bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-white/[0.08]",
      )}
    >
      <span className="flex items-center gap-1">
        <span className={cn("size-1.5 shrink-0 rounded-full shadow-[0_0_6px_1px] shadow-current", dot)} />
        <span className={cn("text-[15px] font-extrabold tabular-nums leading-none tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]", NUM_GRADIENT)}>{formatNumber(display)}</span>
      </span>
      <span className={cn("max-w-full truncate text-[8px] font-medium leading-none", lightMap ? "text-[#cfe3ff]/85" : "text-foreground/70")}>{label}</span>
    </button>
  );
}

export function MobileKpis() {
  const { data: stats } = useDashboardStats();
  const lightMap = useMapBase() === "light"; // م8.10 · لون القرص يتبع قاعدة الخريطة
  const z = (n: number | undefined): number => n ?? 0;
  const items = CHIPS.map((c) => ({ ...c, value: z(stats?.[c.key]) }));

  return (
    <div data-kpibar className="pointer-events-none absolute inset-x-0 top-0 z-[6] bg-gradient-to-b from-[hsl(221_42%_7%/0.82)] via-[hsl(221_42%_7%/0.45)] to-transparent py-2 md:hidden">
      {/* صفّ واحد من ستة أقراص متطابقة الحجم (6 أعمدة متساوية) — بلا تمرير أفقي؛ dir=rtl ليبدأ الترتيب يميناً */}
      <div dir="rtl" className="pointer-events-auto mx-auto grid max-w-[30rem] grid-cols-6 items-stretch gap-1 px-2">
        {items.map((c) => (
          <Pill
            key={c.key}
            dot={c.dot}
            value={c.value}
            label={c.shortLabel ?? c.label}
            onClick={() => requestOpenSection(c.section, c.status)}
            lightMap={lightMap}
          />
        ))}
      </div>
    </div>
  );
}
