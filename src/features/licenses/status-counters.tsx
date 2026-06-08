"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { useTable } from "@/lib/data/use-table";
import { cn } from "@/lib/utils";
import type { License } from "@/types/entities";

// عدّادات حالات الرخص: أقراص ثلاثية الأبعاد بلون واحد بلا حدود، تبدو منبثقة من حافّة السايدبار.
const COUNTERS = [
  { value: "", label: "الكل" },
  { value: "in-progress", label: "قيد" },
  { value: "completed", label: "منجزة" },
  { value: "withdrawn", label: "مسحوبة" },
] as const;

/** رقم يتحرّك تصاعدياً من القيمة السابقة إلى الجديدة (موشن سلس) عند الفتح. */
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
      animate={{ scale: active ? 1.12 : 1, x: active ? -6 : 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      style={{ transformOrigin: "right center", zIndex: active ? 3 : 1 }}
      className={cn(
        "relative grid size-16 place-items-center rounded-full text-white",
        active
          ? "bg-[radial-gradient(circle_at_50%_28%,#6982bd,#35496f)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_14px_28px_-8px_rgba(0,0,0,0.85)]"
          : "bg-[radial-gradient(circle_at_50%_28%,#46598a,#27364e)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_10px_22px_-8px_rgba(0,0,0,0.7)]",
      )}
    >
      {/* لمعة زجاجية مات (انعكاس علوي ناعم) */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(to_bottom,rgba(255,255,255,0.24),transparent_55%)]" />
      {/* الرقم في وسط الدائرة تماماً */}
      <span className="relative z-[1] text-xl font-bold leading-none tabular-nums">{display}</span>
      {/* الكلمة الدلالية صغيرة بيضاء أسفل الرقم */}
      <span className="pointer-events-none absolute inset-x-0 bottom-2 z-[1] text-center text-[8px] font-medium text-white/85">
        {label}
      </span>
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
      initial={{ opacity: 0, x: 44 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 44 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute right-[547px] top-16 z-10 flex flex-col gap-2.5"
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
