"use client";

// م7.12 · شريط مؤشّرات الجوال (الأرقام العلوية مُنقولة للجوال): بطاقة زجاجية عمودية أنيقة
// أسفل-يسار الخريطة — كل مؤشّر صفّ (نقطة لونية + رقم بعدّ متحرك + تسمية)، النقر ينقل للقسم (§هـ.1).

import { motion } from "framer-motion";
import { Ruler } from "lucide-react";
import { useDashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestOpenSection } from "./shell-store";
import { CHIPS, NUM_GRADIENT } from "./headbar";

function Row({ dot, value, label, onClick, index }: { dot: string; value: number; label: string; onClick?: () => void; index: number }) {
  const display = useCountUp(value);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? `${label} — انتقل للقسم` : label}
      className="group flex items-center gap-2 px-2.5 py-1.5 text-right transition active:scale-[0.97] enabled:hover:bg-white/8"
    >
      <motion.span
        aria-hidden
        animate={{ opacity: [1, 0.5, 1], scale: [1, 1.2, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.35 }}
        className={cn("size-1.5 shrink-0 rounded-full shadow-[0_0_8px_1px] shadow-current", dot)}
      />
      <span className={cn("min-w-[2.2rem] text-[15px] font-extrabold tabular-nums leading-none", NUM_GRADIENT)}>{formatNumber(display)}</span>
      <span className="text-[9.5px] leading-none text-muted-foreground transition group-hover:text-foreground/85">{label}</span>
    </button>
  );
}

export function MobileKpis() {
  const { data: stats } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;
  const area = useCountUp(Math.round(z(stats?.total_area_m2)), 1.1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute bottom-14 left-2 z-[6] md:hidden"
    >
      <div className="pointer-events-auto flex flex-col divide-y divide-[rgba(148,175,209,0.14)] overflow-hidden rounded-2xl border border-[rgba(148,175,209,0.4)] bg-[hsl(221_40%_9%/0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_30px_-12px_rgba(0,0,0,0.8),0_0_22px_-10px_rgba(148,175,209,0.5)] backdrop-blur-md">
        {CHIPS.map((c, i) => (
          <Row key={c.key} dot={c.dot} value={z(stats?.[c.key])} label={c.label} index={i} onClick={() => requestOpenSection(c.section, c.status)} />
        ))}
        <div className="flex items-center gap-2 px-2.5 py-1.5" title="إجمالي المساحات">
          <Ruler className="size-3 shrink-0 text-[#9fc0e8]/80" />
          <span className={cn("min-w-[2.2rem] text-[14px] font-extrabold tabular-nums leading-none", NUM_GRADIENT)}>{formatNumber(area)}</span>
          <span className="text-[9.5px] leading-none text-muted-foreground">م² إجمالي</span>
        </div>
      </div>
    </motion.div>
  );
}
