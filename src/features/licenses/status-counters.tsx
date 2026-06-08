"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useTable } from "@/lib/data/use-table";
import { cn } from "@/lib/utils";
import type { License } from "@/types/entities";

// دوائر عدّاد عائمة (كعدّاد سرعة) بجانب السايدبار الأيسر — تبرز الدائرة الفعّالة وتكبر.
const COUNTERS = [
  { value: "", label: "الكل", grad: "from-foreground/20 to-foreground/5", ring: "ring-foreground/40", text: "text-foreground", glow: "148,175,209" },
  { value: "in-progress", label: "قيد", grad: "from-state-inprogress/30 to-state-inprogress/5", ring: "ring-state-inprogress/50", text: "text-state-inprogress", glow: "87,117,168" },
  { value: "completed", label: "منجزة", grad: "from-state-completed/30 to-state-completed/5", ring: "ring-state-completed/50", text: "text-state-completed", glow: "94,151,122" },
  { value: "withdrawn", label: "مسحوبة", grad: "from-state-withdrawn/30 to-state-withdrawn/5", ring: "ring-state-withdrawn/50", text: "text-state-withdrawn", glow: "181,97,106" },
] as const;

export function LicenseStatusCounters({
  status,
  onSelect,
}: {
  status: string;
  onSelect: (s: string) => void;
}) {
  const { data } = useTable<License>("licenses");
  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      "": all.length,
      "in-progress": all.filter((l) => l.status === "in-progress").length,
      completed: all.filter((l) => l.status === "completed").length,
      withdrawn: all.filter((l) => l.status === "withdrawn").length,
    } as Record<string, number>;
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 36 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 36 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="absolute right-[547px] top-24 z-10 flex flex-col gap-3"
      aria-label="عدّادات حالات الرخص"
    >
      {COUNTERS.map((c) => {
        const active = status === c.value;
        return (
          <motion.button
            key={c.value}
            type="button"
            onClick={() => onSelect(c.value)}
            title={c.label}
            animate={{ scale: active ? 1.28 : 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            style={{
              transformOrigin: "right center",
              zIndex: active ? 3 : 1,
              boxShadow: `0 0 ${active ? 30 : 15}px ${active ? -2 : -6}px rgba(${c.glow},${active ? 0.95 : 0.55})`,
            }}
            className={cn(
              "grid size-16 place-items-center rounded-full border bg-gradient-to-br ring-1 backdrop-blur transition-colors",
              c.grad,
              c.ring,
              active ? "border-white/25" : "border-white/10",
            )}
          >
            <span className={cn("text-lg font-bold leading-none tabular-nums", c.text)}>{counts[c.value] ?? 0}</span>
            <span className="mt-0.5 text-[8px] font-medium text-muted-foreground">{c.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
