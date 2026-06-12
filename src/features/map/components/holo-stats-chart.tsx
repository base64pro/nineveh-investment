"use client";

// م7.6 · الجارت الهولوكرامي (الزاوية السفلى اليسرى للخريطة): أعمدة ضوئية للفرص/قيد/منجزة/مسحوبة —
// أرقام حتمية بعدّ متحرك، تنفّس بطيء منسجم، خط مسح خافت — النقر ينقل للقسم (§هـ.1).

import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { useDashboardStats } from "@/lib/data/use-dashboard-stats";
import { useCountUp } from "@/components/ui/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestOpenSection } from "@/features/shell/shell-store";

const GLASS = "border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_13%_/_0.9)] shadow-[0_10px_32px_-12px_rgba(0,0,0,0.75),0_0_24px_-8px_rgba(148,175,209,0.5)] backdrop-blur";

const BARS = [
  { key: "announced", label: "فرص", color: "#C7A24E", section: "opportunities" },
  { key: "lic_in_progress", label: "قيد", color: "#5775A8", section: "licenses", status: "in-progress" },
  { key: "lic_completed", label: "منجزة", color: "#5E977A", section: "licenses", status: "completed" },
  { key: "lic_withdrawn", label: "مسحوبة", color: "#B5616A", section: "licenses", status: "withdrawn" },
] as const;

function Bar({ value, max, label, color, delay, onClick }: { value: number; max: number; label: string; color: string; delay: number; onClick: () => void }) {
  const display = useCountUp(value, 1.1);
  const pct = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 6;
  return (
    <button type="button" onClick={onClick} title={`${label} — انتقل للقسم`} className="group flex w-9 flex-col items-center gap-1">
      <span className="text-[10px] font-bold tabular-nums text-foreground/95">{formatNumber(display)}</span>
      <span className="relative flex h-20 w-3.5 items-end overflow-hidden rounded-full bg-white/[0.05] ring-1 ring-inset ring-white/10">
        <motion.span
          className="w-full rounded-full"
          style={{ background: `linear-gradient(to top, ${color}, ${color}55)`, boxShadow: `0 0 10px 0 ${color}66` }}
          initial={{ height: "0%" }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 1.1, ease: "easeOut", delay }}
        />
        {/* تنفّس ضوئي بطيء منسجم (متعاقب الأطوار) */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: `linear-gradient(to top, transparent 60%, ${color}26)` }}
          animate={{ opacity: [0.25, 0.7, 0.25] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: delay * 2 }}
        />
      </span>
      <span className="text-[8px] leading-none text-muted-foreground transition group-hover:text-foreground/85">{label}</span>
    </button>
  );
}

export function HoloStatsChart() {
  const { data: s } = useDashboardStats();
  const values = BARS.map((b) => (s?.[b.key] as number | undefined) ?? 0);
  const max = Math.max(1, ...values);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("absolute bottom-9 start-3 z-10 hidden overflow-hidden rounded-2xl px-3 pb-2 pt-2 md:block", GLASS)}
    >
      {/* خط مسح خافت */}
      <motion.span
        aria-hidden
        initial={{ y: "-30%" }}
        animate={{ y: "130%" }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.07)] to-transparent"
      />
      <div className="mb-1.5 flex items-center gap-1.5 text-[9px] tracking-[0.16em] text-[#9fc0e8]/80">
        <Activity className="size-3" />
        مؤشّر الحالات · مباشر
        <motion.span
          aria-hidden
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="size-1 rounded-full bg-[#9fc0e8] shadow-[0_0_6px_1px_rgba(159,192,232,0.8)]"
        />
      </div>
      <div className="flex items-end gap-1">
        {BARS.map((b, i) => (
          <Bar
            key={b.key}
            value={values[i] ?? 0}
            max={max}
            label={b.label}
            color={b.color}
            delay={i * 0.12}
            onClick={() => requestOpenSection(b.section, "status" in b ? (b.status as string) : undefined)}
          />
        ))}
      </div>
    </motion.div>
  );
}
