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

// إطار متدرّج هولوكرامي (ثلجي ← بنفسجي) حول جسم زجاجي
const FRAME = "rounded-2xl p-px bg-[linear-gradient(150deg,rgba(148,175,209,0.55),rgba(139,111,176,0.4),rgba(148,175,209,0.2))] shadow-[0_12px_36px_-12px_rgba(0,0,0,0.8),0_0_28px_-8px_rgba(148,175,209,0.55)]";
const BODY = "relative overflow-hidden rounded-[calc(1rem-1px)] bg-[hsl(221_40%_10%_/_0.92)] backdrop-blur-xl";

const BARS = [
  { key: "announced", label: "فرص", color: "#C7A24E", section: "opportunities" },
  { key: "lic_in_progress", label: "قيد", color: "#5775A8", section: "licenses", status: "in-progress" },
  { key: "lic_completed", label: "منجزة", color: "#5E977A", section: "licenses", status: "completed" },
  { key: "lic_withdrawn", label: "مسحوبة", color: "#B5616A", section: "licenses", status: "withdrawn" },
] as const;

function Bar({ value, max, label, color, delay, onClick }: { value: number; max: number; label: string; color: string; delay: number; onClick: () => void }) {
  const display = useCountUp(value, 1.1);
  const pct = max > 0 ? Math.max(7, Math.round((value / max) * 100)) : 7;
  return (
    <button type="button" onClick={onClick} title={`${label} — انتقل للقسم`} className="group flex w-10 flex-col items-center gap-1">
      <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-foreground/95 ring-1 ring-inset ring-white/10">
        {formatNumber(display)}
      </span>
      <span className="relative flex h-[88px] w-4 items-end overflow-hidden rounded-full bg-white/[0.045] ring-1 ring-inset ring-white/10">
        {/* علامات قياس خافتة داخل المسار */}
        {[25, 50, 75].map((t) => (
          <span key={t} aria-hidden className="absolute inset-x-0.5 h-px bg-white/10" style={{ bottom: `${t}%` }} />
        ))}
        <motion.span
          className="relative w-full rounded-full"
          style={{ background: `linear-gradient(to top, ${color}, ${color}44)`, boxShadow: `0 0 12px 0 ${color}77` }}
          initial={{ height: "0%" }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 1.1, ease: "easeOut", delay }}
        >
          {/* قمّة متوهّجة */}
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-full" style={{ background: color, boxShadow: `0 0 8px 1px ${color}` }} />
        </motion.span>
        {/* تنفّس ضوئي بطيء منسجم (متعاقب الأطوار) */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: `linear-gradient(to top, transparent 55%, ${color}2e)` }}
          animate={{ opacity: [0.25, 0.75, 0.25] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut", delay: delay * 2 }}
        />
      </span>
      <span className="text-[8.5px] leading-none text-muted-foreground transition group-hover:text-foreground/90">{label}</span>
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
      className={cn("absolute bottom-9 end-3 z-10 hidden md:block", FRAME)}
    >
      <div className={cn(BODY, "px-3 pb-2 pt-2")}>
        {/* خط مسح خافت */}
        <motion.span
          aria-hidden
          initial={{ y: "-30%" }}
          animate={{ y: "130%" }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.08)] to-transparent"
        />
        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] tracking-[0.16em] text-[#9fc0e8]/85">
          <Activity className="size-3" />
          مؤشّر الحالات · مباشر
          <motion.span
            aria-hidden
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="size-1 rounded-full bg-[#9fc0e8] shadow-[0_0_6px_1px_rgba(159,192,232,0.8)]"
          />
        </div>
        <span aria-hidden className="mb-2 block h-px bg-gradient-to-r from-transparent via-[rgba(148,175,209,0.5)] to-transparent" />
        <div className="flex items-end gap-1.5">
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
      </div>
    </motion.div>
  );
}
