"use client";

// م7.12/م7.13 · شريط مؤشّرات الجوال: بطاقة زجاجية عمودية **أبسط وأنعم** أسفل-يسار الخريطة —
// ستة مؤشّرات أساسية (نقطة لونية + رقم بعدّ متحرك + تسمية)، شديدة الشفافية لا تزاحم الخريطة.
// النقر ينقل للقسم (§هـ.1). (المساحة الإجمالية متوفّرة في التقارير وسطح المكتب — أُسقطت هنا للبساطة.)

import { motion } from "framer-motion";
import { useDashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestOpenSection } from "./shell-store";
import { CHIPS, NUM_GRADIENT } from "./headbar";

function Row({ dot, value, label, onClick }: { dot: string; value: number; label: string; onClick: () => void }) {
  const display = useCountUp(value);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} — انتقل للقسم`}
      className="flex items-center gap-1.5 px-2.5 py-[3px] text-right transition active:scale-[0.97] hover:bg-white/8"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full shadow-[0_0_5px_0] shadow-current", dot)} />
      <span className={cn("min-w-[1.9rem] text-[13px] font-bold tabular-nums leading-none", NUM_GRADIENT)}>{formatNumber(display)}</span>
      <span className="text-[8px] leading-none text-muted-foreground/90">{label}</span>
    </button>
  );
}

export function MobileKpis() {
  const { data: stats } = useDashboardStats();
  const z = (n: number | undefined): number => n ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute bottom-14 left-2 z-[6] md:hidden"
    >
      <div className="pointer-events-auto flex flex-col gap-px overflow-hidden rounded-xl border border-[rgba(148,175,209,0.28)] bg-[hsl(221_42%_8%/0.62)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-md">
        {CHIPS.map((c) => (
          <Row key={c.key} dot={c.dot} value={z(stats?.[c.key])} label={c.label} onClick={() => requestOpenSection(c.section, c.status)} />
        ))}
      </div>
    </motion.div>
  );
}
