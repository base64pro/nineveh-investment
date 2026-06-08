"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { useTable } from "@/lib/data/use-table";
import { cn } from "@/lib/utils";
import type { License } from "@/types/entities";

// عدّادات حالات الرخص: أقراص ثلاثية الأبعاد بلون واحد بلا حدود، الرقم وسطي يتحرك تصاعدياً عند الفتح.
const COUNTERS = [
  { value: "", label: "الكل" },
  { value: "in-progress", label: "قيد" },
  { value: "completed", label: "منجزة" },
  { value: "withdrawn", label: "مسحوبة" },
] as const;

const ORB_BASE =
  "grid size-16 place-items-center rounded-full text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_10px_22px_-8px_rgba(0,0,0,0.7)]";
const ORB_BG = "bg-[radial-gradient(circle_at_50%_28%,#46598a,#27364e)]";
const ORB_BG_ACTIVE = "bg-[radial-gradient(circle_at_50%_28%,#627ab6,#33466b)]";

/** رقم يتحرّك تصاعدياً من القيمة السابقة إلى الجديدة (موشن سلس). */
function useCountUp(value: number): number {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value]);
  return display;
}

function CounterOrb({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const display = useCountUp(count);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={label}
      animate={{ scale: active ? 1.28 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      style={{ transformOrigin: "right center", zIndex: active ? 3 : 1 }}
      className={cn(ORB_BASE, active ? ORB_BG_ACTIVE : ORB_BG)}
    >
      <span className="text-lg font-bold leading-none tabular-nums">{display}</span>
      <span className="mt-0.5 text-[8px] font-medium text-foreground/70">{label}</span>
    </motion.button>
  );
}

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
      {COUNTERS.map((c) => (
        <CounterOrb
          key={c.value}
          label={c.label}
          count={counts[c.value] ?? 0}
          active={status === c.value}
          onClick={() => onSelect(c.value)}
        />
      ))}
    </motion.div>
  );
}
