"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/** رقم يتحرّك تصاعدياً من القيمة السابقة إلى الجديدة (موشن سلس) — يصمد أمام Strict Mode. */
export function useCountUp(value: number, duration = 0.9): number {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => {
        from.current = value; // عند الاكتمال فقط — تشغيل Strict المزدوج يعيد العدّ من البداية لا من النهاية
      },
    });
    return () => controls.stop();
  }, [value, duration]);
  return display;
}
